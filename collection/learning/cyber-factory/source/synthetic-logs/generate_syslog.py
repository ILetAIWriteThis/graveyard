#!/usr/bin/env python3
"""Generate synthetic syslog lines from the log_categories/ registry.

Example:
    uv run synthetic-logs/generate_syslog.py -n 50 --format jsonl -o /tmp/sample.jsonl
    uv run synthetic-logs/generate_syslog.py -n 20 --categories ssh
    uv run synthetic-logs/generate_syslog.py -n 30 --categories ndr --format jsonl
    uv run synthetic-logs/generate_syslog.py -n 80 --scenario ssh_intrusion -o /tmp/chain.log
    uv run synthetic-logs/generate_syslog.py --list-scenarios
"""
import argparse
import json
import random
import sys
from datetime import datetime, timedelta

from log_categories import CATEGORIES, get_categories
from log_categories.base import LogCategory
from log_categories.common import HOSTNAME
from scenarios import SCENARIOS, get_scenario
from scenarios.base import Stage


def make_records(ts: datetime, categories: list[LogCategory]) -> list[dict]:
    category = random.choices(categories, weights=[c.weight for c in categories])[0]
    return [
        {
            "timestamp": ts.isoformat(),
            "hostname": HOSTNAME,
            "service": service,
            "pid": pid,
            "message": message,
        }
        for service, pid, message in category.sample()
    ]


def format_log(record: dict) -> str:
    ts = datetime.fromisoformat(record["timestamp"])
    timestamp = ts.strftime("%b %d %H:%M:%S").replace(" 0", "  ")
    if record["service"] == "kernel":
        return f"{timestamp} {record['hostname']} kernel: {record['message']}"
    return f"{timestamp} {record['hostname']} {record['service']}[{record['pid']}]: {record['message']}"


def plan_stages(count: int, stages: list[Stage]) -> dict[int, Stage]:
    """Spread an attack chain's stages across the run, in order, with jitter.

    Returns {line index at which the stage fires -> stage}. Stages land in
    the middle 80% of the stream so there is always noise before the first
    one and after the last.
    """
    if not stages:
        return {}
    span = max(count - 1, 1)
    slot = span * 0.8 / len(stages)
    positions = []
    for i in range(len(stages)):
        centre = span * 0.1 + slot * (i + 0.5)
        jittered = int(centre + random.uniform(-slot / 4, slot / 4))
        # Keep stages strictly ordered even after jitter.
        positions.append(max(jittered, positions[-1] + 1 if positions else 0))
    return dict(zip(positions, stages))


def stage_records(ts: datetime, stage: Stage) -> list[dict]:
    return [
        {
            "timestamp": ts.isoformat(),
            "hostname": HOSTNAME,
            "service": service,
            "pid": pid,
            "message": message,
        }
        for service, pid, message in stage.events
    ]


def generate(
    count: int,
    start: datetime,
    min_gap: int,
    max_gap: int,
    fmt: str,
    output,
    categories: list[LogCategory],
    stages: list[Stage] | None = None,
):
    ts = start
    written = 0
    planned = plan_stages(count, stages or [])
    pending = []
    while written < count:
        # A scenario stage is atomic: its source-specific records stay adjacent.
        # A stage that became due during the previous stage runs immediately
        # afterward. Background-noise bursts can still be paused for a due stage.
        due_positions = [position for position in planned if position <= written]
        due_position = min(due_positions) if due_positions else None
        is_stage = due_position is not None
        if is_stage:
            records = stage_records(ts, planned.pop(due_position))
        elif pending:
            records = pending
            pending = []
        else:
            records = make_records(ts, categories)

        for i, record in enumerate(records):
            if written >= count:
                break
            if fmt == "jsonl":
                output.write(json.dumps(record) + "\n")
            else:
                output.write(format_log(record) + "\n")
            written += 1
            ts += timedelta(seconds=random.randint(0, 2))
            stage_is_due = any(position <= written for position in planned)
            if not is_stage and stage_is_due and i + 1 < len(records):
                pending = records[i + 1:]
                break
        ts += timedelta(seconds=random.randint(min_gap, max_gap))


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic syslog entries")
    parser.add_argument("-n", "--count", type=int, default=50, help="Number of log lines")
    parser.add_argument("--min-gap", type=int, default=1, help="Min seconds between entries")
    parser.add_argument("--max-gap", type=int, default=60, help="Max seconds between entries")
    parser.add_argument("--format", choices=["log", "jsonl"], default="log", help="Output format (default: log)")
    parser.add_argument("--output", "-o", help="Output file path (default: stdout)")
    parser.add_argument(
        "--categories",
        help=f"Comma-separated categories to include (default: all). Available: {', '.join(CATEGORIES)}",
    )
    parser.add_argument(
        "--scenario",
        help=f"Inject a multi-stage attack chain into the noise. Available: {', '.join(SCENARIOS)}",
    )
    parser.add_argument("--list-scenarios", action="store_true", help="List available attack-chain scenarios and exit")
    args = parser.parse_args()

    if args.list_scenarios:
        for scenario in SCENARIOS.values():
            print(f"{scenario.name}: {scenario.description}")
        return

    stages = None
    if args.scenario:
        try:
            stages = get_scenario(args.scenario).build()
        except ValueError as e:
            parser.error(str(e))
        chain_lines = sum(len(stage.events) for stage in stages)
        if args.count < chain_lines * 2:
            parser.error(
                f"scenario '{args.scenario}' needs {chain_lines} lines of its own; "
                f"use -n {chain_lines * 2} or more so it is spread through noise instead of being truncated"
            )

    category_names = args.categories.split(",") if args.categories else None
    try:
        categories = get_categories(category_names)
    except ValueError as e:
        parser.error(str(e))

    start = datetime.now().replace(microsecond=0)

    if args.output:
        with open(args.output, "w") as f:
            generate(args.count, start, args.min_gap, args.max_gap, args.format, f, categories, stages)
        print(f"Wrote {args.count} entries to {args.output}", file=sys.stderr)
    else:
        generate(args.count, start, args.min_gap, args.max_gap, args.format, sys.stdout, categories, stages)


if __name__ == "__main__":
    main()
