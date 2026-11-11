import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { backtestRequestQuery, backtestResponseMismatches, compileBacktestRequest } from './backtest-request';

let child: ChildProcess;
let baseUrl: string;

beforeAll(async () => {
  child = spawn(process.execPath, ['scripts/evals/run-contract-market-fixture.js'], {
    env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  baseUrl = await new Promise<string>((resolve, reject) => {
    let output = '';
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Fixture exited before ready: ${code}`)));
    child.stdout!.on('data', chunk => {
      output += String(chunk);
      const url = output.match(/listening on (http:\/\/[^\s]+)/)?.[1];
      if (url) resolve(url);
    });
  });
});

afterAll(async () => {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
});

it('satisfies the frozen default MA request and rejects unsupported execution inputs', async () => {
  const spec = compileBacktestRequest({ question: '最近一年20/60日均线回测510300',
    timeRange: { label: '最近一年', unit: 'year', value: 1, source: 'explicit' } });
  const endpoint = `${baseUrl}/api/v1/backtests/ma-crossover/510300`;
  const response = await fetch(`${endpoint}?${backtestRequestQuery(spec)}`);
  expect(response.status).toBe(200);
  expect(backtestResponseMismatches(spec, await response.json())).toEqual([]);
  for (const query of ['fast_window=5', 'fee_bps=10', 'end=2000-01-01']) {
    expect((await fetch(`${endpoint}?${query}`)).status).toBe(400);
  }
});
