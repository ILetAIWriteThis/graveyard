import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { git } from './guard.mjs';

export const VERSION = '8.30.1';
const MANIFEST_SHA256 = '061476c21adaf5441516f96f185c1a4706a83cd6329b9b38762271b3d4a52fae';
const digest = buffer => createHash('sha256').update(buffer).digest('hex');
export const binaryPath = root => path.join(root, '.cache', `gitleaks-${VERSION}`, 'gitleaks');

export async function install(root = process.cwd()) {
  const target = binaryPath(root);
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isSymbolicLink()) throw new Error('Refusing a symlinked Gitleaks binary');
    if (execFileSync(target, ['version'], { encoding: 'utf8' }).trim() === VERSION) return target;
    throw new Error('Cached Gitleaks version differs from the pin. Review the cache before replacing it.');
  }
  const platform = { linux: 'linux', darwin: 'darwin' }[process.platform];
  const arch = { x64: 'x64', arm64: 'arm64' }[process.arch];
  if (!platform || !arch) throw new Error('Automatic hook setup supports Linux/macOS x64/arm64. Use WSL on Windows.');
  const asset = `gitleaks_${VERSION}_${platform}_${arch}.tar.gz`;
  const origin = `https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}`;
  async function download(name) {
    const response = await fetch(`${origin}/${name}`, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Gitleaks download failed (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }
  const manifest = await download(`gitleaks_${VERSION}_checksums.txt`);
  if (digest(manifest) !== MANIFEST_SHA256) throw new Error('Gitleaks checksum manifest failed its pinned SHA-256 verification');
  const expected = manifest.toString('utf8').split('\n').map(line => line.trim().split(/\s+/)).find(parts => parts[1] === asset)?.[0];
  if (!expected || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('No checksum for this Gitleaks platform');
  const archive = await download(asset);
  if (digest(archive) !== expected) throw new Error('Gitleaks archive checksum mismatch');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'graveyard-gitleaks-'));
  try {
    const tar = path.join(temp, 'release.tar.gz');
    fs.writeFileSync(tar, archive);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    execFileSync('tar', ['-xzf', tar, '-C', path.dirname(target), 'gitleaks']);
    fs.chmodSync(target, 0o755);
    console.log(`Installed checksum-verified Gitleaks ${VERSION} into ignored .cache/.`);
  } finally { fs.rmSync(temp, { recursive: true }); }
  return target;
}

export function runGitleaks(args, root = process.cwd()) {
  const binary = binaryPath(root);
  if (!fs.existsSync(binary)) throw new Error('Gitleaks is required. Run npm run setup (or npm run tools in CI).');
  const result = spawnSync(binary, [...args, '--redact', '--no-banner', '--ignore-gitleaks-allow', '--config', path.join(root, '.gitleaks.toml')], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Gitleaks gate closed. Review the redacted findings; do not bypass the check.');
}

function audit(root) {
  // Scan the exact set Git can publish, excluding ignored dependencies and tool caches.
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'graveyard-audit-'));
  try {
    const files = new Set(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], root).split('\0').filter(Boolean));
    for (const name of files) {
      const source = path.join(root, name);
      if (!fs.existsSync(source)) continue;
      if (!fs.lstatSync(source).isFile()) throw new Error('Audit requires regular files only');
      const dest = path.join(temp, name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(source, dest);
    }
    runGitleaks(['dir', temp], root);
  } finally { fs.rmSync(temp, { recursive: true }); }
  runGitleaks(['git', '--log-opts=--all'], root);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === '--install') await install();
    else if (process.argv[2] === '--audit') audit(process.cwd());
    else throw new Error('Use --install or --audit');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
