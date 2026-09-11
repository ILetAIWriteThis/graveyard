import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectFile, scan, git, MAX_BYTES } from '../scripts/guard.mjs';

const fakeToken = () => ['gh', 'p_', 'A9b2C3d4'.repeat(5)].join('');
function repo(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'graveyard-gate-test-'));
  git(['init', '--quiet'], root);
  git(['config', 'user.email', 'test@example.invalid'], root);
  git(['config', 'user.name', 'Gate test'], root);
  git(['config', 'core.hooksPath', path.join(root, 'no-hooks')], root);
  t.after(() => fs.rmSync(root, { recursive: true }));
  return root;
}

test('blocks oversized, disguised binary, invalid UTF-8, heavy paths, and symlinks', () => {
  assert.ok(inspectFile('large.txt', Buffer.alloc(MAX_BYTES + 1, 65)).some(issue => issue.includes('512')));
  for (const bytes of [Buffer.from([0, 1, 2]), Buffer.from([0xc3, 0x28]), Buffer.from('%PDF-1.7')]) assert.ok(inspectFile('innocent.txt', bytes).length);
  for (const name of ['x.ZIP', 'notes.pdf', 'data.sqlite3', 'vendor/a.txt', 'node_modules/readme.md', '.env', '.env.production', 'id_rsa', 'credentials.json']) assert.ok(inspectFile(name, Buffer.from('hello')).length, name);
  assert.ok(inspectFile('link', Buffer.from('../secret'), '120000').length);
  assert.deepEqual(inspectFile('drawing.svg', Buffer.from('<svg></svg>')), []);
  assert.deepEqual(inspectFile('.env.example', Buffer.from('APP_NAME=graveyard')), []);
  assert.deepEqual(inspectFile('schema.sql', Buffer.from('CREATE TABLE ideas (id INTEGER);')), []);
});

test('reports rules without repeating the secret', () => {
  const issues = inspectFile('settings.txt', Buffer.from(fakeToken()));
  assert.ok(issues.includes('GitHub token'));
  assert.ok(!issues.join('').includes(fakeToken()));
});

test('staged scan reads index bytes even when the working copy has been sanitized', t => {
  const root = repo(t);
  fs.writeFileSync(path.join(root, 'settings.txt'), fakeToken());
  git(['add', 'settings.txt'], root);
  fs.writeFileSync(path.join(root, 'settings.txt'), 'REDACTED');
  assert.equal(scan('--worktree', root), 1);
  assert.throws(() => scan('--staged', root), /GitHub token/);
});

test('history scan catches a secret and binary removed by a later commit', t => {
  const root = repo(t);
  fs.writeFileSync(path.join(root, 'old.txt'), fakeToken());
  fs.writeFileSync(path.join(root, 'payload.txt'), Buffer.from([0, 0xff, 1]));
  git(['add', '.'], root); git(['commit', '-qm', 'unsafe old version'], root);
  fs.writeFileSync(path.join(root, 'old.txt'), 'clean now');
  fs.unlinkSync(path.join(root, 'payload.txt'));
  git(['add', '-A'], root); git(['commit', '-qm', 'remove material'], root);
  assert.equal(scan('--worktree', root), 1);
  assert.equal(scan('--staged', root), 1);
  assert.throws(() => scan('--history', root), /GitHub token/);
  assert.throws(() => scan('--history', root, ['HEAD']), /binary/);
});

test('forced-add artifacts are checked even when ignored', t => {
  const root = repo(t);
  fs.writeFileSync(path.join(root, '.gitignore'), '*.zip\n');
  fs.writeFileSync(path.join(root, 'heavy.zip'), 'not actually compressed');
  git(['add', '.gitignore'], root); git(['add', '-f', 'heavy.zip'], root);
  assert.throws(() => scan('--staged', root), /forbidden artifact/);
  assert.throws(() => scan('--worktree', root), /forbidden artifact/);
});
