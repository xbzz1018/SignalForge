import { describe, expect, it } from 'vitest';

import { calculateMetrics, ensureTechnicalSummary } from './technical';

function series(closes: (number | null)[]) {
  return { bars: closes.map((close, index) => ({ date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10), close, high: close, low: close, volume: 100, amount: 1000 })) };
}

describe('technical metrics observation windows', () => {
  it.each(['duplicate', 'invalid'])('suppresses chronological metrics and stale summary values for %s dates', kind => {
    const input = series(Array.from({ length: 130 }, (_, i) => 100 + i));
    input.bars[5].date = kind === 'duplicate' ? input.bars[4].date : 'invalid';
    expect(calculateMetrics(input)).toMatchObject({ ma5: null, return20d: null, periodReturn: null,
      maxDrawdown: null, avgVolume20d: null });
    const asset = { kline: input, computedMetrics: { ma5: 999 },
      technicalIndicators: { summary: { ma5: 999, return_20d_pct: 88 },
        data_quality: { status: 'ok', warnings: ['provider warning'] } } };
    expect(ensureTechnicalSummary(asset)).toMatchObject({ ma5: null, return_20d_pct: null });
    expect(asset.technicalIndicators.data_quality.status).toBe('warning');
    expect(asset.technicalIndicators.data_quality.warnings).toContain('provider warning');
    expect(asset.technicalIndicators.data_quality.warnings).toContain('行情日期无效或重复，时序指标不可用。');
  });
  it('shows chronological sample bounds for reversed provider bars', () => {
    const input = series([100, 101, 102, 103, 104]);
    input.bars.reverse();
    expect(ensureTechnicalSummary({ kline: input }).sample_window).toContain('2025-01-01 至 2025-01-05');
  });
  it.each(['weekly', 'monthly', 'minute5'])('does not label %s samples as daily observations', period => {
    const kline = { ...series(Array.from({ length: 130 }, (_, i) => 100 + i)), period };
    expect(calculateMetrics(kline)).toMatchObject({ return20d: null, return60d: null, return120d: null,
      avgVolume20d: null, avgAmount20d: null, volatility20d: null });
    const summary = ensureTechnicalSummary({ kline, technicalIndicators: {
      summary: { return_20d_pct: 20, volatility_20d_annualized_pct: 30 },
    } });
    expect(summary).toMatchObject({ return_20d_pct: null, volatility_20d_annualized_pct: null });
    expect(String(summary.sample_window)).not.toContain('根日 K');
  });
  it('uses only the latest 20 returns for 20-day volatility', () => {
    const metrics = calculateMetrics(series([10, 90, 5, 100, ...Array<number>(21).fill(100)]));
    expect(metrics.volatility20d).toBe(0);
  });

  it('requires 21 closes for a 20-day return and volatility', () => {
    const input = series(Array.from({ length: 20 }, (_, index) => 100 + index));
    expect(calculateMetrics(input)).toMatchObject({ return20d: null, volatility20d: null, ma20: 109.5, ma60: null });
    input.bars.push({ date: '2025-01-21', close: 120, high: 120, low: 120, volume: 100, amount: 1000 });
    expect(calculateMetrics(input).return20d).toBe(20);
  });

  it.each([null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])('preserves an invalid close (%s) inside a window', (invalid) => {
    const input = series(Array<number>(30).fill(100));
    input.bars[28].close = invalid;
    expect(calculateMetrics(input)).toMatchObject({ return20d: null, ma5: null, volatility20d: null, maxDrawdown: null });
  });

  it('requires complete moving-average and volume windows', () => {
    expect(calculateMetrics(series([100, 101]))).toMatchObject({ ma5: null, ma20: null, avgVolume20d: null, avgAmount20d: null });
    const input = series(Array<number>(30).fill(100));
    Object.assign(input.bars[25], { volume: null, amount: null });
    expect(calculateMetrics(input)).toMatchObject({ avgVolume20d: null, avgAmount20d: null });
  });

  it('does not report zero risk when no observations exist', () => {
    expect(calculateMetrics(null)).toMatchObject({ periodReturn: null, maxDrawdown: null, volatility20d: null, ma5: null });
  });

  it('keeps full-period summaries separate from fixed-window metrics', () => {
    const summary = ensureTechnicalSummary({
      symbol: 'fixture', kline: series([100, 105]),
      technicalIndicators: { summary: { period_return_pct: 5, volatility_annualized_pct: 30 } },
    });
    expect(summary).toMatchObject({ period_return_pct: 5, return_120d_pct: null, volatility_20d_annualized_pct: null });
  });
});

function bars(prices: Array<number | null>) {
  return prices.map((close, index) => ({ date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10), close }));
}

describe('20-day volatility window', () => {
  it('ignores earlier volatility when the last 20 returns are flat', () => {
    expect(calculateMetrics({ bars: bars([100, 200, 100, 200, 100, ...Array(21).fill(100)]) }).volatility20d).toBe(0);
  });
  it('sorts dated observations before calculating the window', () => {
    const source = bars(Array.from({ length: 26 }, (_, index) => 100 + index * index));
    expect(calculateMetrics({ bars: [...source].reverse() })).toEqual(calculateMetrics({ bars: source }));
  });
  it.each(['short', 'missing', 'duplicate', 'invalid-date', 'rolled-date', 'weekly'])('reports unavailable data for %s', kind => {
    const source = bars(Array(21).fill(100));
    if (kind === 'short') source.pop();
    if (kind === 'missing') source[10].close = null;
    if (kind === 'duplicate') source[10].date = source[11].date;
    if (kind === 'invalid-date') source[10].date = 'not-a-date';
    if (kind === 'rolled-date') source[10].date = '2025-02-30';
    const result = calculateMetrics({ bars: source, period: kind === 'weekly' ? 'weekly' : 'daily' });
    expect(result.volatility20d).toBeNull();
    expect(result.metricWarnings).not.toEqual([]);
  });
  it('does not label full-history backend volatility as a 20-day observation', () => {
    const summary = ensureTechnicalSummary({ symbol: '510300',
      kline: { bars: bars(Array(21).fill(100)) },
      technicalIndicators: { summary: { volatility_annualized_pct: 88 } },
    });
    expect(summary.volatility_20d_annualized_pct).toBe(0);
  });
});
