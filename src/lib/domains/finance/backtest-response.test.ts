import { describe, expect, it } from 'vitest';
import { backtestResponseMismatches, compileBacktestRequest } from './backtest-request';

const spec = compileBacktestRequest({ question: '2025年上半年5/20均线回测' });

describe('untrusted backtest response acceptance', () => {
  function validResult(): Record<string, unknown> {
    return { strategy_id: spec.strategyId, fast_window: spec.fastWindow, slow_window: spec.slowWindow,
      fee_bps: spec.feeBps, period: spec.period, adjustment: spec.adjustment,
      evaluation_start: spec.startDate, evaluation_end: spec.endDate,
      parameters: { fast_window: spec.fastWindow, slow_window: spec.slowWindow, fee_bps: String(spec.feeBps) },
      equity_curve: [{ date: '2025-01-02', close: '100', equity: '1', position: 0 }],
      summary: { initial_cash: 1, final_equity: '1', start_date: '2025-01-02', end_date: '2025-01-02', sample_count: 1 } };
  }
  it('accepts finite decimal strings emitted by the backend', () => {
    expect(backtestResponseMismatches(spec, validResult())).toEqual([]);
  });
  it.each([true, '', 'NaN', 'Infinity', {}, -1])('rejects invalid equity values: %j', equity => {
    const response = validResult();
    response.equity_curve = [{ date: '2025-01-02', close: 100, equity, position: 0 }];
    expect(backtestResponseMismatches(spec, response)).toContain('sample_values');
  });
  it('rejects inconsistent snapshot parameters and final equity', () => {
    const response = validResult();
    response.parameters = { fast_window: 20, slow_window: 60, fee_bps: 5 };
    Object.assign(response.summary as object, { final_equity: 2 });
    expect(backtestResponseMismatches(spec, response)).toEqual(expect.arrayContaining(['parameter_snapshot', 'summary_values']));
  });
  it.each([null, true, 5, {}, [null], [{ date: '2025-01-02' }, null], ['2025-01-02']])(
    'reports malformed curves without crashing: %j', equity_curve => {
      expect(backtestResponseMismatches(spec, { equity_curve, summary: [] })).toContain('evaluation_interval');
    },
  );
  it.each(['2025-02-30', '2025-1-2', '2025-01-02T00:00:00Z', 'not-a-date'])(
    'rejects invalid or noncanonical dates: %s', date => {
      expect(backtestResponseMismatches(spec, { equity_curve: [{ date }] })).toContain('evaluation_interval');
    },
  );
});
