# The groundskeeping tools

WHAT: Validate records, generate static pages, serve a local preview, and enforce storage and secret safeguards.

WHY: The owner drops things in; routine maintenance belongs to the machinery. The build never imports or executes collected scripts. Only this directory contains trusted build code.

`catalog.mjs` owns metadata and Markdown link validation. `build.mjs` exports reviewed content. `guard.mjs` scans exact Git blobs as well as working files. `gitleaks.mjs` installs and runs the pinned detector. `setup.mjs` installs local hooks without replacing existing custom hooks.
