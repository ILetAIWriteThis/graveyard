#!/usr/bin/env python3
"""Multi-turn triage loop: feed synthetic logs to a local model until it
reaches a verdict, then have a *different* model verify that verdict.

Two models, two jobs:

1. **Analyst** (`--model`) sees the logs one batch at a time and drives its
   own pacing through tool calls: `request_more_logs()` to pull the next
   batch when the evidence so far is inconclusive, `lookup_schema()` to
   resolve a generic field name to a real SIEM table/column (via
   schema-translator/). A verdict given while log lines are still unseen is
   pushed back (small models stop reading early otherwise) unless
   `--allow-early-verdict` is set; the loop ends when the analyst answers
   with the stream drained, or `--max-steps` is hit. That free-text answer
   is then squeezed into a JSON verdict by a structured-output call.
2. **Verifier** (`--verify-model`, must differ from the analyst) sees only
   the log lines the analyst was actually shown plus the verdict, and grades
   it: agreement, 1-5 score, unsupported claims, missed signals.

Example:
    uv run synthetic-logs/generate_syslog.py -n 60 --format jsonl -o /tmp/sample.jsonl
    uv run local-agent/multiloop.py /tmp/sample.jsonl --format jsonl
    uv run local-agent/multiloop.py /tmp/sample.jsonl --format jsonl \\
        --model qwen2.5:7b --verify-model llama3.1:8b --batch-size 8 \\
        --output /tmp/multiloop.json
"""
import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(REPO_ROOT / "schema-translator"))
sys.path.insert(0, str(REPO_ROOT / "synthetic-logs"))

from schema_translator import SCHEMA, get_log_schema  # noqa: E402
from classify_logs import parse_line  # noqa: E402

from ollama import chat  # noqa: E402

# gemma3 (any size) doesn't support tool-calling in Ollama, so the analyst
# has to be a tool-capable model; the verifier only needs structured output.
ANALYST_MODEL = "qwen2.5:7b"
VERIFIER_MODEL = "llama3.1:8b"

ANALYST_SYSTEM_PROMPT = (
    "You are a SOC analyst triaging a stream of syslog lines from one host. "
    "You are shown the logs in batches. Work incrementally: look for patterns "
    "ACROSS lines and sources (repeated failures from one IP, a burst followed "
    "by a success, matching firewall/NDR/auth endpoints, suspicious process "
    "execution), not just line by line.\n\n"
    "Tools:\n"
    "- request_more_logs(): pulls the next batch. An attack can span batches, so "
    "keep calling it until you are told no more logs are available — unless you "
    "have already confirmed a critical incident and further logs cannot change "
    "that.\n"
    "- lookup_schema(field, vendor): resolve a generic field name to the real "
    f"SIEM table/column. Known fields: {', '.join(SCHEMA)}.\n\n"
    "When (and only when) you have seen enough of the stream, answer WITHOUT "
    "calling any tool: state whether this is an incident, its severity "
    "(info/suspicious/critical), the attack type if any, your reasoning, and "
    "quote the exact log lines you relied on. Never claim anything the log "
    "lines do not show."
)

VERDICT_EXTRACT_PROMPT = (
    "Convert your final triage answer into the required JSON object. Copy the "
    "evidence lines verbatim from the logs you were shown."
)

VERDICT_SCHEMA = {
    "type": "object",
    "properties": {
        "incident": {"type": "boolean"},
        "severity": {"type": "string", "enum": ["info", "suspicious", "critical"]},
        "attack_type": {"type": "string"},
        "reasoning": {"type": "string"},
        "evidence": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["incident", "severity", "attack_type", "reasoning", "evidence"],
}

VERIFIER_SYSTEM_PROMPT = (
    "You are a strict, skeptical senior SOC analyst reviewing a junior "
    "analyst's triage verdict. You are given the exact log lines the junior "
    "was shown and their verdict. Check every claim against those lines: is "
    "each one supported by evidence actually present? Flag overclaiming "
    "(calling routine activity an incident, inflating severity, inventing "
    "detail that is not in the logs) and underclaiming (a real attack pattern "
    "in the logs that the verdict missed). Quote log lines when you object."
)

VERIFIER_USER_TEMPLATE = (
    "Log lines the junior analyst saw ({shown} of {total} total):\n{logs}\n\n"
    "Junior analyst's verdict:\n{verdict}\n\n"
    "Grade it. Every entry in unsupported_claims must quote the junior's own "
    "wording, not name a field; every missed_signal must quote a log line."
)

VERIFICATION_SCHEMA = {
    "type": "object",
    "properties": {
        "agreement": {"type": "string", "enum": ["agree", "partially_agree", "disagree"]},
        "score": {"type": "integer", "minimum": 1, "maximum": 5},
        "unsupported_claims": {"type": "array", "items": {"type": "string"}},
        "missed_signals": {"type": "array", "items": {"type": "string"}},
        "reasoning": {"type": "string"},
    },
    "required": ["agreement", "score", "unsupported_claims", "missed_signals", "reasoning"],
}


def serialize_message(message) -> dict:
    """Convert an Ollama Message or a plain message mapping to JSON data."""
    if isinstance(message, dict):
        return message
    return message.model_dump(mode="json", exclude_none=True)


def serialize_messages(messages: list) -> list[dict]:
    """Convert a complete chat transcript to JSON-serializable messages."""
    return [serialize_message(message) for message in messages]


def read_lines(file_path: str | None, fmt: str, limit: int | None) -> list[str]:
    source = open(file_path) if file_path else sys.stdin
    try:
        lines = [parsed for raw in source if (parsed := parse_line(raw, fmt))]
    finally:
        if file_path:
            source.close()
    return lines[:limit] if limit else lines


class LogFeeder:
    """Hands out the log lines one batch at a time, tracking what was shown."""

    def __init__(self, lines: list[str], batch_size: int):
        self.lines = lines
        self.batch_size = batch_size
        self.cursor = 0

    @property
    def exhausted(self) -> bool:
        return self.cursor >= len(self.lines)

    @property
    def shown(self) -> list[str]:
        return self.lines[: self.cursor]

    def next_batch(self) -> str:
        if self.exhausted:
            return (
                "No more logs available — this is everything there is. "
                "Give your verdict now, without calling any tool."
            )
        start = self.cursor
        batch = self.lines[start : start + self.batch_size]
        self.cursor += len(batch)
        body = "\n".join(f"{start + i}: {line}" for i, line in enumerate(batch))
        remaining = len(self.lines) - self.cursor
        return f"Log lines {start}-{self.cursor - 1} ({remaining} still unseen):\n{body}"


NUDGE = (
    "Unseen log lines remain and an attack can span batches — call "
    "request_more_logs() and keep reading before you commit to a verdict."
)


def run_analyst(
    model: str,
    feeder: LogFeeder,
    vendor: str,
    max_steps: int,
    allow_early_verdict: bool,
    verbose: bool,
) -> tuple[list[dict], str, list[dict], list[dict]]:
    """Drive the analyst until it answers without calling a tool.

    Unless allow_early_verdict is set, an answer given while log lines are
    still unseen is pushed back — the model reliably stops reading early
    when only the prompt tells it not to.

    Returns (messages, final free-text answer, tool-call trace, loop trace).
    """

    def request_more_logs() -> str:
        """Fetch the next batch of log lines from the stream.

        Call this when the logs seen so far are not enough to decide.
        """
        return feeder.next_batch()

    def lookup_schema(field: str, vendor: str = vendor) -> str:
        """Resolve a generic log field name to a concrete SIEM table and column.

        Args:
            field: Generic field name, e.g. TargetUserName, SourceIP, DeviceName.
            vendor: Target SIEM vendor, e.g. defender or wazuh.
        """
        result = get_log_schema(field, vendor)
        if result is None:
            return json.dumps({"error": f"no '{vendor}' mapping for '{field}'", "known_fields": list(SCHEMA)})
        return json.dumps(result)

    tools = {"request_more_logs": request_more_logs, "lookup_schema": lookup_schema}
    initial_batch = feeder.next_batch()
    messages = [
        {"role": "system", "content": ANALYST_SYSTEM_PROMPT},
        {"role": "user", "content": initial_batch},
    ]
    trace = []
    loop_trace = [
        {
            "event": "initial_batch",
            "lines_shown": len(feeder.shown),
            "content": initial_batch,
        }
    ]

    for step in range(max_steps):
        response = chat(model=model, messages=messages, tools=list(tools.values()), options={"temperature": 0, "seed": 0})
        messages.append(response.message)
        calls = response.message.tool_calls or []
        if not calls:
            if feeder.exhausted or allow_early_verdict:
                loop_trace.append(
                    {
                        "event": "verdict_accepted",
                        "step": step,
                        "lines_shown": len(feeder.shown),
                        "response": serialize_message(response.message),
                    }
                )
                return messages, response.message.content or "", trace, loop_trace
            unseen = len(feeder.lines) - feeder.cursor
            if verbose:
                print(f"[step {step}] early verdict rejected, {unseen} line(s) unseen", file=sys.stderr)
            loop_trace.append(
                {
                    "event": "early_verdict_rejected",
                    "step": step,
                    "lines_shown": len(feeder.shown),
                    "lines_unseen": unseen,
                    "response": serialize_message(response.message),
                    "nudge": NUDGE,
                }
            )
            messages.append({"role": "user", "content": NUDGE})
            continue

        for call in calls:
            name = call.function.name
            args = dict(call.function.arguments or {})
            fn = tools.get(name)
            if fn is None:
                result = json.dumps({"error": f"unknown tool '{name}'", "known_tools": list(tools)})
            else:
                try:
                    result = fn(**args)
                except Exception as e:  # bad args from the model shouldn't kill the run
                    result = json.dumps({"error": f"{type(e).__name__}: {e}"})
            tool_event = {"step": step, "tool": name, "args": args, "result": result}
            trace.append(tool_event)
            loop_trace.append({"event": "tool_call", **tool_event})
            if verbose:
                preview = result if len(result) < 200 else result[:200] + "..."
                print(f"[step {step}] {name}({args}) -> {preview}", file=sys.stderr)
            messages.append({"role": "tool", "tool_name": name, "content": result})

    loop_trace.append(
        {
            "event": "max_steps_exhausted",
            "max_steps": max_steps,
            "lines_shown": len(feeder.shown),
        }
    )
    return messages, "", trace, loop_trace


def extract_verdict(model: str, messages: list[dict]) -> tuple[dict, list[dict]]:
    # This is the final analyst call. Unload the model as soon as the response
    # completes so it cannot remain resident while the verifier is running.
    request = {"role": "user", "content": VERDICT_EXTRACT_PROMPT}
    response = chat(
        model=model,
        messages=messages + [request],
        format=VERDICT_SCHEMA,
        options={"temperature": 0, "seed": 0},
        keep_alive=0,
    )
    transcript = [request, serialize_message(response.message)]
    return json.loads(response.message.content), transcript


def verify(model: str, verdict: dict, feeder: LogFeeder) -> tuple[dict, list[dict]]:
    shown = feeder.shown
    messages = [
        {"role": "system", "content": VERIFIER_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": VERIFIER_USER_TEMPLATE.format(
                shown=len(shown),
                total=len(feeder.lines),
                logs="\n".join(f"{i}: {line}" for i, line in enumerate(shown)),
                verdict=json.dumps(verdict, indent=2),
            ),
        },
    ]
    response = chat(
        model=model,
        messages=messages,
        format=VERIFICATION_SCHEMA,
        options={"temperature": 0, "seed": 0},
        keep_alive=0,
    )
    transcript = messages + [serialize_message(response.message)]
    return json.loads(response.message.content), transcript


def report(verdict: dict, verification: dict, feeder: LogFeeder, trace: list[dict]) -> None:
    tool_counts = {}
    for entry in trace:
        tool_counts[entry["tool"]] = tool_counts.get(entry["tool"], 0) + 1
    print("\n=== verdict ===")
    print(f"incident:    {verdict['incident']}")
    print(f"severity:    {verdict['severity']}")
    print(f"attack type: {verdict['attack_type']}")
    print(f"reasoning:   {verdict['reasoning']}")
    print("evidence:")
    for item in verdict["evidence"]:
        print(f"  - {item}")

    print("\n=== verification ===")
    print(f"agreement: {verification['agreement']}  score: {verification['score']}/5")
    print(f"reasoning: {verification['reasoning']}")
    for label, key in (("unsupported claims", "unsupported_claims"), ("missed signals", "missed_signals")):
        items = verification.get(key) or []
        print(f"{label}: {'none' if not items else ''}")
        for item in items:
            print(f"  - {item}")

    print("\n=== loop ===")
    print(f"log lines shown: {len(feeder.shown)}/{len(feeder.lines)}")
    print(f"tool calls: {sum(tool_counts.values())} ({', '.join(f'{k}={v}' for k, v in tool_counts.items()) or 'none'})")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("file", nargs="?", help="Log file to read (default: stdin)")
    parser.add_argument("--format", choices=["log", "jsonl"], default="log", help="Input format (default: log)")
    parser.add_argument("-n", "--limit", type=int, help="Only use the first N log lines (default: all)")
    parser.add_argument("--batch-size", type=int, default=10, help="Log lines handed over per batch (default: 10)")
    parser.add_argument("--model", default=ANALYST_MODEL, help=f"Analyst model, must support tool calling (default: {ANALYST_MODEL})")
    parser.add_argument("--verify-model", default=VERIFIER_MODEL, help=f"Verifier model, should differ from --model (default: {VERIFIER_MODEL})")
    parser.add_argument("--vendor", default="defender", help="Default SIEM vendor for schema lookups (default: defender)")
    parser.add_argument("--max-steps", type=int, default=15, help="Max analyst turns before giving up on a verdict (default: 15)")
    parser.add_argument(
        "--allow-early-verdict",
        action="store_true",
        help="Let the analyst conclude while log lines are still unseen (default: push it back until the stream is drained)",
    )
    parser.add_argument("--output", "-o", help="Write a reconstructable run artifact (logs, transcripts, traces, results) as JSON here")
    parser.add_argument("--verbose", action="store_true", help="Print each tool call to stderr as it fires")
    args = parser.parse_args()

    if args.verify_model == args.model:
        print(f"WARNING: verifier '{args.verify_model}' is the same model as the analyst — it is checking its own work.", file=sys.stderr)

    lines = read_lines(args.file, args.format, args.limit)
    if not lines:
        parser.error("no log lines to triage")

    feeder = LogFeeder(lines, args.batch_size)
    print(f"Triaging {len(lines)} line(s) in batches of {args.batch_size}: {args.model} -> {args.verify_model}", file=sys.stderr)

    messages, answer, trace, loop_trace = run_analyst(
        args.model, feeder, args.vendor, args.max_steps, args.allow_early_verdict, args.verbose
    )
    if not answer:
        print(f"ERROR: analyst hit --max-steps ({args.max_steps}) without reaching a verdict "
              f"({len(feeder.shown)}/{len(lines)} lines seen)", file=sys.stderr)
        return 1

    verdict, extraction_transcript = extract_verdict(args.model, messages)
    verification, verifier_transcript = verify(args.verify_model, verdict, feeder)
    report(verdict, verification, feeder, trace)

    if args.output:
        run = {
            "run_format_version": 1,
            "analyst_model": args.model,
            "verifier_model": args.verify_model,
            "lines_total": len(lines),
            "lines_shown": len(feeder.shown),
            "batch_size": args.batch_size,
            "allow_early_verdict": args.allow_early_verdict,
            "input": {
                "file": args.file,
                "format": args.format,
                "limit": args.limit,
                "logs": lines,
            },
            "configuration": {
                "vendor": args.vendor,
                "max_steps": args.max_steps,
                "analyst": {
                    "model": args.model,
                    "options": {"temperature": 0, "seed": 0},
                    "tools": ["request_more_logs", "lookup_schema"],
                },
                "verdict_extraction": {
                    "model": args.model,
                    "options": {"temperature": 0, "seed": 0},
                    "keep_alive": 0,
                    "format": VERDICT_SCHEMA,
                },
                "verifier": {
                    "model": args.verify_model,
                    "options": {"temperature": 0, "seed": 0},
                    "keep_alive": 0,
                    "format": VERIFICATION_SCHEMA,
                },
            },
            "prompts": {
                "analyst_system": ANALYST_SYSTEM_PROMPT,
                "early_verdict_nudge": NUDGE,
                "verdict_extraction": VERDICT_EXTRACT_PROMPT,
                "verifier_system": VERIFIER_SYSTEM_PROMPT,
                "verifier_user_template": VERIFIER_USER_TEMPLATE,
            },
            "shown_logs": feeder.shown,
            "analyst_transcript": serialize_messages(messages),
            "loop_trace": loop_trace,
            "tool_trace": trace,
            "analyst_answer": answer,
            "verdict_extraction_transcript": extraction_transcript,
            "verdict": verdict,
            "verifier_transcript": verifier_transcript,
            "verification": verification,
        }
        with open(args.output, "w") as f:
            json.dump(run, f, indent=2)
        print(f"\nWrote run to {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
