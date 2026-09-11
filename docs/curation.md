# A burial takes a folder

The user brings the material. The agent supplies metadata and an account of its intention. See [AGENTS.md](../AGENTS.md) for intake rules.

```text
collection/<domain>/<id>/
  item.json
  README.md
  optional-source.mjs
```

The globally unique lowercase `id` is also the folder name and permanent `/items/<id>/` URL. Moving domains does not change the URL. Domains and topics are defined in `taxonomy.json`.

| Field | Meaning |
| --- | --- |
| `id`, `title`, `domain` | Stable identity, human name, primary problem area |
| `type` | `project`, `script`, `resource`, `thought`, `quote`, `solution`, `fragment` |
| `status` | `resting`, `seed`, or `revived` |
| `added` | Actual intake date, `YYYY-MM-DD` |
| `summary` | One concrete sentence about what is useful |
| `epitaph` | Personality, without invented project history |
| `revive_when` | When this could help someone |
| `topics` | Array of known topic slugs |
| `related` | Array of `{ "id": "another-item", "reason": "How this connects" }` |
| `sources` | Array of `{ "url": "https://...", "label": "Author / title" }`; required for resources and quotes |
| `files` | Relative paths to source to display; no traversal or symlinks |
| `provenance` | `user`, `external`, or `caretaker` |
| `origin` | Attribution: what came from whom |
| `publish` | Site inclusion approval, never a Git privacy control |

README sections `## WHAT` and `## WHY` are mandatory. Add usage, limitations, and revival notes when useful. Relative Markdown links to item READMEs or listed source become permanent site links; broken or unpublished targets fail validation. External links must use HTTP(S). Raw HTML is escaped. Markdown images become links, preventing silent tracking of readers.

Explicit relationships get automatic backlinks. Shared topics suggest neighbors and are labeled as topic matches. Topic bridges connect domains through common problems. The graph also has a readable relationship list. No AI API is needed at build or browse time.

`publish: false` items are validated but excluded from site pages, search, and relationships. They remain visible in Git. Inbox content never publishes automatically.

The six original entries were created during repo design: one based on the owner's stated intent and five caretaker examples. They provide reusable material and exercise the format. Replace or evolve them as the collection grows.
