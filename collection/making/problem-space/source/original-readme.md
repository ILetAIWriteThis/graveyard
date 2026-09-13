# Problem Space

> Store what changes how you think—not everything you know.

Problem Space is a living map of problems, their decomposition, the mental models connecting them, and the experience that turns theoretical understanding into judgment.

The repository stores the canonical graph. The GitHub Page is its reading surface.

## Publish on GitHub Pages

Push to `main`. The GitHub Actions workflow validates the graph, tests the model, builds the PWA, and deploys `dist` to GitHub Pages. Configure **Settings → Pages → Source → GitHub Actions** once.

## Content

Graph content lives in `public/data/problems.json`. Every node is a problem. A node may contain any number of recursive subproblems and may link to related problems in any domain.

Do not edit canonical data directly. Use:

```sh
npm run problems -- help
```

The CLI validates the whole graph and updates its integrity checksum atomically.

The interface derives parent links, backlinks, subproblem navigation, cross-domain related routes, a circular reading trail, and a searchable problem index.

## Loose thoughts

The PWA includes a fast capture inbox backed by IndexedDB. Thoughts:

- work offline and remain private to the current browser/device;
- can remember the problem that was open when they appeared;
- can be copied, shared, exported as Markdown, or deleted individually;
- never become canonical graph content automatically.

IndexedDB is not a sync service. Clearing site data can delete the inbox, so promote or export anything important.

## Local preview

```sh
npm install
npm run dev
```

Use `npm run check` to run the same validation, tests, and build used before deployment.

## Files

- `index.html` — page structure and application shell
- `styles.css` — responsive visual system
- `public/data/problems.json` — CLI-managed graph content
- `script.js` — graph traversal, search, recommendations, and display
- `public/sw.js` — offline application shell
- `AGENTS.md` — product rules for future changes
