import { readdir, lstat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const excluded = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', '.cache', '.env']);
const limit = 500;
let count = 0;
const escape = value => JSON.stringify(value).replaceAll('`', '\\u0060');

async function walk(directory, depth = 0) {
  if (depth > 6) { console.log('- [depth limit reached]'); return; }
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch { console.log('- [unreadable directory skipped]'); return; }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (count >= limit) return;
    if (excluded.has(entry.name) || entry.isSymbolicLink()) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) { await walk(full, depth + 1); continue; }
    if (!entry.isFile()) continue;
    try {
      const info = await lstat(full);
      if (!info.isFile()) continue;
      console.log(`- \`${escape(path.relative(root, full))}\` — ${info.size} bytes`);
      count++;
    } catch { console.log('- [unreadable file skipped]'); }
  }
}

const info = await lstat(root);
if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Choose a real directory, not a symlink.');
console.log('# Pocket inventory\n');
await walk(root);
console.log(`\n${count} files listed.${count >= limit ? ' Limit reached; inventory may be incomplete.' : ''}`);
