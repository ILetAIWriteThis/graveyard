# Problem Space — Agent Rules

## Product truth

Problem Space is a thinking instrument. The human does the thinking; the agent does the chore.

Problem Space is a living map of problems, their decomposition, the mental models connecting them, and the experience that turns theoretical understanding into judgment.

The product is about **what**, not **how**. Work from intended meaning, structure, relationships, evidence, and outcome. Choose routine implementation details autonomously. Ask only when a missing choice would materially change the product.

## Scope

Problem Space may contain problems from **any domain**. Security is one domain, never the organizing assumption.

The GitHub Page is a read-only consumption surface for canonical content. Content is authored and stored in the repository.

The single exception is **Loose thoughts**, a transient capture inbox backed by IndexedDB:

- It is local to the current browser and device, offline-capable, private by default, and never presented as canonical knowledge.
- It may capture unfinished text and optionally remember which problem was open.
- It must support per-item deletion plus an explicit copy, share, or export path for later promotion into the repository.
- It must state plainly that it does not sync and can be lost when browser/site data is cleared.
- Do not turn it into an in-browser knowledge editor, account system, or silent synchronization layer.

## Governing invariant

Everything connects to a problem.

The governing principle is: **Store what changes how you think—not everything you know.**

- Every content node is a problem or question.
- A problem may contain an unlimited number of subproblems.
- A subproblem is itself a complete problem and may recurse without a fixed depth limit.
- Concepts, mechanisms, evidence, observations, controls, experiments, decisions, and lessons exist only in the context of a problem.
- Domains and tags are navigation facets, not containers and never roots of knowledge.
- Do not create orphan facts, standalone concept pages, or technology-first entries.

## Canonical data

- Never edit `public/data/problems.json` or `public/data/problems.sha256` directly.
- Manage problems only through `npm run problems -- <command>`.
- The CLI validates the complete graph and updates the integrity checksum atomically.
- Run `npm run problems -- help` for supported operations.
- If a required graph operation is missing, extend `scripts/manage-problems.mjs` first and then use it.
- Run `npm run check` after application or problem-data changes.

## Graph rules

- Treat the knowledge model as a graph, not a folder tree.
- Preserve parent → subproblem containment, while allowing any node to relate to any other node across branches and domains.
- Every visible problem must provide a way to continue: parent, subproblem, related problem, backlink, root, or reading trail.
- Never strand the reader at a leaf node.
- Derive reverse relationships and backlinks from canonical edges rather than duplicating them manually.
- Support circular exploration: a reader must be able to move outward, sideways, backward, and home from every problem.
- Related suggestions must be explainable through shared concepts, explicit edges, common conditions, or meaningful structural similarity. Do not fabricate relevance.
- URLs must identify the selected problem so graph locations can be linked and revisited.

## Content rules

Start with a concrete problem, question, tension, or unwanted outcome. Then reveal only the dimensions that sharpen its model: conditions, components and relationships, mechanisms, boundaries, failure paths, observability, interventions, validation, evidence, uncertainty, and lessons.

Do not fill a template mechanically. Different domains need different dimensions.

## Depth and evidence

Use the epistemic ladder consistently:

1. **Aware** — the problem and its importance are recognized.
2. **Understood** — a coherent conceptual model exists.
3. **Reproduced** — mechanics were tested or directly observed.
4. **Operational** — an outcome was owned under real constraints.

Never infer or invent a higher level. Do not invent personal experience, validation, observations, or certainty for the user. Keep theoretical problems shallow; depth is earned through relevance, evidence, experimentation, or ownership.

## What to preserve

- Decompositions that made a difficult system legible.
- Relationships that connect apparently separate problems.
- Assumptions confirmed or disproved by evidence.
- Important boundaries, constraints, feedback loops, and failure modes.
- Experiments, observations, decision rules, and operational lessons.
- Uncertainty and questions that expose the next useful gap.

## What to reject

- Encyclopedic topic pages, copied documentation, generic definitions, and course-note dumps.
- Exhaustive catalogs created because information exists.
- Technology pages disconnected from a problem.
- AI-generated depth unsupported by evidence or relevance.
- Vanity metrics such as note count, page count, technology count, or streaks.
- Interfaces that replace judgment with generated certainty.

Apply this filter to every addition: **Could AI regenerate this perfectly in ten seconds?** If yes, omit it unless its relationship, provenance, or nuance changes the model.

## Experience rules

- Optimize for exploration and reading, not capture.
- Begin with “What is the problem?” and reveal structure progressively.
- Prefer maps, backlinks, trails, and meaningful recommendations over folders and taxonomies.
- Make relationship type and provenance visible.
- Make uncertainty visible. An honest open question is better than synthetic completeness.
- Avoid chat-first patterns. Invite inspection, comparison, decomposition, and reflection.
- The visual system should feel like an analytical atlas with editorial confidence, not a dashboard, wiki, or note-taking app.
- Preserve accessibility, keyboard navigation, responsive behavior, and reduced-motion preferences.

## Definition of done

A change belongs only if it helps a reader enter through a meaningful problem, move recursively through its subproblems, discover non-obvious relationships, return and continue from any node, distinguish recognition from experience, understand unfamiliar systems faster, or turn understanding into better judgment.
