# cyber-factory

A playground/platform for learning Operational Security work end-to-end — by actually integrating the tools and building the agents, not just reading about them.

## Rough idea

Most SOC learning resources teach concepts in isolation: a SIEM course here, a "what is NDR" article there, a red team CTF somewhere else. This project's premise is that the fastest way to actually understand detection and response is to wire the pieces together and let an agentic layer sit on top — attacking, detecting, analyzing, and defending in the same loop.

Two halves of the same loop:

- **Offense / emulation** — generate realistic attack traffic and behavior (MITRE ATT&CK-mapped emulation, C2 traffic, phishing sims, misconfig exploitation) in a safe, contained lab.
- **Defense / detection** — SIEM + NDR + EDR-style telemetry collection, correlation, and triage, augmented with agentic analysis (LLM-driven alert triage, log summarization, hypothesis generation, auto-enrichment).

## Themes to explore

- **Tool integration over reinvention** — glue existing open-source tools together (e.g. Wazuh/Elastic/Suricata/Zeek-style stacks) rather than building a SIEM from scratch.
- **Agentic analysis** — use LLM agents to triage alerts, correlate signals across tools, write incident summaries, and suggest next investigative steps like a junior analyst would.
- **Attack emulation → detection feedback loop** — run an emulated attack, see what got detected (and what didn't), and use that gap to drive new detection rules or agent prompts. Purple-teaming as the core learning mechanic.
- **Detection engineering as code** — treat detection rules, playbooks, and agent prompts as versioned artifacts that evolve based on what emulation reveals.
- **Explainability** — every agent conclusion should be traceable back to raw log/telemetry evidence, so it's useful for learning and not a black box.
- **Progressive scenarios** — start with a single log source and an obvious attack, work up to multi-stage intrusions across SIEM + NDR + endpoint data with noisy/ambiguous signals.

## Non-goals (for now)

- Not trying to be a production-grade SOC platform.
- Not aiming to replace real SIEM/NDR vendors — more about learning how the pieces fit and where AI genuinely helps vs. adds noise.

## Status

Early ideas stage — no code yet. This README is a scratchpad for direction, not a spec.
