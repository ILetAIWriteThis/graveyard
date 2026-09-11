import fs from 'node:fs';
import path from 'node:path';
import { install } from './gitleaks.mjs';
import { git } from './guard.mjs';

try {
  let previous = '';
  try { previous = git(['config', '--get', 'core.hooksPath']).trim(); } catch { /* Not configured yet. */ }
  if (previous && previous !== '.githooks') throw new Error(`Existing hooksPath ${JSON.stringify(previous)} will not be replaced. Integrate scripts/hooks.mjs into those hooks.`);
  const defaultHooks = git(['rev-parse', '--git-path', 'hooks']).trim();
  if (!previous && ['pre-commit', 'pre-push'].some(name => fs.existsSync(path.join(defaultHooks, name)))) throw new Error('Existing Git hooks found. Integrate scripts/hooks.mjs without replacing them.');
  await install();
  for (const name of ['pre-commit', 'pre-push']) fs.chmodSync(path.join('.githooks', name), 0o755);
  git(['config', '--local', 'core.hooksPath', '.githooks']);
  console.log('Caretaker on duty: pre-commit and pre-push hooks installed for this clone.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
