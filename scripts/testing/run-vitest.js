const { spawnSync } = require('node:child_process');
const path = require('node:path');

const vitest = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
const result = spawnSync(process.execPath, [vitest, 'run', ...process.argv.slice(2)], {
  cwd: path.resolve(__dirname, '../..'),
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
