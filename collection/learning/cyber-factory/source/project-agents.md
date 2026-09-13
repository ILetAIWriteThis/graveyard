# AGENTS.md

Guidelines for any AI coding agent (Claude Code, etc.) working in this repo.

## Environment isolation — hard rule

Agents run directly on the host machine here, not in a disposable container. Because of that:

- **Never install packages directly on the host.** No `pip install`, `apt install`, `npm install -g`, `brew install`, etc. against the system/user environment.
- **Python** → use `uv`. Every Python component gets its own project (`uv init`) with a `pyproject.toml` and a local `.venv`; run things via `uv run`, not a bare interpreter.
- **Services and tools** (SIEM, NDR, log generators, anything with its own daemon/agent/binary) → run via Docker, preferably through a `docker-compose.yml` scoped to that component. Don't install these as host services.
- **One-off CLI tools** needed only inside a container or a `uv` venv — never installed globally on the host.
- If something *seems* to require a host-level install, stop and flag it instead of doing it — there's almost always a containerized or venv'd alternative.

Rationale: this box is the user's daily machine, not a lab VM. Isolation via `uv` venvs and Docker keeps experiments (especially attack-emulation traffic and untrusted tool configs) reversible and contained.

## Repo shape (evolving)

This is early-stage — expect structure to shift. As of now the intent (see README.md) is roughly:

- one directory per integrated tool/service, each with its own `docker-compose.yml`
- Python components (agents, glue scripts, ingestion) each with their own `uv`-managed subproject rather than one repo-wide environment
- scenarios/playbooks tracked as versioned artifacts, not ad hoc scripts

## General guidance

- Keep it a learning/fun project: prefer small, runnable end-to-end slices over building out a full platform before anything works.
- **Every script's module docstring must include a runnable example invocation** (the actual `uv run ...` command, with realistic flags) — not just a one-line description of what the script does. See `synthetic-logs/*.py` for the pattern once retrofitted. This is so a script is usable from reading it alone, without hunting through READMEs or prior conversations.
- Attack emulation runs in dedicated VMs, not directly on the host or in host-networked containers — treat the VM boundary as the lab perimeter. Attack tooling, C2 infrastructure, and generated malicious traffic must stay inside that VM/lab network and never target anything outside it (the host, the wider LAN, or the internet). Defensive tooling (SIEM/NDR collectors, agents) may run in Docker alongside or facing the VM(s), but the offensive side gets the stronger VM-level isolation given the higher blast radius.
- Don't commit secrets, API keys, or real telemetry/log data — synthetic data only unless the user says otherwise.
