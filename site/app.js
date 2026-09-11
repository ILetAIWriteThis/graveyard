(() => {
  const data = window.GRAVEYARD;
  const base = document.body.dataset.base || '';
  const themeButton = document.querySelector('.theme-toggle');
  const sun = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>';
  const moon = '<path d="M20 14.2A8.5 8.5 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2Z"/>';
  function themeLabel() {
    const dark = document.documentElement.dataset.theme === 'dark';
    themeButton.setAttribute('aria-label', dark ? 'Switch to daylight' : 'Switch to dark mode');
    themeButton.title = dark ? 'Let a little daylight in' : 'Return to the moonlight';
    themeButton.querySelector('svg').innerHTML = dark ? sun : moon;
  }
  themeButton.hidden = false;
  themeLabel();
  themeButton.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('graveyard-theme', theme); } catch { /* Still works for this page. */ }
    themeLabel();
  });

  const dialog = document.querySelector('#intake');
  document.querySelectorAll('[data-intake]').forEach(link => link.addEventListener('click', event => {
    if (typeof dialog.showModal !== 'function') return;
    event.preventDefault(); dialog.showModal();
  }));
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  document.querySelector('#copy-prompt').addEventListener('click', async event => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText('Bury this: [your thing here]');
      button.textContent = 'Copied ✓';
      document.querySelector('#copy-status').textContent = 'Prompt copied.';
    } catch {
      button.textContent = 'Select the prompt above to copy';
      document.querySelector('#copy-status').textContent = 'Copy is unavailable. Select the prompt text to copy it.';
    }
  });

  if (!data || !document.querySelector('#grounds')) return;
  document.querySelector('.explorer-tools').hidden = false;
  document.querySelector('.filter-line').hidden = false;
  const search = document.querySelector('#search');
  const type = document.querySelector('#type-filter');
  const topic = document.querySelector('#topic-filter');
  const views = ['grounds', 'index', 'connections'];
  let state = { q: '', domain: 'all', type: 'all', topic: 'all', view: 'grounds' };
  let matches = data.items;
  const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const searchable = new Map(data.items.map(item => [item.id, normalize([item.title, item.summary, item.epitaph, item.revive_when, item.search, item.type, item.status, item.origin, data.taxonomy.domains[item.domain].title, ...item.topics.map(id => data.taxonomy.topics[id].title)].join(' '))]));
  const e = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function readURL() {
    const params = new URLSearchParams(location.search);
    state = {
      q: params.get('q') || '',
      domain: Object.hasOwn(data.taxonomy.domains, params.get('domain')) ? params.get('domain') : 'all',
      type: data.items.some(item => item.type === params.get('type')) ? params.get('type') : 'all',
      topic: Object.hasOwn(data.taxonomy.topics, params.get('topic')) ? params.get('topic') : 'all',
      view: views.includes(params.get('view')) ? params.get('view') : 'grounds',
    };
    search.value = state.q; type.value = state.type; topic.value = state.topic;
  }
  function syncURL(push) {
    const url = new URL(location.href);
    url.search = '';
    for (const [key, value] of Object.entries(state)) if (value && value !== 'all' && !(key === 'view' && value === 'grounds')) url.searchParams.set(key, value);
    if (url.href !== location.href) history[push ? 'pushState' : 'replaceState'](null, '', url);
  }

  function drawNetwork() {
    const subset = matches.slice(0, 30);
    const usedTopics = [...new Set(subset.flatMap(item => item.topics))];
    const nodes = new Map();
    subset.forEach((item, i) => { const a = i / subset.length * Math.PI * 2 - Math.PI / 2; nodes.set(item.id, { x: 500 + Math.cos(a) * 370, y: 295 + Math.sin(a) * 230, item }); });
    usedTopics.forEach((id, i) => { const a = i / usedTopics.length * Math.PI * 2 - Math.PI / 2; nodes.set(`topic:${id}`, { x: 500 + Math.cos(a) * 145, y: 295 + Math.sin(a) * 120, topic: id }); });
    let lines = '';
    for (const item of subset) {
      const a = nodes.get(item.id);
      for (const id of item.topics) { const b = nodes.get(`topic:${id}`); lines += `<line class="topic-edge" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`; }
      for (const edge of item.related) { const b = nodes.get(edge.id); if (b) lines += `<path class="item-edge" d="M${a.x},${a.y} Q500,295 ${b.x},${b.y}"/>`; }
    }
    const dots = [...nodes.values()].map(node => {
      const label = node.item ? node.item.title : data.taxonomy.topics[node.topic].title;
      const href = node.item ? node.item.url : `${base}/?topic=${node.topic}&view=connections#grounds`;
      const rows = [''];
      for (const word of label.split(' ')) { if ((rows.at(-1) + word).length > 23) rows.push(''); rows[rows.length - 1] += `${word} `; }
      return `<a href="${e(href)}" class="graph-node ${node.item ? 'item-node' : 'topic-node'}" aria-label="${e(label)}"><circle cx="${node.x}" cy="${node.y}" r="${node.item ? 9 : 5}"/><text x="${node.x}" y="${node.y + 27}" text-anchor="middle">${rows.map((row, i) => `<tspan x="${node.x}" dy="${i ? 17 : 0}">${e(row.trim())}</tspan>`).join('')}</text></a>`;
    }).join('');
    document.querySelector('#network').innerHTML = `<div class="network-art"><span class="map-corner">FOLLOW A THREAD${matches.length > 30 ? ' · FIRST 30 MATCHES' : ''}</span><svg viewBox="0 0 1000 600" role="group" aria-label="Connections between matching entries and topics">${lines}${dots}</svg><div class="graph-legend"><span><i></i>entry</span><span><i class="topic"></i>topic</span><span>Solid: shared topic · curved: explicit connection</span></div></div>`;
    const ids = new Set(matches.map(item => item.id));
    const edges = matches.flatMap(item => item.related.filter(edge => ids.has(edge.id)).map(edge => {
      const target = data.items.find(candidate => candidate.id === edge.id);
      return `<li><div><a href="${e(item.url)}">${e(item.title)}</a><span>↔</span><a href="${e(target.url)}">${e(target.title)}</a></div><p>${e(edge.reason)}</p></li>`;
    }));
    document.querySelector('#relationship-list').innerHTML = `<details class="connection-details"${matchMedia('(max-width: 600px)').matches ? ' open' : ''}><summary>Read the connections <span>${edges.length}</span></summary><ul class="relationship-list">${edges.join('') || '<li>No explicit connections between these entries yet. Shared topics are a starting point.</li>'}</ul></details>`;
  }

  function render({ url = true, push = false } = {}) {
    const terms = normalize(state.q).trim().split(/\s+/).filter(Boolean);
    matches = data.items.filter(item => (state.domain === 'all' || item.domain === state.domain) && (state.type === 'all' || item.type === state.type) && (state.topic === 'all' || item.topics.includes(state.topic)) && terms.every(term => searchable.get(item.id).includes(term)));
    const ids = new Set(matches.map(item => item.id));
    document.querySelectorAll('.grave, .index-row').forEach(node => { node.hidden = !ids.has(node.dataset.id); });
    for (const view of views) {
      document.querySelector(`#${view}-view`).hidden = state.view !== view || !matches.length;
      document.querySelector(`[data-view="${view}"]`).setAttribute('aria-pressed', String(state.view === view));
    }
    document.querySelectorAll('button[data-domain]').forEach(button => { const active = button.dataset.domain === state.domain; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    const filtered = state.q || state.domain !== 'all' || state.type !== 'all' || state.topic !== 'all';
    document.querySelector('#result-count').textContent = filtered ? `${matches.length} of ${data.items.length} things found` : `${data.items.length} things resting here`;
    document.querySelector('#clear-filters').hidden = !filtered;
    document.querySelector('#empty-state').hidden = matches.length !== 0;
    document.querySelectorAll('.random-button').forEach(button => { button.hidden = false; button.disabled = !matches.length; });
    if (state.view === 'connections' && matches.length) drawNetwork();
    if (url) syncURL(push);
  }

  search.addEventListener('input', () => { state.q = search.value; render(); });
  type.addEventListener('change', () => { state.type = type.value; render({ push: true }); });
  topic.addEventListener('change', () => { state.topic = topic.value; render({ push: true }); });
  document.querySelectorAll('button[data-domain]').forEach(button => button.addEventListener('click', () => { state.domain = button.dataset.domain; render({ push: true }); }));
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { state.view = button.dataset.view; render({ push: true }); }));
  function reset() { state = { ...state, q: '', domain: 'all', type: 'all', topic: 'all' }; search.value = ''; type.value = 'all'; topic.value = 'all'; render({ push: true }); search.focus({ preventScroll: true }); }
  document.querySelector('#clear-filters').addEventListener('click', reset);
  document.querySelector('#empty-reset').addEventListener('click', reset);
  document.querySelectorAll('.random-button').forEach(button => button.addEventListener('click', () => { if (matches.length) location.href = matches[Math.floor(Math.random() * matches.length)].url; }));
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !dialog.open && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) { event.preventDefault(); search.focus(); }
    if (event.key === 'Escape' && document.activeElement === search) { search.value = ''; state.q = ''; render(); search.blur(); }
  });
  window.addEventListener('popstate', () => { readURL(); render({ url: false }); });
  readURL(); render({ url: false });
})();
