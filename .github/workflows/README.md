# The publishing route

WHAT: `pages.yml` verifies every push to main and pull request, then builds and deploys on main only.

WHY: Keep checks visible, permissions narrow, and collected content out of executable workflows. Dependencies and official actions are pinned. The repository's license and source remain in Git; only generated `_site/` is uploaded.
