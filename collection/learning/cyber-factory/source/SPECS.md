# cyber-factory

## Background

This is a solution to learn security and AI engineering by building a platform which does security things but with AI help.

## Security Domains

- Operational security
- Adversary Emulation
- SOC services, triage, hunting
- Forensics
- Detection engineering

## AI Domains

- Local models
- Custom harness

## Current State

### Synthetic logs (`synthetic-logs/`)

Generates fake syslog-style log lines across six categories, feeds them through a local Ollama model for classification, and can benchmark multiple models against each other.

- **Log categories** (`log_categories/`, registered in `__init__.py`, one module per category):
    - **SSH** (`ssh.py`) — login/session lifecycle events, plus a brute-force burst (fixed attacker IP + fixed target user repeated across consecutive failed-login lines).
    - **RDP** (`rdp.py`) — xrdp/xrdp-sesman login/session lifecycle events, plus the same fixed-user brute-force burst pattern as SSH.
    - **Desktop/OS** (`desktop.py`) — generic host noise: systemd, NetworkManager, dbus, snapd, cron, sudo, kernel UFW blocks, etc.
    - **Auth service** (`auth.py`) — centralized SSO/IdP-style events: logins, MFA challenges, password resets/changes, session/device housekeeping, plus a credential-stuffing/password-spray burst (fixed attacker IP, *varying* username per attempt).
    - **Web service** (`web.py`) — nginx-style access/error-log noise, plus a vulnerability-scan/path-enumeration burst (fixed attacker IP hitting sensitive/exploit-probe paths — `.env`, `.git/config`, SQLi/XSS payloads, path traversal).
    - **NDR** (`ndr.py`) — synthetic Zeek-style connection, DNS, and TLS telemetry, plus correlated TCP port-scan and DNS-beacon bursts with Suricata/Zeek notice closers. External endpoints use documentation-only IP ranges and reserved domains.
- **Scenarios** (`scenarios/`, registered in `__init__.py`, one module per chain): multi-stage attack chains injected *through* the noise stream rather than as one contiguous burst — stages spread across the middle 80% of the run with unrelated noise (and decoy bursts from other IPs) in between.
    - **ssh_intrusion** (`ssh_intrusion.py`) — cross-source recon (paired UFW/Zeek records plus Suricata alert) → SSH brute force → foothold (paired sshd/Zeek success) → `sudo` privesc → persistence → C2 beacon (paired CRON/UFW/Zeek records). One attacker IP and target host across all stages, one compromised account after the foothold.
- **Generation**: `generate_syslog.py` — weighted category pick, `log` or `jsonl` output, optional `--scenario` injection.
- **Classification**: `classify_logs.py` — per-line severity/service/summary via a local Ollama model (default `gemma3:1b`), two schema-enforcement modes.
- **Benchmarking**: `benchmark_models.py` — compares multiple Ollama models on the same log lines (JSON-validity rate, tokens/sec, wall-clock time), with optional LLM-as-judge scoring.

### Local agent (`local-agent/`)

Agents that reason *across* log lines, where `synthetic-logs/` only labels them one at a time.

- **`triage_loop.py`** — minimal proof that a local model actually fires a tool call (`get_log_schema`) instead of hallucinating a SIEM table name.
- **`multiloop.py`** — multi-turn triage producing an incident verdict, then an independent check of it. The analyst model paces itself through the stream via `request_more_logs()` and `lookup_schema()`; a verdict offered while lines are still unseen is pushed back until the stream is drained (small models stop reading early otherwise). The verdict is then squeezed into JSON and handed to a *different* model, which grades it for unsupported claims and missed signals against only the lines the analyst saw. Whole run (tool trace, verdict, verification) dumps to JSON as the explainability trail.

Stack: Python 3.13, `uv`-managed venv, local Ollama daemon (pre-existing host tool, not installed by this project).

### Not yet built

- One attack chain only (`ssh_intrusion`) — no lateral movement, phishing, or web-shell chains, and no overlapping simultaneous chains.
- Scenarios carry no ground-truth answer key, so a verdict can't be scored automatically against what actually happened — the verifier model is a second opinion, not ground truth.
- No attack-emulation VM/lab side (see AGENTS.md isolation rules) — nothing runs against synthetic logs' "attacker" yet, it's simulated in the log text only.
- No SIEM/NDR/EDR tool integration (Wazuh/Elastic/Suricata/Zeek-style stacks) — this is the first slice only.

## Design Themes

- **Tool integration over reinvention** — glue existing open-source tools together rather than building a SIEM from scratch.
- **Agentic analysis** — use LLM agents to triage alerts, correlate signals, write incident summaries, suggest next investigative steps.
- **Attack emulation → detection feedback loop** — run an emulated attack, see what got detected (and what didn't), use the gap to drive new detections. Purple-teaming as the core learning mechanic.
- **Detection engineering as code** — detection rules, playbooks, and agent prompts as versioned artifacts.
- **Explainability** — every agent conclusion traceable back to raw log/telemetry evidence.
- **Progressive scenarios** — start with a single log source and an obvious attack, work up to multi-stage intrusions across SIEM + NDR + endpoint data with noisy/ambiguous signals.

## Non-goals

- Not trying to be a production-grade SOC platform.
- Not aiming to replace real SIEM/NDR vendors — more about learning how the pieces fit and where AI genuinely helps vs. adds noise.

## Environment & Isolation

- Agents/tools run on the host directly, not in a disposable container — see `AGENTS.md` for the full rule set.
- No host-level package installs. Python via `uv` (one subproject per component). Services/daemons via Docker.
- Attack emulation runs in dedicated VMs only, isolated from host/LAN/internet — defensive tooling (SIEM/NDR collectors, agents) may run in Docker facing the VM(s).
- No secrets, API keys, or real telemetry/log data committed — synthetic data only unless stated otherwise.
