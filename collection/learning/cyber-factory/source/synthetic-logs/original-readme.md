# synthetic-logs

First slice of the synthetic-first loop described in the repo README: generate fake syslog, run it through an agent, get a triage verdict.

Ported over from an earlier `everything/domains/ai-ml/ollama/syslog-generator/` experiment — kept as-is for now, will diverge as this becomes SOC-specific rather than general desktop-syslog noise.

## Scripts

- `generate_syslog.py` — CLI entrypoint. Picks a category (weighted) and writes its output as `log` or `jsonl` lines.
- `log_categories/` — one module per log category, registered in `log_categories/__init__.py`:
  - `desktop.py` — generic desktop/service noise (gnome, systemd, NetworkManager, dbus, snapd, cron, sudo, kernel UFW blocks, etc).
  - `ssh.py` — SSH-specific events: normal logins/sessions/disconnects, plus a brute-force burst pattern (same attacker IP + target user repeated across several consecutive `Invalid user` / `Failed password` lines, ending in a "max attempts exceeded" / connection-closed line). Bursts fire ~15% of the time an SSH event is picked (`BRUTE_FORCE_CHANCE` in `ssh.py`).
  - `rdp.py` — RDP-specific events modeled on xrdp/xrdp-sesman logs: normal connections/sessions/disconnects, plus the same brute-force burst pattern as `ssh.py` (same attacker IP + target user repeated across consecutive failed-login lines, ending in a "max attempts exceeded" line). Bursts fire ~15% of the time an RDP event is picked (`BRUTE_FORCE_CHANCE` in `rdp.py`).
  - `auth.py` — centralized auth/identity-service (SSO/IdP-style) events: logins, MFA challenges, password resets/changes, session/device housekeeping, plus a credential-stuffing/password-spray burst (fixed attacker IP, *varying* username per attempt — unlike the ssh/rdp fixed-user pattern — ending in a rate-limit/anomaly line). Bursts fire ~15% of the time (`SPRAY_CHANCE` in `auth.py`).
  - `ndr.py` — fake Zeek-style connection, DNS, and TLS records. Most picks are benign single lines; ~15% produce a correlated TCP port-scan or DNS-beacon burst ending in a synthetic Suricata alert or Zeek notice. It only writes text: documentation-only IP ranges and reserved domains are used, with no packets or network access.
  - `web.py` — nginx-style access/error-log events: normal traffic noise (200s, static assets, health checks, occasional 404/500), plus a vulnerability-scan/path-enumeration burst (same attacker IP hitting several sensitive/exploit-probe paths — `.env`, `.git/config`, SQLi/XSS payloads, path traversal — ending in a rate-limit/WAF-block line). Bursts fire ~15% of the time (`SCAN_CHANCE` in `web.py`).
  - `common.py` — shared placeholder-filling helpers (`{src_ip}`, `{user}`, `{rdns_host}`, etc) used by every category.
  - `base.py` — the `LogCategory` interface (`name`, `weight`, `sample()`).

  **Adding a category**: create `log_categories/<name>.py` exposing a module-level `CATEGORY = LogCategory(name=..., weight=..., sample=...)` where `sample()` returns a list of `(service, pid, message)` tuples (usually length 1, more for multi-line bursts). Register it in `log_categories/__init__.py`'s `CATEGORIES` dict. Use `--categories <name>[,<name>...]` to generate from a subset (e.g. `--categories ssh`).
- `scenarios/` — multi-stage attack chains injected *through* the noise stream, one module per scenario:
  - `ssh_intrusion.py` — cross-source SSH intrusion in six stages: port-scan recon (paired UFW and Zeek records plus a Suricata alert) → SSH brute force → successful login (paired sshd and Zeek records) → `sudo` privilege escalation → persistence (backdoor `svc-backup` root user, cron replace, new systemd unit) → C2 beacon (paired CRON, UFW, and Zeek records). Every stage reuses one attacker IP and target host; post-foothold stages also reuse the compromised account.
  - `base.py` — the `Stage` (a named group of consecutive events) and `Scenario` (`name`, `description`, `build()`) types.

  Unlike a category burst, a scenario is *spread across the run*: stages land in the middle 80% of the stream, evenly spaced with jitter, with unrelated noise (including decoy bursts from other IPs) in between. Scenario builders own the shared entities (IPs, users, hosts) and render them into each source's native-looking message; categories remain independent background-noise generators. The chain can only be caught by correlating identities across lines and sources — which is exactly what per-line classification can't do and `local-agent/multiloop.py` is built to test.

  **Adding a scenario**: create `scenarios/<name>.py` exposing `build() -> list[Stage]` plus `SCENARIO_NAME`/`DESCRIPTION`, then register it in `scenarios/__init__.py`. Use `--scenario <name>` to inject it, `--list-scenarios` to see what's available. The generator refuses to run if `-n` is under twice the chain's own line count, since the chain would be truncated rather than spread.
- `classify_logs.py` — reads log lines and classifies each one (severity / service / summary) via a local Ollama model (`--model`, default `gemma3:1b`). Two schema-enforcement modes: JSON described in the prompt text, or via Ollama's structured-output `format` param (see notes below).
- `benchmark_models.py` — runs the same classification prompt across multiple Ollama models on the same log lines and compares them: JSON-validity rate, tokens/sec, total duration (from Ollama's own usage stats) and independently-measured wall-clock time. Writes one row per call to a CSV plus a summary table per model. Reuses `classify()`/`parse_line()` from `classify_logs.py` so both scripts stay in sync.

  **`--judge-model <model>`** (optional): sends each candidate model's raw classification output, plus the original log line, to a separate model with a system prompt that casts it as a strict, skeptical SOC QA judge — instructed to check the verdict is grounded *only* in evidence present in the line (no overclaiming severity on routine events, no missing real signals), and returns `{"verdict": correct/partially_correct/incorrect, "score": 1-5, "reasoning": "..."}`. Adds `judge_*` columns to the CSV and an `avg_judge`/`judge_ok%` pair to the summary table. Should be a different (ideally stronger) model than the ones being benchmarked, or it's grading its own homework — the script warns if `--judge-model` also appears in `--models`.

Both run through the repo's `uv` venv — see root `pyproject.toml`. `classify_logs.py`/`benchmark_models.py` additionally need a local Ollama daemon running with the target model(s) pulled (`ollama pull <model>`); Ollama itself is treated as a pre-existing host tool here, not something this project installs.

## Usage

```bash
# from repo root
uv run synthetic-logs/generate_syslog.py -n 50 --format jsonl -o /tmp/sample.jsonl

# generate only synthetic NDR-style text records
uv run synthetic-logs/generate_syslog.py -n 30 --categories ndr --format jsonl
uv run synthetic-logs/classify_logs.py /tmp/sample.jsonl --format jsonl --schema-mode param

# generate a multi-stage attack chain spread through the noise
uv run synthetic-logs/generate_syslog.py --list-scenarios
uv run synthetic-logs/generate_syslog.py -n 70 --scenario ssh_intrusion --format jsonl -o /tmp/chain.jsonl

# compare models on the same log lines
uv run synthetic-logs/benchmark_models.py /tmp/sample.jsonl --format jsonl \
  --models gemma3:270m,gemma3:1b,gemma3:4b -n 20 -o synthetic-logs/benchmark_results.csv

# ...with a bigger model grading each classification's quality
uv run synthetic-logs/benchmark_models.py /tmp/sample.jsonl --format jsonl \
  --models gemma3:270m,gemma3:1b --judge-model gemma3:4b -n 20
```

## Known quirks (carried over from the original experiment)

- Small model (`gemma3:1b`) occasionally degenerates into repeated garbage/emoji tokens instead of stopping cleanly — not yet root-caused.
- `--schema-mode param` (Ollama's structured-output `format`) uses noticeably fewer prompt tokens than spelling the schema out in the prompt text, for the same enforcement guarantee.
- The LLM-as-judge is itself an LLM opinion, not ground truth — treat `judge_score`/`judge_verdict` as a second (stronger-model) opinion to spot obvious quality problems, not an authoritative grade. First real run (`gemma3:4b` judging `gemma3:270m`/`gemma3:1b` on SSH lines) consistently caught both smaller models overclaiming severity — e.g. marking a routine successful SSH session-open as `critical` — which lines up with the false-positive behavior already noted from manual spot-checks.

## Where this is thin (next steps)

- One scenario so far (`ssh_intrusion`) — no lateral-movement, phishing, or web-shell chains, and no way to run two overlapping chains at once.
- Scenarios carry no ground-truth answer key, so scoring a verdict against "what actually happened" is still manual.
- Classifier only labels one line at a time — no correlation across lines/sessions/bursts, no verdict beyond severity/summary, no "is this an incident" judgment. The cross-line side now lives in `local-agent/multiloop.py`.
- No connection yet to the "attack scenario in a VM" side described in `AGENTS.md`.
