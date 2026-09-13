#!/usr/bin/env python3
"""Minimal log -> tool-call -> local model triage loop.

Feeds one synthetic log line to a local Ollama model with get_log_schema
(from schema-translator/) exposed as a tool call, so the model can resolve
the log's generic field into a real schema mapping before giving a
verdict. Proves the tool-calling loop actually fires the tool rather than
the model hallucinating a table/column.

Example:
    uv run local-agent/triage_loop.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "schema-translator"))
from schema_translator import get_log_schema  # noqa: E402

from ollama import chat

MODEL = "qwen2.5:7b"  # gemma3 (any size) doesn't support tool-calling in Ollama

LOG_LINE = (
    "2026-08-18T09:12:44Z lab-dc01 Microsoft-Windows-Security-Auditing: "
    "An account's password was reset. Account: LAB-COMPUTER$ Domain: EXAMPLE "
    "Performed by: service-account"
)

SYSTEM_PROMPT = (
    "You are a SOC triage analyst. Given a raw log line, decide whether you "
    "need the SIEM's real schema to investigate further. If so, call "
    "get_log_schema with the generic field name that best matches what the "
    "log describes (e.g. MachineAccountPasswordReset). Then give a short "
    "verdict: severity (info/suspicious/critical), one-sentence reasoning, "
    "and the exact table/column you resolved via the tool."
)


def main():
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": LOG_LINE},
    ]

    response = chat(model=MODEL, messages=messages, tools=[get_log_schema])
    messages.append(response.message)

    tool_calls = response.message.tool_calls or []
    if not tool_calls:
        print("[no tool call made]")
        print(response.message.content)
        return

    for call in tool_calls:
        args = call.function.arguments
        result = get_log_schema(**args)
        print(f"[tool call] get_log_schema({dict(args)}) -> {result}")
        messages.append({
            "role": "tool",
            "tool_name": call.function.name,
            "content": str(result),
        })

    final = chat(model=MODEL, messages=messages)
    print("\n[verdict]")
    print(final.message.content)


if __name__ == "__main__":
    main()
