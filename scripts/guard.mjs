import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const MAX_BYTES = 512 * 1024;
const forbiddenExtension = /\.(?:zip|tar|gz|tgz|bz2|xz|7z|rar|pdf|epub|docx?|xlsx?|pptx?|odt|ods|db|sqlite\d*|mdb|dump|bak|exe|dll|so|dylib|a|o|class|jar|pyc|wasm|bin|iso|dmg|deb|rpm|apk|png|jpe?g|gif|webp|avif|ico|bmp|tiff?|mp[34]|m[4k]v|mov|avi|wav|ogg|flac|woff2?|ttf|otf|eot|parquet|arrow|feather)$/i;
const forbiddenDirectory = /(?:^|\/)(?:node_modules|vendor|dist|build|_site|\.cache|\.venv|venv|__pycache__)(?:\/|$)/;
const sensitivePath = /(?:^|\/)(?:\.env(?:\.(?!example$)[^/]+)?|id_(?:rsa|ed25519|ecdsa)|credentials(?:\.json)?|service-account[^/]*\.json)(?:$|\/)|\.(?:pem|key|p12|pfx)$/i;
const patterns = [
  ['private key', /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ['cloud access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['service token', /\b(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}|xox[baprs]-[A-Za-z0-9-]{20,})\b/],
  ['credential in URL', /\b[a-z][a-z0-9+.-]{0,31}:\/\/[^\s/:]+:[^\s/@]+@/i],
  ['signed or credential URL', /[?&](?:access_token|api_key|apikey|token|signature|x-amz-signature|x-amz-credential|x-goog-signature|sig)=[A-Za-z0-9%_+./=-]{12,}/i],
  ['literal credential', /\b(?:password|passwd|api[_-]?key|client[_-]?secret|auth[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_+/.=-]{12,}["']/i],
  ['Git LFS pointer', /^version https:\/\/git-lfs.github.com\/spec\/v1/m],
  ['database dump', /(?:^-- (?:MySQL|PostgreSQL) database dump|^SQLite format 3)/m],
];

export function inspectFile(name, bytes, mode = '100644') {
  const issues = [];
  const normalized = name.split(path.sep).join('/');
  if (!['100644', '100755'].includes(mode)) issues.push('symlink, submodule, or non-regular file');
  if (forbiddenExtension.test(normalized)) issues.push('forbidden artifact extension');
  if (forbiddenDirectory.test(normalized)) issues.push('generated or vendored directory');
  if (sensitivePath.test(normalized)) issues.push('credential file path');
  if (bytes.length > MAX_BYTES) { issues.push('file exceeds 512 KiB'); return issues; }
  let content;
  try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { issues.push('non-UTF-8 binary content'); return issues; }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(content)) issues.push('binary control bytes');
  if (/^%PDF-|^PK\x03\x04/.test(content)) issues.push('binary file signature');
  for (const [rule, pattern] of patterns) if (pattern.test(content)) issues.push(rule);
  return issues;
}

export const git = (args, cwd = process.cwd(), encoding = 'utf8') => execFileSync('git', args, { cwd, encoding, maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
const split0 = value => value.split('\0').filter(Boolean);

export function scan(mode, root = process.cwd(), refs = ['--all']) {
  const failures = [];
  let checked = 0;
  const examine = (name, bytes, fileMode) => {
    checked++;
    const issues = inspectFile(name, bytes, fileMode);
    if (issues.length) failures.push(`${JSON.stringify(name)}: ${issues.join(', ')}`);
  };
  if (mode === '--worktree') {
    const names = new Set(split0(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], root)));
    for (const name of names) {
      const full = path.join(root, name);
      let info;
      try { info = fs.lstatSync(full); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      if (!info.isFile() || info.isSymbolicLink()) { examine(name, Buffer.alloc(0), '120000'); continue; }
      if (info.size > MAX_BYTES) { failures.push(`${JSON.stringify(name)}: file exceeds 512 KiB`); continue; }
      examine(name, fs.readFileSync(full), '100644');
    }
  } else {
    const snapshots = mode === '--staged' ? [null] : git(['rev-list', ...refs], root).trim().split('\n').filter(Boolean);
    const seen = new Set();
    for (const commit of snapshots) {
      const records = split0(git(commit ? ['ls-tree', '-rz', '--full-tree', commit] : ['ls-files', '--stage', '-z'], root));
      for (const record of records) {
        const tab = record.indexOf('\t');
        const name = record.slice(tab + 1);
        const [fileMode, middle, last] = record.slice(0, tab).split(' ');
        const oid = commit ? last : middle;
        const key = `${fileMode}:${oid}:${name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!['100644', '100755'].includes(fileMode)) { examine(name, Buffer.alloc(0), fileMode); continue; }
        const size = Number(git(['cat-file', '-s', oid], root));
        if (size > MAX_BYTES) { failures.push(`${JSON.stringify(name)}: file exceeds 512 KiB in Git`); continue; }
        examine(name, git(['cat-file', 'blob', oid], root, null), fileMode);
      }
    }
  }
  if (failures.length) throw new Error(`Gate closed:\n${failures.join('\n')}\nReview and remove the material. Do not bypass the hook.`);
  return checked;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const mode = process.argv[2] || '--worktree';
    if (!['--worktree', '--staged', '--history'].includes(mode)) throw new Error('Unknown scan mode');
    console.log(`File gate passed: ${scan(mode)} file versions checked.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
