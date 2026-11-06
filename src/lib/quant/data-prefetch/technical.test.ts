import { describe, expect, it } from 'vitest';

import { calculateMetrics, ensureTechnicalSummary } from './technical';

function series(closes: (number | null)[]) {
  return { bars: closes.map((close) => ({ close, high: close, low: close, volume: 100, amount: 1000 })) };
}

describe('technical metrics observation windows', () => {
  it('uses only the latest 20 returns for 20-day volatility', () => {
    const metrics = calculateMetrics(series([10, 90, 5, 100, ...Array<number>(21).fill(100)]));
    expect(metrics.volatility20d).toBe(0);
  });

  it('requires 21 closes for a 20-day return and volatility', () => {
    const input = series(Array.from({ length: 20 }, (_, index) => 100 + index));
    expect(calculateMetrics(input)).toMatchObject({ return20d: null, volatility20d: null, ma20: 109.5, ma60: null });
    input.bars.push({ close: 120, high: 120, low: 120, volume: 100, amount: 1000 });
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
