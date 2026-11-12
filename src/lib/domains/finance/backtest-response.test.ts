import { describe, expect, it } from 'vitest';
import { backtestResponseMismatches, compileBacktestRequest } from './backtest-request';

const spec = compileBacktestRequest({ question: '2025年上半年5/20均线回测' });

describe('untrusted backtest response acceptance', () => {
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
