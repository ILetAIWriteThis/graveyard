import { escape as e, itemURL, sourceURL, renderMarkdown, connections } from '../scripts/catalog.mjs';

export function icon(name, className = '') {
  const paths = {
    moon: '<path d="M20 14.2A8.5 8.5 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    flower: '<path d="M12 21v-9m0 6c-4 0-5-3-5-3 4-1 5 3 5 3Zm0-3s1-4 5-3c0 0-1 3-5 3Z"/><path d="M12 4c-3-5-7 0-4 3-5 1-3 7 1 6 1 4 6 3 6-1 5 0 5-6 1-6 0-4-4-5-4-2Z"/>',
    code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
    spark: '<path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8Z"/>',
    sprout: '<path d="M12 22V11m0 6C4 17 3 9 3 9c8 0 9 8 9 8Zm0-5c0-8 9-10 9-10 0 8-9 10-9 10Z"/>',
    stone: '<path d="M5 20V10a7 7 0 0 1 14 0v10M3 21h18M9 10h6m-3-3v6"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    shuffle: '<path d="m17 3 4 4-4 4m0 2 4 4-4 4M3 7h3c5 0 7 10 12 10h3M3 17h3c2 0 4-2 6-5s4-5 6-5h3"/>',
    grid: '<rect x="3" y="3" width="6" height="7" rx="3"/><rect x="15" y="3" width="6" height="7" rx="3"/><rect x="3" y="14" width="6" height="7" rx="3"/><rect x="15" y="14" width="6" height="7" rx="3"/>',
    list: '<path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01"/>',
    network: '<circle cx="5" cy="6" r="3"/><circle cx="19" cy="5" r="3"/><circle cx="13" cy="19" r="3"/><path d="m7.5 7.5 4 9M8 6l8-1m2 3-4 8"/>',
    book: '<path d="M12 5v16M12 5C8 2 3 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-4-2-7-1-10 1Z"/>',
    shovel: '<path d="m15 9-8 8m6-12 6 6 3-3-6-6-3 3ZM8 14l3 3-5 5H2v-4l6-4Z"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    github: '<path d="M9 19c-4 1-4-2-6-2m12 5v-4c0-1 .2-2-.6-3 3-.3 6-1.5 6-6A4.7 4.7 0 0 0 19 6c.1-1 .1-2-.3-3 0 0-1 0-3 1a11 11 0 0 0-7 0C6 3 5 3 5 3c-.4 1-.4 2-.3 3a4.7 4.7 0 0 0-1.4 3c0 4.5 3 5.7 6 6-.8 1-.6 2-.6 3v4"/>',
  };
  return `<svg class="icon ${className}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.stone}</svg>`;
}

const symbols = { project: 'stone', script: 'code', resource: 'book', thought: 'sprout', quote: 'moon', solution: 'spark', fragment: 'flower' };
export const symbol = item => symbols[item.type];
const count = n => String(n).padStart(2, '0');
const topicChips = (item, catalog, base) => item.topics.map(id => `<a class="tag" href="${base}/?topic=${id}#grounds">${e(catalog.taxonomy.topics[id].title)}</a>`).join('');

export function layout({ title, description, body, base = '', current = '', repo = 'https://github.com/ILetAIWriteThis/graveyard', canonical = '' }) {
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'">
  <title>${e(title)} · graveyard</title><meta name="description" content="${e(description)}">
  <meta property="og:title" content="${e(title)} · graveyard"><meta property="og:description" content="${e(description)}"><meta property="og:type" content="website">
  ${canonical ? `<link rel="canonical" href="${e(canonical)}">` : ''}
  <link rel="icon" href="${base}/assets/favicon.svg" type="image/svg+xml">
  <script src="${base}/assets/theme.js"></script>
  <link rel="stylesheet" href="${base}/assets/style.css">
  <script src="${base}/assets/catalog.js" defer></script><script src="${base}/assets/app.js" defer></script>
</head>
<body data-base="${e(base)}">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header shell">
    <a class="wordmark" href="${base}/" aria-label="Graveyard home">${icon('stone')}graveyard<span>.</span></a>
    <nav aria-label="Main navigation"><a class="nav-link ${current === 'grounds' ? 'active' : ''}" href="${base}/#grounds">The grounds</a><a class="nav-link ${current === 'about' ? 'active' : ''}" href="${base}/about/">Field notes</a><a class="repo-link" href="${e(repo)}" aria-label="Source on GitHub" rel="noreferrer">${icon('github')}</a></nav>
    <div class="header-actions"><button class="theme-toggle icon-button" aria-label="Switch to daylight" title="Switch lighting" hidden>${icon('sun')}</button><a class="leave-link" href="${base}/about/#leave-something" data-intake>Leave something <span>+</span></a></div>
  </header>
  <main id="main">${body}</main>
  <footer class="site-footer shell"><a class="wordmark small" href="${base}/">graveyard<span>.</span></a><p>Nothing here has to become anything.<br><span>But something still might.</span></p><a href="${e(repo)}" rel="noreferrer">Tended by an agent. Collected by a human. ${icon('arrow')}</a></footer>
  <dialog id="intake" aria-labelledby="intake-title"><button class="icon-button dialog-close" aria-label="Close">${icon('close')}</button><span class="eyebrow">THE GATE IS ALWAYS OPEN</span><h2 id="intake-title">Bring the thing.</h2><p>A link. A script. A half-built universe.<br>You don't need to know where it belongs.</p><div class="prompt-example"><span>Say this to your agent in this repo</span><code>Bury this: [your thing here]</code><button class="text-button" id="copy-prompt">Copy prompt ${icon('book')}</button></div><p class="small-copy">The caretaker checks it, finds a home, and makes the connections. You can also leave a text file in the repository's inbox.</p><a class="button" href="${e(repo)}/tree/main/inbox">Open the inbox ${icon('arrow')}</a><p class="dialog-footnote">A public collection. Keep private things outside the gates.</p><p id="copy-status" class="sr-only" role="status"></p></dialog>
</body></html>`;
}

function vignette() {
  return `<svg class="vignette" viewBox="0 0 350 240" fill="none" aria-hidden="true">
  <circle class="moon-glow" cx="247" cy="55" r="45"/><path class="moon-fill" d="M266 26a31 31 0 1 0 15 46c-31 12-48-24-15-46Z"/>
  <g class="stars" stroke="currentColor"><path d="M170 27v8m-4-4h8M310 84v6m-3-3h6M84 36v5m-2.5-2.5h5M216 103v6m-3-3h6"/><circle cx="123" cy="13" r=".8"/><circle cx="292" cy="18" r="1"/><circle cx="324" cy="128" r="1"/></g>
  <path class="hill" d="M6 215c83-25 213-29 336 0"/>
  <g class="gate" stroke="currentColor" stroke-width="1.5"><path d="M92 204V105m164 99v-99M87 105l5-10 5 10m154 0 5-10 5 10M106 204V114c45-45 91-45 136 0v90M111 136c43-35 84-35 126 0M174 94v110M120 118v85m18-96v94m18-101v102m36-102v102m18-95v94m18-82v84M109 171h130M109 180h130"/><path d="m167 150 7-7 7 7-7 7-7-7Z"/></g>
  <g class="plants" stroke="currentColor" stroke-width="1.4"><path d="M58 210v-41m0 21c-18-1-16-17-16-17 18 0 16 17 16 17Zm0-13s-1-19 16-19c1 17-16 19-16 19ZM284 211v-28m0 13s-11-1-11-12c13 0 11 12 11 12Zm0-4s0-12 11-15c3 13-11 15-11 15ZM28 216l-4-10m4 10 5-13m272 13-3-13m3 13 7-7"/></g>
  <path class="path-line" d="M172 203c-6 13 3 23 28 34m-13-34c-1 10 24 22 41 28"/>
  </svg>`;
}

export function grave(item, index, base) {
  return `<a class="grave" href="${itemURL(item, base)}" data-id="${item.id}" data-domain="${item.domain}"><span class="headstone shape-${index % 3}"><span class="grave-type">${e(item.type)}</span>${icon(symbol(item), 'grave-symbol')}<h3>${e(item.title)}</h3><span class="grave-rule"></span><span class="epitaph">${e(item.epitaph)}</span><span class="grave-status"><i class="status-dot ${item.status}"></i>${item.status === 'seed' ? 'a seed, actually' : item.status === 'revived' ? 'back among the living' : 'resting, for now'}</span></span><span class="stone-base"></span><span class="plot-label">PLOT ${String(index + 1).padStart(3, '0')} <span>↗</span></span><span class="tuft" aria-hidden="true">╱│╲</span></a>`;
}

export function indexRows(items, catalog, base) {
  return items.map((item, i) => `<a class="index-row" href="${itemURL(item, base)}" data-id="${item.id}"><span class="row-number">${count(i + 1)}</span><span class="row-symbol">${icon(symbol(item))}</span><span class="row-main"><span class="row-title">${e(item.title)}</span><span class="row-summary">${e(item.summary)}</span></span><span class="row-type">${e(item.type)}</span><span class="row-domain">${e(catalog.taxonomy.domains[item.domain].title)}</span><span class="row-arrow">↗</span></a>`).join('');
}

export function network(items, catalog, base) {
  const subset = items.slice(0, 30);
  const usedTopics = [...new Set(subset.flatMap(item => item.topics))];
  const nodes = new Map();
  subset.forEach((item, i) => { const angle = i / Math.max(subset.length, 1) * Math.PI * 2 - Math.PI / 2; nodes.set(item.id, { x: 500 + Math.cos(angle) * 370, y: 295 + Math.sin(angle) * 230, item }); });
  usedTopics.forEach((topic, i) => { const angle = i / usedTopics.length * Math.PI * 2 - Math.PI / 2; nodes.set(`topic:${topic}`, { x: 500 + Math.cos(angle) * 145, y: 295 + Math.sin(angle) * 120, topic }); });
  let lines = '';
  for (const item of subset) {
    const a = nodes.get(item.id);
    for (const topic of item.topics) { const b = nodes.get(`topic:${topic}`); lines += `<line class="topic-edge" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`; }
    for (const edge of item.related) { const b = nodes.get(edge.id); if (b) lines += `<path class="item-edge" d="M${a.x},${a.y} Q500,295 ${b.x},${b.y}"/>`; }
  }
  const dots = [...nodes.values()].map(node => {
    const label = node.item ? node.item.title : catalog.taxonomy.topics[node.topic].title;
    const url = node.item ? itemURL(node.item, base) : `${base}/?topic=${node.topic}&view=connections#grounds`;
    const words = label.split(' '); const rows = [''];
    for (const word of words) { if ((rows.at(-1) + word).length > 23) rows.push(''); rows[rows.length - 1] += `${word} `; }
    return `<a href="${url}" class="graph-node ${node.item ? 'item-node' : 'topic-node'}" aria-label="${e(label)}"><circle cx="${node.x}" cy="${node.y}" r="${node.item ? 9 : 5}"/><text x="${node.x}" y="${node.y + 27}" text-anchor="middle">${rows.map((row, i) => `<tspan x="${node.x}" dy="${i ? 17 : 0}">${e(row.trim())}</tspan>`).join('')}</text></a>`;
  }).join('');
  return `<div class="network-art"><span class="map-corner">FOLLOW A THREAD</span><svg viewBox="0 0 1000 600" role="group" aria-label="Connections between entries and their topics">${lines}${dots}</svg><div class="graph-legend"><span><i></i>entry</span><span><i class="topic"></i>topic</span><span>Solid: shared topic · curved: explicit connection</span></div></div>${items.length > 30 ? '<p class="small-copy">Showing the first 30 matches on the map. All matches appear in the index.</p>' : ''}`;
}

export function relationshipList(items, catalog, base) {
  const ids = new Set(items.map(item => item.id));
  const edges = items.flatMap(item => item.related.filter(edge => ids.has(edge.id)).map(edge => `<li><div><a href="${itemURL(item, base)}">${e(item.title)}</a><span>↔</span><a href="${itemURL(catalog.byId.get(edge.id), base)}">${e(catalog.byId.get(edge.id).title)}</a></div><p>${e(edge.reason)}</p></li>`));
  return `<details class="connection-details"><summary>Read the connections <span>${edges.length}</span></summary><ul class="relationship-list">${edges.join('') || '<li>No explicit connections between these entries yet. Shared topics are a starting point.</li>'}</ul></details>`;
}

export function home(catalog, base) {
  const { published: items, taxonomy } = catalog;
  const usedTopics = new Set(items.flatMap(item => item.topics));
  return `<section class="hero shell"><div class="hero-copy"><p class="eyebrow"><span class="tiny-star">✳</span> A RESTING PLACE FOR UNFINISHED THINGS</p><h1>Nothing finished.<br><em>Nothing wasted.</em></h1><p class="hero-description">Abandoned projects. Passing thoughts. Useful little scraps.<br>A place to put them down. A chance to find them again.</p><div class="hero-actions"><a class="button primary" href="#grounds">Wander the grounds ${icon('arrow')}</a><button class="text-button random-button" hidden>${icon('shuffle')} Dig something up</button></div></div><div class="hero-art">${vignette()}<span>LET GOOD IDEAS REST IN PEACE.<br>OR IN PIECES.</span></div></section>
  <div class="archive-strip shell"><div><span class="live-dot"></span> THE COLLECTION IS QUIETLY GROWING</div><p><strong>${count(items.length)}</strong> things kept <span>/</span> <strong>${count(Object.keys(taxonomy.domains).filter(id => items.some(item => item.domain === id)).length)}</strong> corners <span>/</span> <strong>${count(usedTopics.size)}</strong> threads to follow</p></div>
  <section class="explorer shell" id="grounds" aria-labelledby="grounds-title"><div class="section-heading"><div><p class="eyebrow">A LITTLE ARCHAEOLOGY</p><h2 id="grounds-title">Make yourself at home.</h2></div><p>Mind the flowers. Follow your curiosity.</p></div>
  <div class="explorer-tools" hidden><label class="search-box" for="search">${icon('search')}<input id="search" type="search" placeholder="Look for something worth keeping…" autocomplete="off"><kbd>/</kbd></label><div class="view-switch" role="group" aria-label="View collection"><button data-view="grounds" aria-pressed="true">${icon('grid')}<span>Grounds</span></button><button data-view="index" aria-pressed="false">${icon('list')}<span>Index</span></button><button data-view="connections" aria-pressed="false">${icon('network')}<span>Connections</span></button></div></div>
  <div class="filter-line" hidden><div class="domain-filters" role="group" aria-label="Filter by domain"><button class="filter active" data-domain="all" aria-pressed="true">All corners <span>${items.length}</span></button>${Object.entries(taxonomy.domains).map(([id, domain]) => `<button class="filter" data-domain="${id}" aria-pressed="false">${e(domain.title)} <span>${items.filter(item => item.domain === id).length}</span></button>`).join('')}</div><div class="select-filters"><label class="sr-only" for="type-filter">Type</label><select id="type-filter"><option value="all">Every kind</option>${[...new Set(items.map(item => item.type))].sort().map(type => `<option value="${type}">${type}</option>`).join('')}</select><label class="sr-only" for="topic-filter">Topic</label><select id="topic-filter"><option value="all">Every topic</option>${[...usedTopics].sort().map(topic => `<option value="${topic}">${e(taxonomy.topics[topic].title)}</option>`).join('')}</select></div></div>
  <div class="results-meta"><p id="result-count" role="status" aria-live="polite">${items.length} things resting here</p><button id="clear-filters" class="text-button" hidden>Clear filters ×</button><span>NO PRESSURE TO RESURRECT</span></div>
  <div id="grounds-view" class="cemetery"><div class="map-corner">THE GROUNDS <span>EST. 2026</span></div><span class="compass" aria-hidden="true">N<br>↑</span><svg class="garden-path" viewBox="0 0 1100 600" preserveAspectRatio="none" aria-hidden="true"><path d="M-100 315C200 150 340 480 570 310s350-100 620 20"/></svg><div class="grave-grid" id="grave-grid">${items.map((item, i) => grave(item, i, base)).join('')}</div><div class="cemetery-bottom"><span>${icon('sprout')} A FEW THINGS ARE STILL GROWING.</span><span>TAKE YOUR TIME ↗</span></div></div>
  <div id="index-view" class="index-view" hidden><div class="index-label">THE LEDGER <span>EVERYTHING, IN PLAIN SIGHT</span></div><div id="index-rows">${indexRows(items, catalog, base)}</div></div>
  <div id="connections-view" hidden><div id="network">${network(items, catalog, base)}</div><div id="relationship-list">${relationshipList(items, catalog, base)}</div><details class="connection-details"><summary>Bridges between topics <span>${taxonomy.bridges.length}</span></summary><ul class="relationship-list">${taxonomy.bridges.map(bridge => `<li><div><a href="${base}/?topic=${bridge.from}&view=connections#grounds">${e(taxonomy.topics[bridge.from].title)}</a><span>↔</span><a href="${base}/?topic=${bridge.to}&view=connections#grounds">${e(taxonomy.topics[bridge.to].title)}</a></div><p>${e(bridge.reason)}</p></li>`).join('')}</ul></details></div>
  <div class="empty-state" id="empty-state" hidden>${icon('flower')}<h3>Quiet in this corner.</h3><p>No burials match these filters. Try a different trail.</p><button class="button" id="empty-reset">Wander back to everything ${icon('arrow')}</button></div>
  <noscript><p class="notice">The grounds and every reading page work without JavaScript. Enable it for search, filters, the index, and the connection map.</p></noscript></section>
  <section class="field-notes shell"><div class="field-note-heading">${icon('flower')}<span>NOT EVERYTHING HERE IS DEAD.</span></div><div><h2>Some things are just<br>waiting for a different idea.</h2><p>A script meets a thought. An old project solves a new problem.<br>The interesting part is often what happens between them.</p><a class="text-link" href="${base}/?view=connections#grounds">Follow the connections ${icon('arrow')}</a></div><div class="caretaker-note"><span class="eyebrow">A NOTE FROM THE CARETAKER</span><p>“You bring the curiosity.<br>I'll take care of the filing.”</p><a href="${base}/about/">How this place works ↗</a><small>These are the collector's own burials.<br>No demonstration graves remain.</small></div></section>`;
}

export function entry(item, catalog, base) {
  return `<article class="reading shell"><a class="back-link" href="${base}/#grounds">← Back to the grounds</a><div class="entry-layout"><div class="entry-main"><p class="eyebrow">${e(catalog.taxonomy.domains[item.domain].title)} <span>/</span> ${e(item.type)}</p><div class="entry-title">${icon(symbol(item))}<h1>${e(item.title)}</h1></div><p class="entry-epitaph">${e(item.epitaph)}</p><div class="entry-meta"><span><i class="status-dot ${item.status}"></i>${e(item.status)}</span><span>Kept ${e(item.added)}</span><span>${item.provenance === 'caretaker' ? 'Caretaker starter' : item.provenance === 'user' ? 'From the collector' : 'External source'}</span></div><div class="prose">${renderMarkdown(item, catalog, base)}</div>${item.sourceFiles.length ? `<section class="source-section"><h2>What survived</h2>${item.sourceFiles.map(file => `<a class="source-link" href="${sourceURL(item, file.name, base)}">${icon('code')}<span>${e(file.name)}</span><span>Read source ↗</span></a>`).join('')}</section>` : ''}${item.sources.length ? `<section class="source-section"><h2>Original sources</h2>${item.sources.map(source => `<a class="source-link" href="${e(source.url)}" rel="noreferrer noopener">${icon('book')}<span>${e(source.label)}</span><span>↗</span></a>`).join('')}</section>` : ''}<div class="provenance"><span class="eyebrow">PROVENANCE</span><p>${e(item.origin)}</p></div></div><aside class="entry-sidebar"><section class="revival-note">${icon('sprout')}<span class="eyebrow">DIG UP WHEN…</span><p>${e(item.revive_when)}</p></section><section><h2 class="sidebar-heading">Threads to follow</h2><div class="tags">${topicChips(item, catalog, base)}</div></section><section><h2 class="sidebar-heading">Buried nearby</h2><div class="nearby">${connections(item, catalog).map(connection => `<a href="${itemURL(connection.item, base)}"><span class="connection-kind">${connection.kind}</span><h3>${e(connection.item.title)} <span>↗</span></h3><p>${e(connection.reason)}</p></a>`).join('') || '<p>A quiet corner, for now. Connections may arrive later.</p>'}</div></section></aside></div></article>`;
}

export function sourcePage(item, file, base) {
  return `<article class="source-page shell"><a class="back-link" href="${itemURL(item, base)}">← ${e(item.title)}</a><p class="eyebrow">SURVIVING SOURCE · READ ONLY</p><h1>${e(file.name)}</h1><p class="source-caption">Preserved as text. Review the source and its notes before running it yourself.</p><pre class="source-code"><code>${e(file.text)}</code></pre></article>`;
}

export function about(base) {
  return `<article class="about-page shell"><p class="eyebrow">FIELD NOTES · A GUIDE TO THIS PLACE</p><h1>A little less guilt.<br><em>A little more possibility.</em></h1><p class="about-lede">This is a home for the things you couldn't quite let go of.<br>They don't have to justify their existence. Neither do you.</p><div class="about-grid"><section><span class="chapter">01 / THE ARRIVAL</span><h2 id="leave-something">Bring absolutely anything.</h2><p>An article. A small script. A long script. A quote, a solution, a strange thought, or the source of a project that ran out of Sundays.</p><p>Tell the agent in this repository <code>“Bury this”</code> and share the material. Or leave a text file in <code>inbox/</code>. No taxonomy homework.</p></section><section><span class="chapter">02 / THE CARETAKER</span><h2>Someone does the filing.</h2><p>The agent checks for sensitive material, preserves the intention, finds a corner, and writes down why the thing might still be useful.</p><p>It connects ideas across domains and names a situation where you might want to dig this one up. Unknowns stay unknown.</p></section><section><span class="chapter">03 / THE AFTERLIFE</span><h2>Wander. Don't manage.</h2><p>Headstones invite a little serendipity. The index finds a particular thing. The connection map shows how a fragment from one world might help in another.</p><p>Resting means kept. Seed means potential. Revived means someone found another use. None is a score.</p></section><section><span class="chapter">04 / PACK LIGHT</span><h2>Ideas don't weigh much.</h2><p>Keep source, writing, and public links. Leave archives, binaries, PDFs, media, databases, and private material outside the gates.</p><p>Commit and push hooks check file policy and secrets; Actions checks again before publishing. A human still needs to recognize what should be private.</p></section></div><div class="about-closing">${icon('flower')}<h2>A graveyard can be good soil.</h2><p>The demonstration graves have left the grounds. The collection can now take its shape from what the collector actually brings.</p><a class="button primary" href="${base}/#grounds">Back to the grounds ${icon('arrow')}</a></div></article>`;
}
