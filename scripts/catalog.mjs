import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { inspectFile } from './guard.mjs';

export const types = ['project', 'script', 'resource', 'thought', 'quote', 'solution', 'fragment'];
export const statuses = ['resting', 'seed', 'revived'];
export const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fail = (where, message) => { throw new Error(`${where}: ${message}`); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
export const headingId = value => value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-') || 'section';

export function safeURL(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

function readText(file) {
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink()) fail(file, 'expected a regular text file');
  if (info.size > 512 * 1024) fail(file, 'file exceeds 512 KiB');
  const bytes = fs.readFileSync(file);
  const issues = inspectFile(file, bytes);
  if (issues.length) fail(file, issues.join(', '));
  return bytes.toString('utf8');
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) fail(full, 'symlinks are not allowed');
    return entry.isDirectory() ? walk(full) : [full];
  });
}

export function loadCatalog(root = process.cwd()) {
  const taxonomy = JSON.parse(readText(path.join(root, 'taxonomy.json')));
  for (const group of ['domains', 'topics']) {
    if (!plain(taxonomy[group])) fail('taxonomy', `missing ${group}`);
    for (const [id, definition] of Object.entries(taxonomy[group])) {
      if (!slug.test(id) || !text(definition.title) || !text(definition.description)) fail('taxonomy', `invalid ${group} definition`);
    }
  }
  if (!Array.isArray(taxonomy.bridges)) fail('taxonomy', 'bridges must be an array');
  for (const bridge of taxonomy.bridges) {
    if (!taxonomy.topics[bridge.from] || !taxonomy.topics[bridge.to] || bridge.from === bridge.to || !text(bridge.reason)) fail('taxonomy', 'invalid topic bridge');
  }
  for (const domain of Object.keys(taxonomy.domains)) readText(path.join(root, 'collection', domain, 'README.md'));
  const allFiles = walk(path.join(root, 'collection'));
  // Inspect all collection content, even source not selected for publication.
  for (const file of allFiles) readText(file);
  const keys = ['id', 'title', 'domain', 'type', 'status', 'added', 'summary', 'epitaph', 'revive_when', 'topics', 'related', 'sources', 'files', 'provenance', 'origin', 'publish'];
  const items = allFiles.filter(file => path.basename(file) === 'item.json').map(file => {
    const item = JSON.parse(readText(file));
    if (!plain(item) || Object.keys(item).some(key => !keys.includes(key))) fail(file, 'unknown metadata fields');
    for (const key of ['id', 'title', 'domain', 'summary', 'epitaph', 'revive_when', 'origin']) if (!text(item[key])) fail(file, `missing ${key}`);
    if (!slug.test(item.id) || !taxonomy.domains[item.domain]) fail(file, 'invalid ID or domain');
    if (path.relative(root, file).split(path.sep).join('/') !== `collection/${item.domain}/${item.id}/item.json`) fail(file, 'folder must match domain and ID');
    if (!types.includes(item.type) || !statuses.includes(item.status)) fail(file, 'unknown type or status');
    if (!['user', 'external', 'caretaker'].includes(item.provenance) || typeof item.publish !== 'boolean') fail(file, 'invalid provenance or publish flag');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.added) || Number.isNaN(Date.parse(item.added)) || new Date(item.added).toISOString().slice(0, 10) !== item.added) fail(file, 'invalid intake date');
    for (const key of ['topics', 'related', 'sources', 'files']) if (!Array.isArray(item[key])) fail(file, `${key} must be an array`);
    if (!item.topics.length || item.topics.some(topic => !taxonomy.topics[topic]) || new Set(item.topics).size !== item.topics.length) fail(file, 'unknown, duplicate, or missing topics');
    if (new Set(item.files).size !== item.files.length) fail(file, 'duplicate source files');
    if (new Set(item.related.map(edge => edge.id)).size !== item.related.length) fail(file, 'duplicate relationships');
    for (const source of item.sources) if (!safeURL(source.url) || !text(source.label)) fail(file, 'sources require public HTTP(S) URLs and labels');
    if (['resource', 'quote'].includes(item.type) && !item.sources.length) fail(file, 'resources and quotes require attribution URLs');
    const directory = path.dirname(file);
    const markdown = readText(path.join(directory, 'README.md'));
    for (const section of ['WHAT', 'WHY']) if (!new RegExp(`^## ${section}\\s*$`, 'm').test(markdown)) fail(file, `README needs ## ${section}`);
    const sourceFiles = item.files.map(name => {
      if (typeof name !== 'string' || !name || name.includes('\\') || name.split('/').some(part => !part || part === '..' || part === '.') || path.isAbsolute(name) || ['README.md', 'item.json'].includes(name)) fail(file, 'unsafe source path');
      const full = path.join(directory, name);
      // walk() already rejected symlinks in parent directories.
      if (!allFiles.includes(full)) fail(file, 'source file is missing');
      return { name, text: readText(full), full };
    });
    return { ...item, directory, markdown, sourceFiles };
  }).sort((a, b) => b.added.localeCompare(a.added) || a.id.localeCompare(b.id));
  const byId = new Map();
  for (const item of items) {
    if (byId.has(item.id)) fail(item.id, 'duplicate ID');
    byId.set(item.id, item);
  }
  for (const item of items) for (const edge of item.related) {
    if (!byId.has(edge.id) || edge.id === item.id || !text(edge.reason)) fail(item.id, 'invalid relationship target or explanation');
  }
  const catalog = { root, taxonomy, items, published: items.filter(item => item.publish), byId };
  for (const item of items) renderMarkdown(item, catalog, '');
  return catalog;
}

export const itemURL = (item, base = '') => `${base}/items/${item.id}/`;
export const sourceURL = (item, name, base = '') => `${itemURL(item, base)}source/${name.split('/').map(encodeURIComponent).join('/')}.html`;

export function renderMarkdown(item, catalog, base) {
  const targets = new Map();
  for (const candidate of catalog.items) {
    targets.set(path.join(candidate.directory, 'README.md'), { url: itemURL(candidate, base), item: candidate });
    for (const file of candidate.sourceFiles) targets.set(file.full, { url: sourceURL(candidate, file.name, base), item: candidate });
  }
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
  const seen = new Map();
  md.renderer.rules.heading_open = (tokens, index, options, env, self) => {
    const stem = headingId(tokens[index + 1].content);
    const count = seen.get(stem) || 0;
    seen.set(stem, count + 1);
    tokens[index].attrSet('id', count ? `${stem}-${count}` : stem);
    return self.renderToken(tokens, index, options);
  };
  const resolve = href => {
    if (safeURL(href)) return href;
    if (href.startsWith('#')) return href;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) fail(item.id, 'unsupported link protocol');
    const [local, fragment] = href.split('#');
    let decoded;
    try { decoded = decodeURIComponent(local); } catch { fail(item.id, 'invalid link encoding'); }
    const target = targets.get(path.resolve(item.directory, decoded));
    if (!target || (item.publish && !target.item.publish)) fail(item.id, `unresolved or unpublished local link: ${href}`);
    return target.url + (fragment ? `#${encodeURIComponent(decodeURIComponent(fragment))}` : '');
  };
  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    token.attrSet('href', resolve(token.attrGet('href')));
    token.attrSet('rel', 'noreferrer noopener');
    return self.renderToken(tokens, index, options);
  };
  md.renderer.rules.image = (tokens, index) => `<a href="${escape(resolve(tokens[index].attrGet('src')))}" rel="noreferrer noopener">${escape(tokens[index].content || 'Linked image')} ↗</a>`;
  return md.render(item.markdown.replace(/^# [^\n]+\n/, ''));
}

export function connections(item, catalog) {
  const results = new Map();
  for (const edge of item.related) if (catalog.byId.get(edge.id)?.publish) results.set(edge.id, { item: catalog.byId.get(edge.id), reason: edge.reason, kind: 'Connected' });
  for (const candidate of catalog.published) {
    const incoming = candidate.related.find(edge => edge.id === item.id);
    if (incoming && !results.has(candidate.id)) results.set(candidate.id, { item: candidate, reason: incoming.reason, kind: 'Backlink' });
  }
  for (const candidate of catalog.published) {
    const common = candidate.topics.filter(topic => item.topics.includes(topic));
    if (candidate.id !== item.id && common.length && !results.has(candidate.id)) results.set(candidate.id, { item: candidate, reason: `Shared topics: ${common.map(topic => catalog.taxonomy.topics[topic].title).join(', ')}.`, kind: 'Topic match' });
  }
  return [...results.values()];
}
