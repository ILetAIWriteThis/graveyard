# A gate, not a guarantee

WHAT: Keep credentials, private material, and bulky files out of a public text collection.

WHY: Preserve ideas without accidentally publishing access or carrying a warehouse of opaque artifacts.

## Layers

1. The caretaker reviews content and publication rights. URLs, comments, sample data, and configuration can carry private information.
2. `npm run check` scans tracked and unignored new files for forbidden paths, sizes over 512 KiB, non-text bytes, and common secrets. UTF-8 is required. Archives, PDFs, media, databases/dumps, LFS pointers, symlinks, submodules, and vendor/build folders are blocked.
3. After `npm run setup`, pre-commit checks actual staged blobs and runs Gitleaks on staged changes. Pre-push checks all file versions reachable from outgoing tips and scans those histories with Gitleaks, including deleted secrets. Scanning extra history handles new branches and force pushes safely.
4. Actions checks the full checkout history, validates, tests, and builds before deployment. Pull requests get the same gates. Require the `verify` check through branch protection to prevent merging failed checks.
5. Only reviewed entries, escaped Markdown, and escaped source pages are exported. Inbox, item JSON, raw source, Git files, and arbitrary directories never enter the deployment. A restrictive content security policy disallows external scripts, fonts, images, analytics, and network requests.

Gitleaks is pinned and downloaded from its official release, verified against its SHA-256 manifest, and kept in ignored `.cache/`. Hooks fail closed when it is absent. See [Gitleaks](https://github.com/gitleaks/gitleaks).

## Limits

Scanners detect patterns, not every private fact. Personal details, proprietary code, private endpoints, and new credential formats can escape detection. Treat committed files as public. Unpublished entries, inbox, and ignore rules are not access controls.

Install hooks for every clone. Hooks can be bypassed; CI runs after a push and cannot prevent data reaching GitHub. Enable GitHub secret scanning and push protection where available. Never bypass a failed gate to publish material.

If a secret is found, stop publication, revoke/rotate it, and replace it with a clear placeholder. If committed, removing it from the latest version is insufficient. Ask before rewriting shared history; never silently force-push. Reports identify files and rules without displaying secret values.
