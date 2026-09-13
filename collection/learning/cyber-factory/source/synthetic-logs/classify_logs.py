#!/usr/bin/env python3
"""Classify syslog lines (severity/service/summary) via a local Ollama model.

Example:
    uv run synthetic-logs/generate_syslog.py -n 20 --format jsonl -o /tmp/sample.jsonl
    uv run synthetic-logs/classify_logs.py /tmp/sample.jsonl --format jsonl --schema-mode param
    uv run synthetic-logs/classify_logs.py /tmp/sample.jsonl --format jsonl --model gemma3:4b --verbose
"""
import json
import argparse
import sys
from ollama import chat

MODEL = "gemma3:1b"

# Approach A: schema spelled out in the prompt text; format="json" only
# guarantees syntactically valid JSON, not this particular shape.
PROMPT_SCHEMA_IN_PROMPT = (
    "You are a sernior expert syslog analyst. Classify the following syslog line. "
    "Respond with ONLY a JSON object (no markdown, no commentary) with exactly these keys: "
    '"severity" (one of: info/warning/error/critical), "service" (string), '
    '"summary" (one-sentence string). '
    "Be concise.\n\nLog line: {line}"
)

# Approach B: schema passed via the ollama `format` param (structured
# outputs) instead, so the prompt doesn't need to describe field shapes.
PROMPT_SCHEMA_IN_PARAM = (
    "You are a sernior expert syslog analyst. Classify the following syslog line: "
    "its severity, the service it came from, and a one-sentence summary. "
    "Be concise.\n\nLog line: {line}"
)

SCHEMA = {
    "type": "object",
    "properties": {
        "severity": {"type": "string", "enum": ["info", "warning", "error", "critical"]},
        "service": {"type": "string"},
        "summary": {"type": "string"},
    },
    "required": ["severity", "service", "summary"],
}


def parse_line(line: str, fmt: str) -> str:
    line = line.strip()
    if not line:
        return None
    if fmt == "jsonl":
        try:
            record = json.loads(line)
            return record.get("message") or line
        except json.JSONDecodeError:
            return line
    return line


def classify(line: str, schema_mode: str, model: str = MODEL):
    if schema_mode == "param":
        prompt = PROMPT_SCHEMA_IN_PARAM
        fmt = SCHEMA
    else:
        prompt = PROMPT_SCHEMA_IN_PROMPT
        fmt = "json"

    return chat(
        model=model,
        messages=[{"role": "user", "content": prompt.format(line=line)}],
        format=fmt,
        options={"temperature": 0, "seed": 0},
    )


def print_usage(response) -> None:
    ns_to_ms = lambda ns: ns / 1e6 if ns is not None else None
    prompt_tokens = response.prompt_eval_count
    output_tokens = response.eval_count
    eval_duration_s = (response.eval_duration or 0) / 1e9

    print("--- usage ---", file=sys.stderr)
    print(f"model: {response.model}", file=sys.stderr)
    print(f"prompt tokens: {prompt_tokens}", file=sys.stderr)
    print(f"output tokens: {output_tokens}", file=sys.stderr)
    if output_tokens and eval_duration_s:
        print(f"generation speed: {output_tokens / eval_duration_s:.1f} tok/s", file=sys.stderr)
    print(f"load duration: {ns_to_ms(response.load_duration):.1f} ms", file=sys.stderr)
    print(f"prompt eval duration: {ns_to_ms(response.prompt_eval_duration):.1f} ms", file=sys.stderr)
    print(f"generation duration: {ns_to_ms(response.eval_duration):.1f} ms", file=sys.stderr)
    print(f"total duration: {ns_to_ms(response.total_duration):.1f} ms", file=sys.stderr)
    print(f"done reason: {response.done_reason}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Classify syslog lines with gemma3:1b via Ollama")
    parser.add_argument("file", nargs="?", help="Log file to read (default: stdin)")
    parser.add_argument("--format", choices=["log", "jsonl"], default="log", help="Input format (default: log)")
    parser.add_argument(
        "--schema-mode",
        choices=["prompt", "param"],
        default="prompt",
        help="Where the JSON schema is enforced: in the prompt text ('prompt', default) "
        "or via ollama's structured-output format param ('param')",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print model usage metadata (tokens, durations, tok/s) to stderr for each line",
    )
    parser.add_argument("--model", default=MODEL, help=f"Ollama model to use (default: {MODEL})")
    args = parser.parse_args()

    source = open(args.file) if args.file else sys.stdin

    try:
        for raw_line in source:
            line = parse_line(raw_line, args.format)
            if not line:
                continue
            print(f"\n>>> {line}")
            response = classify(line, args.schema_mode, model=args.model)
            result = response.message.content
            try:
                print(json.dumps(json.loads(result), indent=2))
            except json.JSONDecodeError:
                print("WARNING: model did not return valid JSON", file=sys.stderr)
                print(result)
            if args.verbose:
                print_usage(response)
            print("-" * 60)
    finally:
        if args.file:
            source.close()


if __name__ == "__main__":
    main()
