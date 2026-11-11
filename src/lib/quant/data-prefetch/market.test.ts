import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QuantRunPlan } from '@/lib/domains/finance/workspace';
import { fetchSymbolDataset } from './market';

const projects: string[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(projects.splice(0).map((project) => fs.rm(project, { recursive: true, force: true })));
});

describe('backtest experiment artifacts', () => {
  it.each([false, true])('passes explicit research parameters and rejects mismatched execution: %s', async mismatch => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'qp-backtest-params-'));
    projects.push(projectPath);
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url);
      if (url.includes('/quotes/realtime/')) return new Response(JSON.stringify({ symbol: '510300', asset_type: 'etf' }));
      const query = new URL(url).searchParams;
      const curve = [{ date: '2024-01-02', equity: '1' }, { date: '2024-06-28', equity: '1.1' }];
      return new Response(JSON.stringify({
        symbol: '510300', strategy_id: 'ma_crossover', fast_window: mismatch ? 20 : Number(query.get('fast_window')),
        slow_window: Number(query.get('slow_window')), fee_bps: query.get('fee_bps'),
        period: query.get('period'), adjustment: query.get('adjustment'),
        evaluation_start: query.get('start'), evaluation_end: query.get('end'), equity_curve: curve,
        summary: { initial_cash: query.get('initial_cash'), start_date: curve[0].date,
          end_date: curve[1].date, sample_count: curve.length },
      }));
    }));
    const promise = fetchSymbolDataset({ projectPath, runId: 'explicit', symbol: '510300', rawFiles: [], warnings: [],
      plan: { capabilityId: 'backtest_review', question: '2024年上半年5/20日均线回测，手续费10bps',
        dataRequirements: ['/api/v1/backtests/ma-crossover/510300'] } as QuantRunPlan });
    if (mismatch) await expect(promise).rejects.toThrow('fast_window');
    else expect((await promise).backtest).toMatchObject({ fast_window: 5, slow_window: 20, fee_bps: '10' });
    const query = new URL(urls.find(url => url.includes('/backtests/'))!).searchParams;
    expect(Object.fromEntries(query)).toMatchObject({ start: '2024-01-01', end: '2024-06-30',
      fast_window: '5', slow_window: '20', fee_bps: '10' });
  });

  it('keeps complete inputs in the raw artifact and only a reference in research context', async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'qp-backtest-artifact-'));
    projects.push(projectPath);
    const equityCurve = Array.from({ length: 250 }, (_, index) => ({
      date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10), equity: '1',
    }));
    const artifact = {
      symbol: '510300',
      strategy_id: 'ma_crossover', fast_window: 20, slow_window: 60, fee_bps: '5',
      period: 'daily', adjustment: 'qfq', evaluation_start: null, evaluation_end: '2026-01-02',
      equity_curve: equityCurve,
      summary: { total_return_pct: '5.2', initial_cash: '1', start_date: equityCurve[0].date,
        end_date: equityCurve.at(-1)!.date, sample_count: equityCurve.length },
      experiment: {
        schema_version: 1,
        experiment_id: `sha256:${'a'.repeat(64)}`,
        data_sha256: `sha256:${'b'.repeat(64)}`,
        result_sha256: `sha256:${'c'.repeat(64)}`,
        data: { bars: [{ date: '2026-01-01', close: '10.1234567890123456789' }] },
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/backtests/')) return new Response(JSON.stringify(artifact));
        if (url.includes('/quotes/realtime/'))
          return new Response(
            JSON.stringify({
              symbol: '510300',
              asset_type: 'etf',
              fetched_at: '2026-01-02T00:00:00Z',
            })
          );
        throw new Error(`Unexpected network access: ${url}`);
      })
    );
    const rawFiles: string[] = [];
    const warnings: string[] = [];
    const result = await fetchSymbolDataset({
      projectPath,
      runId: 'replay-fixture',
      symbol: '510300',
      rawFiles,
      warnings,
      plan: {
        capabilityId: 'backtest_review',
        question: '回看已归档的回测',
        createdAt: '2026-01-02T00:00:00Z',
        dataRequirements: ['/api/v1/backtests/ma-crossover/510300'],
      } as QuantRunPlan,
    });
    const artifactPath = `data_file/raw/replay-fixture/510300/backtest-ma-crossover-${'a'.repeat(64)}.json`;
    expect(JSON.parse(await fs.readFile(path.join(projectPath, artifactPath), 'utf8'))).toEqual(artifact);
    const researchArtifact = { ...artifact, experiment: undefined };
    delete researchArtifact.experiment;
    expect(result.backtest).toEqual({
      ...researchArtifact,
      experiment_ref: {
        artifact_path: artifactPath,
        experiment_id: artifact.experiment.experiment_id,
        data_sha256: artifact.experiment.data_sha256,
        result_sha256: artifact.experiment.result_sha256,
      },
    });
    expect(JSON.stringify(result)).not.toContain('10.1234567890123456789');
    expect(rawFiles).toContain(artifactPath);
    expect(warnings).toEqual([]);

    const original = structuredClone(artifact);
    artifact.experiment.experiment_id = `sha256:${'d'.repeat(64)}`;
    artifact.experiment.data.bars[0].close = '99';
    await fetchSymbolDataset({
      projectPath,
      runId: 'replay-fixture',
      symbol: '510300',
      rawFiles,
      warnings,
      plan: { createdAt: '2026-01-02T00:00:00Z',
        dataRequirements: ['/api/v1/backtests/ma-crossover/510300'] } as QuantRunPlan,
    });
    expect(JSON.parse(await fs.readFile(path.join(projectPath, artifactPath), 'utf8'))).toEqual(original);
    expect(rawFiles).toContain(`data_file/raw/replay-fixture/510300/backtest-ma-crossover-${'d'.repeat(64)}.json`);
  });
});
