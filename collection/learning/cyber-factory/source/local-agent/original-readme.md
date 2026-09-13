# local-agent

Agents that reason over the synthetic logs, as opposed to `synthetic-logs/`, which only produces them and labels single lines.

## Scripts

- `triage_loop.py` — smallest possible proof that tool-calling fires: one hardcoded log line, one tool (`get_log_schema` from `schema-translator/`), one verdict. Kept as the reference for "does this model actually call the tool, or hallucinate a table name".
- `multiloop.py` — the multi-turn version, and the first thing here that produces an *incident* verdict rather than a per-line label.

## `multiloop.py`

Two models, two jobs.

**Analyst** (`--model`, default `qwen2.5:7b`) sees the log stream one batch at a time and paces itself through tool calls:

- `request_more_logs()` — pull the next batch when the evidence so far is inconclusive.
- `lookup_schema(field, vendor)` — resolve a generic field name to a real SIEM table/column via `schema-translator/`.

The loop ends when the analyst answers without calling a tool. A verdict offered while log lines are still unseen is **pushed back** with a nudge to keep reading — prompting alone doesn't hold: `qwen2.5:7b` stopped at 10/40 lines with the rule stated in the system prompt, and at 20/40 after that rule was sharpened, missing a brute-force burst sitting in a later batch both times. `--allow-early-verdict` turns the push-back off and lets the model stop when it wants. Either way `--max-steps` bounds the run.

The analyst's free-text answer is then squeezed into a JSON verdict (`incident`, `severity`, `attack_type`, `reasoning`, `evidence[]`) by a structured-output call.

**Verifier** (`--verify-model`, default `llama3.1:8b`) is a *different* model — different family, so it doesn't share the analyst's blind spots. It sees only the log lines the analyst was actually shown plus the verdict, and grades it: `agreement`, 1-5 `score`, `unsupported_claims[]`, `missed_signals[]`, `reasoning`. The script warns if the verifier and analyst are the same model, since that's grading its own homework.

The analyst must support tool calling (rules out `gemma3` at any size in Ollama); the verifier only needs structured output.

### Usage

```bash
# from repo root — plain noise
uv run synthetic-logs/generate_syslog.py -n 40 --format jsonl -o /tmp/sample.jsonl
uv run local-agent/multiloop.py /tmp/sample.jsonl --format jsonl

# a real multi-stage intrusion buried in noise
uv run synthetic-logs/generate_syslog.py -n 70 --scenario ssh_intrusion --format jsonl -o /tmp/chain.jsonl
uv run local-agent/multiloop.py /tmp/chain.jsonl --format jsonl --batch-size 14 --verbose \
  -o /tmp/chain_run.json
```

`--output` writes a reconstructable run artifact as JSON: the complete input and shown logs, configuration and prompts, analyst transcript, explicit loop events (including the initial batch, rejected verdicts, and nudges), tool calls, structured-verdict extraction exchange, verifier exchange, and final results.

### Resource notes

- The analyst and verifier are kept strictly sequential. The analyst is unloaded immediately after its final structured-verdict response, before the verifier is called; the verifier is also unloaded immediately after grading. This prevents both models from remaining resident in memory at the same time.

### Known quirks

- The verifier is another LLM opinion, not ground truth. On a plain-noise run `llama3.1:8b` correctly called out `qwen2.5:7b` inventing a "coordinated" attack across two unrelated IPs — but it also listed routine UFW BLOCK lines as "missed signals", which is its own overclaiming.
- Verdict evidence is copied by the model, so it drifts from the log text (paraphrase, wrong port). Fine for reading, not safe to string-match against the source.
- Batches are appended to a growing conversation, so a long stream with a small `--batch-size` runs into context limits before it runs out of logs.
