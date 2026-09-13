# Problem Space

## WHAT

An unfinished browser-based atlas for organizing problems rather than collecting answers. Its model treats every entry as a problem that can contain recursive subproblems, have more than one parent, and connect sideways to other domains with an explicit reason.

The preserved working tree contains a static PWA, a JSON graph model, a Node CLI for changing that graph, validation tests, search and graph navigation, and a device-local IndexedDB inbox for loose thoughts. The canonical graph is empty: the structure was built, but no real problem nodes were added.

This is user material. The description of what the project intended comes from its source and project brief; conclusions about its state come from static inspection by the caretaker.

## WHY

The useful idea is to make the problem—not a technology, category, or saved fact—the stable unit of knowledge. Recursive containment shows how a question breaks down, while explained relations show when the same mechanism appears elsewhere. Four evidence levels—Aware, Understood, Reproduced, and Operational—separate familiarity from working judgment.

Reusable pieces include the graph validator, its mutation CLI, backlink and ancestry derivation, the empty-state design that refuses invented demonstration knowledge, and the separation between a canonical repository graph and a quick local capture inbox.

## What was tried

The source implements the application shell and editing workflow. Tests describe support for multi-parent subproblems, cross-domain relations, checksum validation, and a rule against isolated nodes. The browser code includes graph browsing, search, reading trails, local capture, Markdown export, and offline caching.

The caretaker did not run this collected project. Whether it was deployed, used beyond development, or behaved correctly in a browser is unknown.

## Limitations

The graph contains zero real problems, so the project's central model was not tested against lived content. Nearly all application files were uncommitted in the source working tree. The package manifest asks for the latest Vite release, though the preserved lockfile records the then-resolved dependency tree. The page references Google Fonts, and captured thoughts live only in one browser's IndexedDB; clearing browser data can erase them.

The preserved code is inert, escaped source in this collection. Repository history, `node_modules`, and generated `dist` were deliberately left behind.

## Revival condition

Dig it up when there is a small set of real, recurring problems to enter first. The nearby Purpose → Plan → Result prompt could help turn each one into a testable record without pretending the plan is the problem.
