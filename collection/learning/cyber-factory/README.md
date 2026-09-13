# Cyber Factory

## WHAT

A learning lab for security operations and local AI, built around synthetic evidence instead of a production monitoring stack. The preserved working tree contains generators for ordinary and suspicious syslog-like events, a multi-stage SSH intrusion spread across firewall, NDR, authentication, and host-service records, per-line local-model classification and benchmarking, and a two-model triage loop.

The triage loop gives one model batches of logs and requires it to request more evidence before concluding. It then converts the answer to a structured verdict and asks a different model to challenge unsupported claims and missed signals. A reconstructable run format keeps prompts, tool calls, shown logs, verdict, and critique together.

This is user material. Project intentions and reported runs come from its READMEs, specification, and design document. The caretaker's conclusions about repository state and preserved files come from static inspection.

## WHY

The reusable idea is not “let an LLM watch logs.” It is to make premature stopping, unsupported conclusions, and disagreement observable. Synthetic scenarios keep identities consistent across sources, so a model must correlate a quiet chain rather than reward the loudest isolated event. The separate verifier is useful as a critic, while the project is candid that another model is not ground truth.

Reusable pieces include the scenario scheduler, reserved-address NDR generator, cross-source invariants in the tests, structured verdict and review schemas, the early-verdict gate, and the complete decision trace. Together they form a compact harness for studying when a small local model reads enough and when it merely sounds certain.

## What was tried

The current dirty working tree goes well beyond the root README's stale “no code yet” status. It implements six log categories, one six-stage intrusion scenario, a schema lookup proof of concept, batch-paced analysis, structured extraction, independent model review, and a detailed static HTML explanation of the loop.

The supplied documentation reports several actual local-model runs: early verdicts after only part of a stream, false-positive severity from small classifiers, and disagreement between analyst and verifier. No generated logs, benchmark CSV, or saved run artifact was present, so those outcomes are recollection embedded in project documentation, not measurements recoverable from this snapshot. Whether any broader SIEM, NDR, EDR, or attack-emulation integration was used is unknown.

The caretaker did not run the collected scripts or tests.

## Limitations

The generator has no answer key even though it knows the injected stages, so the verifier remains a second opinion. There is only one full scenario, batching repeatedly resends the growing transcript, and the schema translator is mostly a seed. The code depends on a local Ollama service and selected models that are not part of the snapshot.

The original repository mixed committed material with staged, modified, and untracked work. Its ignored `.venv`, bytecode cache, and Git history were not copied. Personal workstation examples were changed to neutral lab values, and one mapping described as private work knowledge was replaced by an explicit placeholder. The source is preserved as inert text and was not executed.

## Revival condition

Dig it up to test a narrowly defined security-analysis behavior. First turn each synthetic scenario into an answer key with expected entities, stages, and acceptable uncertainty; then score the analyst directly before using another model as a reviewer.
