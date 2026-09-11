import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { loadCatalog, connections } from '../scripts/catalog.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graveyard-catalog-test-'));
  for (const name of ['collection', 'site', 'taxonomy.json']) fs.cpSync(path.join(process.cwd(), name), path.join(root, name), { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true }));
  return root;
}
function edit(root, id, update) {
  const item = loadCatalog(root).byId.get(id);
  const file = path.join(item.directory, 'item.json');
  fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, 'utf8')), ...update }, null, 2));
}

test('build supports a project base path, real source pages, and backlinks', t => {
  const root = fixture(t);
  const { catalog, out } = build(root, { base: '/graveyard' });
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.match(html, /href="\/graveyard\/assets\/style.css"/);
  assert.match(html, /data-theme="dark"/);
  assert.ok(connections(catalog.byId.get('pocket-inventory'), catalog).some(edge => edge.kind === 'Backlink'));
  assert.ok(fs.existsSync(path.join(out, 'items/pocket-inventory/source/inventory.mjs.html')));
  assert.ok(!fs.existsSync(path.join(out, 'items/pocket-inventory/inventory.mjs')));
  assert.ok(!fs.existsSync(path.join(out, 'collection')));
  assert.ok(!fs.existsSync(path.join(out, 'inbox')));
  assert.ok(!fs.existsSync(path.join(out, '.git')));
});

test('unpublished content is absent from pages, search, and relationship data', t => {
  const root = fixture(t);
  edit(root, 'one-good-connection', { publish: false, summary: 'UNPUBLISHED_SENTINEL' });
  // A public prose link to an unpublished item must be removed before a build.
  // This particular item is referenced only by metadata relationships.
  const { out } = build(root);
  const js = fs.readFileSync(path.join(out, 'assets/catalog.js'), 'utf8');
  assert.ok(!js.includes('UNPUBLISHED_SENTINEL'));
  assert.ok(!js.includes('"id":"one-good-connection"'));
  assert.ok(!fs.existsSync(path.join(out, 'items/one-good-connection')));
  const html = fs.readFileSync(path.join(out, 'items/compost-the-plan/index.html'), 'utf8');
  assert.ok(!html.includes('/items/one-good-connection/'));
});

test('raw HTML, metadata, and source render as text; no remote images load', t => {
  const root = fixture(t);
  const item = loadCatalog(root).byId.get('one-good-connection');
  edit(root, item.id, { title: '</h1><script>window.bad=1</script>', files: ['example.html'] });
  fs.appendFileSync(path.join(item.directory, 'README.md'), '\n<script>window.bad=2</script>\n\n![Example](https://example.com/picture.png)\n\n[bad](javascript:alert(1))\n');
  fs.writeFileSync(path.join(item.directory, 'example.html'), '<script>window.bad=3</script>');
  const { out } = build(root);
  const html = fs.readFileSync(path.join(out, `items/${item.id}/index.html`), 'utf8');
  assert.ok(!html.includes('<script>window.bad'));
  assert.ok(html.includes('&lt;script&gt;window.bad'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('href="javascript:'));
  const source = fs.readFileSync(path.join(out, `items/${item.id}/source/example.html.html`), 'utf8');
  assert.ok(source.includes('&lt;script&gt;window.bad=3'));
  assert.ok(!source.includes('<script>window.bad=3'));
});

test('rejects traversal, missing topics, impossible dates, and broken relationships', t => {
  for (const update of [{ files: ['../elsewhere.txt'] }, { topics: ['imaginary'] }, { added: '2026-02-30' }, { related: [{ id: 'missing', reason: 'No such entry' }] }]) {
    const root = fixture(t);
    edit(root, 'pocket-inventory', update);
    assert.throws(() => loadCatalog(root));
  }
});

test('rejects symlink directories and public links to unpublished entries', t => {
  const root = fixture(t);
  edit(root, 'project-eulogy', { publish: false });
  assert.throws(() => loadCatalog(root), /unpublished local link/);
  const second = fixture(t);
  fs.symlinkSync(os.tmpdir(), path.join(second, 'collection/computing/escape'));
  assert.throws(() => loadCatalog(second), /symlinks/);
});

test('refuses to delete an unrelated pre-existing output directory', t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, '_site'));
  fs.writeFileSync(path.join(root, '_site', 'user.txt'), 'keep');
  assert.throws(() => build(root), /Refusing to replace/);
  assert.equal(fs.readFileSync(path.join(root, '_site/user.txt'), 'utf8'), 'keep');
});
