const { spawnSync } = require('node:child_process');

const omitted = process.env.npm_config_omit?.split(/\s+/) ?? [];
const included = process.env.npm_config_include?.split(/\s+/) ?? [];
const productionOnly = !included.includes('dev') && (
  omitted.includes('dev') || process.env.NODE_ENV === 'production'
);

if (!productionOnly) {
  const install = spawnSync(process.execPath, [
    process.env.npm_execpath, 'ci', '--prefix', __dirname,
  ], { stdio: 'inherit' });
  if (install.error) throw install.error;
  process.exitCode = install.status ?? 1;
}
