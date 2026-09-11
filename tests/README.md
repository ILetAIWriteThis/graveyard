# Check the gates and the paths

WHAT: Regression tests for security boundaries, publication, safe rendering, and real browser interactions.

WHY: A secret in a staged snapshot or old commit must not escape because the working copy looks clean. An unpublished entry must not leak through search or connections. A beautiful cemetery still needs working links, accessible controls, and a usable phone layout.

Security tests construct fake credentials at runtime in disposable temporary repositories. They never contain real secrets or change this repository's index. Browser tests run the built site under `/graveyard/` to catch GitHub project Pages path problems.
