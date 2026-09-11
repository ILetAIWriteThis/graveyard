import fs from 'node:fs';
import { scan } from './guard.mjs';
import { runGitleaks } from './gitleaks.mjs';

try {
  if (process.argv[2] === 'pre-commit') {
    console.log(`Checking the staged snapshot (${scan('--staged')} file versions).`);
    runGitleaks(['git', '--pre-commit', '--staged']);
  } else if (process.argv[2] === 'pre-push') {
    // Git supplies local ref/SHA and remote ref/SHA for every ref being pushed.
    // Scan all reachable history from each outgoing tip, so new branches, tags,
    // force pushes, and secrets deleted in later commits receive the same gate.
    const tips = [...new Set(fs.readFileSync(0, 'utf8').split('\n').filter(Boolean).map(line => line.split(' ')[1]).filter(sha => !/^0+$/.test(sha)))];
    for (const tip of tips) {
      if (!/^[a-f0-9]{40,64}$/.test(tip)) throw new Error('Unexpected push ref; refusing an incomplete audit');
      console.log(`Checking outgoing history (${scan('--history', process.cwd(), [tip])} file versions).`);
      runGitleaks(['git', `--log-opts=${tip}`]);
    }
  } else throw new Error('Unknown hook');
} catch (error) { console.error(error.message); process.exitCode = 1; }
