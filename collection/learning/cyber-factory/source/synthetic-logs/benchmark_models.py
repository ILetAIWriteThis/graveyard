#!/usr/bin/env python3
"""Run the same classification prompt across multiple Ollama models and
record performance + JSON-validity metrics for comparison.

Reuses classify()/parse_line() from classify_logs.py so both scripts stay
in sync on prompt/schema behavior.

Example:
    uv run synthetic-logs/generate_syslog.py -n 20 --format jsonl -o /tmp/sample.jsonl
    uv run synthetic-logs/benchmark_models.py /tmp/sample.jsonl --format jsonl \\
        --models gemma3:270m,gemma3:1b,gemma3:4b -n 20 -o synthetic-logs/benchmark_results.csv
    uv run synthetic-logs/benchmark_models.py /tmp/sample.jsonl --format jsonl \\
        --models gemma3:270m,gemma3:1b --judge-model gemma3:4b -n 20
"""
import argparse
import csv
import json
import sys
import time

from ollama import chat

from classify_logs import classify, parse_line

FIELDNAMES = [
    "model",
    "line_index",
    "log_line",
    "error",
    "valid_json",
    "severity",
    "service",
    "summary",
    "prompt_tokens",
    "output_tokens",
    "load_duration_ms",
    "prompt_eval_duration_ms",
    "eval_duration_ms",
    "total_duration_ms",
    "wall_clock_ms",
    "tokens_per_sec",
    "done_reason",
    "judge_model",
    "judge_verdict",
    "judge_score",
    "judge_reasoning",
    "judge_error",
    "judge_wall_clock_ms",
]

JUDGE_SYSTEM_PROMPT = (
    "You are a strict, skeptical senior SOC analyst acting as a QA judge. "
    "You will be shown a raw syslog line and another AI model's classification of it "
    "(severity, service, summary). Critically evaluate whether that classification is "
    "accurate and grounded ONLY in evidence present in the log line itself — no more, no less. "
    "Be skeptical of overclaiming (e.g. calling a routine, successful event malicious or "
    "critical with no evidence of that in the line) and of underclaiming (missing a real "
    "security-relevant signal that IS in the line). If the classification is not valid JSON "
    "or is missing required fields, that alone makes it incorrect."
)

JUDGE_USER_TEMPLATE = (
    "Log line:\n{line}\n\n"
    "Model's classification output (raw, may or may not be valid JSON):\n{candidate_output}\n\n"
    "Respond with ONLY a JSON object (no markdown, no commentary) with exactly these keys: "
    '"verdict" (one of: correct/partially_correct/incorrect), '
    '"score" (integer 1-5, 5 = excellent, 1 = badly wrong), '
    '"reasoning" (one concise sentence citing specific evidence from the log line).'
)

JUDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["correct", "partially_correct", "incorrect"]},
        "score": {"type": "integer", "minimum": 1, "maximum": 5},
        "reasoning": {"type": "string"},
    },
    "required": ["verdict", "score", "reasoning"],
}


def judge(judge_model: str, line: str, candidate_output: str) -> dict:
    response = chat(
        model=judge_model,
        messages=[
            {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
            {"role": "user", "content": JUDGE_USER_TEMPLATE.format(line=line, candidate_output=candidate_output)},
        ],
        format=JUDGE_SCHEMA,
        options={"temperature": 0, "seed": 0},
    )
    return json.loads(response.message.content)


def ns_to_ms(ns):
    return round(ns / 1e6, 1) if ns is not None else None


def read_lines(file_path: str, fmt: str, limit: int | None) -> list[str]:
    source = open(file_path) if file_path else sys.stdin
    try:
        lines = []
        for raw_line in source:
            line = parse_line(raw_line, fmt)
            if line:
                lines.append(line)
        return lines[:limit] if limit else lines
    finally:
        if file_path:
            source.close()


def run_one(model: str, schema_mode: str, index: int, line: str, judge_model: str | None = None) -> dict:
    row = {"model": model, "line_index": index, "log_line": line}
    start = time.perf_counter()
    try:
        response = classify(line, schema_mode, model=model)
    except Exception as e:
        row["error"] = str(e)
        row["wall_clock_ms"] = round((time.perf_counter() - start) * 1000, 1)
        return row
    wall_clock_ms = round((time.perf_counter() - start) * 1000, 1)

    result = response.message.content
    try:
        parsed = json.loads(result)
        row["valid_json"] = True
        row["severity"] = parsed.get("severity")
        row["service"] = parsed.get("service")
        row["summary"] = parsed.get("summary")
    except json.JSONDecodeError:
        row["valid_json"] = False

    output_tokens = response.eval_count
    eval_duration_s = (response.eval_duration or 0) / 1e9

    row["prompt_tokens"] = response.prompt_eval_count
    row["output_tokens"] = output_tokens
    row["load_duration_ms"] = ns_to_ms(response.load_duration)
    row["prompt_eval_duration_ms"] = ns_to_ms(response.prompt_eval_duration)
    row["eval_duration_ms"] = ns_to_ms(response.eval_duration)
    row["total_duration_ms"] = ns_to_ms(response.total_duration)
    row["wall_clock_ms"] = wall_clock_ms
    row["tokens_per_sec"] = round(output_tokens / eval_duration_s, 1) if output_tokens and eval_duration_s else None
    row["done_reason"] = response.done_reason

    if judge_model:
        row["judge_model"] = judge_model
        judge_start = time.perf_counter()
        try:
            verdict = judge(judge_model, line, result)
            row["judge_verdict"] = verdict.get("verdict")
            row["judge_score"] = verdict.get("score")
            row["judge_reasoning"] = verdict.get("reasoning")
        except Exception as e:
            row["judge_error"] = str(e)
        row["judge_wall_clock_ms"] = round((time.perf_counter() - judge_start) * 1000, 1)

    return row


def summarize(rows: list[dict], models: list[str], judged: bool) -> None:
    print("\n=== summary ===")
    header = f"{'model':<20} {'n':>4} {'errors':>7} {'json_ok%':>9} {'avg_tok/s':>10} {'avg_total_ms':>13} {'avg_wall_ms':>12}"
    if judged:
        header += f" {'avg_judge':>10} {'judge_ok%':>10}"
    print(header)
    print("-" * len(header))
    for model in models:
        model_rows = [r for r in rows if r["model"] == model]
        n = len(model_rows)
        errors = sum(1 for r in model_rows if r.get("error"))
        ok_rows = [r for r in model_rows if not r.get("error")]
        valid = sum(1 for r in ok_rows if r.get("valid_json"))
        json_pct = (valid / len(ok_rows) * 100) if ok_rows else 0.0
        tok_speeds = [r["tokens_per_sec"] for r in ok_rows if r.get("tokens_per_sec")]
        total_ms = [r["total_duration_ms"] for r in ok_rows if r.get("total_duration_ms")]
        wall_ms = [r["wall_clock_ms"] for r in ok_rows if r.get("wall_clock_ms")]
        avg_tok = sum(tok_speeds) / len(tok_speeds) if tok_speeds else 0.0
        avg_total = sum(total_ms) / len(total_ms) if total_ms else 0.0
        avg_wall = sum(wall_ms) / len(wall_ms) if wall_ms else 0.0
        line = f"{model:<20} {n:>4} {errors:>7} {json_pct:>8.1f}% {avg_tok:>10.1f} {avg_total:>13.1f} {avg_wall:>12.1f}"
        if judged:
            judge_scores = [r["judge_score"] for r in ok_rows if r.get("judge_score") is not None]
            judged_rows = [r for r in ok_rows if r.get("judge_verdict") is not None]
            judge_correct = sum(1 for r in judged_rows if r.get("judge_verdict") == "correct")
            avg_judge = sum(judge_scores) / len(judge_scores) if judge_scores else 0.0
            judge_ok_pct = (judge_correct / len(judged_rows) * 100) if judged_rows else 0.0
            line += f" {avg_judge:>10.2f} {judge_ok_pct:>9.1f}%"
        print(line)


def main():
    parser = argparse.ArgumentParser(description="Benchmark multiple Ollama models on the same log-classification prompt")
    parser.add_argument("file", nargs="?", help="Log file to read (default: stdin)")
    parser.add_argument("--models", required=True, help="Comma-separated Ollama model names to compare")
    parser.add_argument("--format", choices=["log", "jsonl"], default="log", help="Input format (default: log)")
    parser.add_argument(
        "--schema-mode",
        choices=["prompt", "param"],
        default="param",
        help="Schema enforcement mode passed to classify() (default: param)",
    )
    parser.add_argument("-n", "--limit", type=int, help="Only use the first N log lines (default: all)")
    parser.add_argument("--output", "-o", default="benchmark_results.csv", help="CSV file for per-call results")
    parser.add_argument(
        "--judge-model",
        help="If set, send each classification to this Ollama model to critically grade it "
        "(verdict/score/reasoning). Should normally differ from every model in --models.",
    )
    args = parser.parse_args()

    models = [m.strip() for m in args.models.split(",") if m.strip()]
    lines = read_lines(args.file, args.format, args.limit)
    if not lines:
        parser.error("no log lines to classify")

    if args.judge_model and args.judge_model in models:
        print(
            f"WARNING: judge model '{args.judge_model}' is also being benchmarked — "
            "it will grade its own output on those rows.",
            file=sys.stderr,
        )

    total_calls = len(models) * len(lines) * (2 if args.judge_model else 1)
    print(f"Benchmarking {len(models)} model(s) x {len(lines)} line(s) = {total_calls} calls", file=sys.stderr)

    rows = []
    for model in models:
        print(f"\n--- {model} ---", file=sys.stderr)
        for index, line in enumerate(lines):
            row = run_one(model, args.schema_mode, index, line, judge_model=args.judge_model)
            rows.append(row)
            if row.get("error"):
                print(f"[{index}] ERROR: {row['error']}", file=sys.stderr)
                continue
            msg = (
                f"[{index}] {row.get('tokens_per_sec', '?')} tok/s, "
                f"{row.get('total_duration_ms', '?')} ms, "
                f"valid_json={row.get('valid_json')}"
            )
            if args.judge_model:
                if row.get("judge_error"):
                    msg += f", judge_error={row['judge_error']}"
                else:
                    msg += f", judge={row.get('judge_verdict')} ({row.get('judge_score')}/5)"
            print(msg, file=sys.stderr)

    with open(args.output, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nWrote {len(rows)} rows to {args.output}", file=sys.stderr)

    summarize(rows, models, judged=bool(args.judge_model))


if __name__ == "__main__":
    main()
