# graveyard.

**Nothing finished. Nothing wasted.**

A resting place for abandoned projects, useful scraps, saved links, and thoughts that might grow into something else. Bring the thing. The caretaker finds it a home.

The [grounds](https://iletaiwritethis.github.io/graveyard/) offer headstones to explore, a searchable index, and a map of connections. Underneath: ordinary text in Git. No account, database, tracking, or runtime service.

## Just drop it here

Tell your agent “bury this” and paste a link, code, quote, thought, or project folder. No form to fill in. No category to choose. [AGENTS.md](AGENTS.md) tells the caretaker how to inspect, preserve, explain, categorize, and connect it. You can also leave text in [inbox/](inbox/README.md); it stays off the website until curated.

Each burial has an `item.json`, a `README.md` explaining **WHAT** it attempted and **WHY** it might be useful, and optional source files. Domains are folders; topics and explained relationships connect them. The original starter records have left the grounds; current entries come from the collector.

## Open the gates locally

Requires Node.js 22+ and Git; hook setup also uses `tar` on Linux/macOS.

```sh
npm ci
npm run setup
npm run dev
```

Visit `http://localhost:4173`. The preview rebuilds when collection or site files change. Setup downloads a checksum-verified Gitleaks release into ignored `.cache/` and installs commit/push hooks. It refuses to replace an existing custom hook configuration.

```sh
npm run check        # validate entries, connections, and file policy
npm test             # security and build regression tests
npm run test:browser # browser tests (npx playwright install chromium first)
npm run build        # create disposable _site/
npm run audit        # file policy + Gitleaks, including Git history
```

## Publish

In GitHub, select **Settings → Pages → Source → GitHub Actions** once. Push to `main`: [the workflow](.github/workflows/pages.yml) validates, tests, scans secrets and history, builds, and deploys only `_site/`. Pull requests run checks without publishing. Forks derive their site address from the Pages action.

See GitHub's [custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## The grounds

| Place | What lives here |
| --- | --- |
| [collection/](collection/README.md) | Collection grouped by problem domain |
| [inbox/](inbox/README.md) | Text awaiting the caretaker; excluded from the site |
| [taxonomy.json](taxonomy.json) | Domains, topics, and topic connections |
| [site/](site/README.md) | Cemetery, index, graph, and reading pages |
| [scripts/](scripts/README.md) | Build, validation, preview, and safeguards |
| [docs/](docs/README.md) | Curation and security boundaries |

## Travel light

Source is welcome. Archives, PDFs, images, fonts, media, executables, databases, dependency folders, symlinks, and individual files over 512 KiB are blocked. Handwritten SVG source is allowed. Link to heavy resources. Check licenses and preserve attribution before importing external code.

Hooks inspect **staged bytes** before a commit and **all history reachable from outgoing tips** before a push, including files later deleted. CI repeats the policy across checked-out history. Gitleaks adds credential detection. Human review remains necessary; see [security](docs/security.md). Hooks can be bypassed, and CI cannot undo a secret already pushed.

The MIT license covers original code and writing. Linked works retain their authors' rights; per-entry attribution or licenses take precedence for imported material.
