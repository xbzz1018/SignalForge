import { describe, expect, it } from 'vitest';
import { compileBacktestRequest, backtestRequestQuery, backtestResponseMismatches, reviseBacktestRequest } from './backtest-request';

describe('frozen backtest execution request', () => {
  it('preserves equal date endpoints and repeated rewrite labels', () => {
    expect(compileBacktestRequest({ question: '2025-01-02至2025-01-02均线回测',
      timeRangeLabel: '2025-01-02至2025-01-02' })).toMatchObject({ startDate: '2025-01-02', endDate: '2025-01-02' });
  });
  it('refuses rewritten dates that contradict the original calendar interval', () => {
    expect(() => compileBacktestRequest({ question: '2024年上半年回测',
      timeRangeLabel: '2024-07-01至2024-12-31' })).toThrow('冲突');
  });
  it.each(['初始资金1亿元回测', 'initial_cash=1e6回测', '初始资金10,000元回测',
    '手续费0.1.5%回测', '快线5e1慢线60回测', '初始资金100美元回测', '回测费用-1bps', '回测FEE_BPS=NaN'])(
    'rejects partial numeric parsing: %s', question => {
      expect(() => compileBacktestRequest({ question })).toThrow();
    },
  );
  it('accepts uppercase explicit fee keys', () => {
    expect(compileBacktestRequest({ question: '回测FEE_BPS=10' }).feeBps).toBe(10);
  });
  it.each(['回测手续费5bps手续费10bps', '初始资金1万初始本金2万回测',
    '快线5快线10慢线20回测', '5/20均线与10/30均线回测', '5/20均线快线10回测'])(
    'requires clarification for contradictory numeric settings: %s', question => {
      expect(() => compileBacktestRequest({ question })).toThrow('冲突');
    },
  );
  it('accepts equivalent repeated fee and capital settings', () => {
    expect(compileBacktestRequest({ question: '回测手续费10bps费率0.1%初始资金1万initial_cash=10000' }))
      .toMatchObject({ feeBps: 10, initialCash: 10000 });
  });
  it.each(['日线和周线回测', '周K月K回测', '前复权和后复权回测', '不复权与前复权回测'])(
    'rejects conflicting data conventions: %s', question => {
      expect(() => compileBacktestRequest({ question })).toThrow('唯一');
    },
  );
  it('preserves the requested dates, windows, fee and capital through HTTP serialization', () => {
    const request = compileBacktestRequest({
      question: '2024年1月到6月，使用5/20日均线回测510300，手续费10bps，初始资金10万元',
      timeRange: { label: '2024-01-01至2024-06-30', unit: 'date_range', source: 'explicit' },
      now: new Date('2026-11-06T00:00:00Z'),
    });
    expect(request).toMatchObject({
      fastWindow: 5, slowWindow: 20, feeBps: 10, initialCash: 100000,
      startDate: '2024-01-01', endDate: '2024-06-30', period: 'daily', adjustment: 'qfq',
    });
    expect(Object.fromEntries(new URLSearchParams(backtestRequestQuery(request)))).toMatchObject({
      start: '2024-01-01', end: '2024-06-30', fast_window: '5', slow_window: '20', fee_bps: '10',
    });
  });

  it('freezes the current Shanghai date and discloses defaults', () => {
    const request = compileBacktestRequest({ question: '回测510300', now: new Date('2026-11-05T17:00:00Z') });
    expect(request.endDate).toBe('2026-11-06');
    expect(request.defaults).toEqual(expect.arrayContaining(['均线窗口 20/60', '单边手续费 5 bps']));
  });

  it('converts percentage fees and preserves weekly frequency', () => {
    expect(compileBacktestRequest({ question: '周线回测5/20均线，手续费0.1%' })).toMatchObject({
      feeBps: 10, period: 'weekly', fastWindow: 5, slowWindow: 20,
    });
  });

  it('clamps relative calendar ranges to the end of shorter months', () => {
    expect(compileBacktestRequest({ question: '回测最近一个月',
      timeRange: { label: '最近一个月', value: 1, unit: 'month', source: 'explicit' },
      now: new Date('2026-03-31T00:00:00Z'),
    }).startDate).toBe('2026-02-28');
  });

  it('keeps frozen parameters for cosmetic revisions and applies explicit fee changes', () => {
    const previous = compileBacktestRequest({ question: '2024年上半年5/20日均线回测，手续费10bps' });
    expect(reviseBacktestRequest(previous, '把背景改成白色')).toEqual(previous);
    expect(reviseBacktestRequest(previous, '把手续费改成15bps')).toMatchObject({
      fastWindow: 5, slowWindow: 20, feeBps: 15, startDate: '2024-01-01', endDate: '2024-06-30',
    });
    expect(reviseBacktestRequest(previous, '快线改成10')).toMatchObject({ fastWindow: 10, slowWindow: 20, feeBps: 10 });
    expect(reviseBacktestRequest(previous, '改为MA10/MA30')).toMatchObject({ fastWindow: 10, slowWindow: 30, feeBps: 10 });
    expect(reviseBacktestRequest(previous, '改用周K')).toMatchObject({ period: 'weekly', fastWindow: 5 });
    expect(() => reviseBacktestRequest(previous, '换成MACD')).toThrow('简单均线');
  });

  it.each([
    '5/2日均线回测', '2.5/20日均线回测', '回测20日均线',
    '回测5分钟均线', 'RSI策略回测', 'MACD回测', 'KDJ回测', '5/20EMA回测',
    '均线回测手续费10', '均线回测手续费-1bps',
    '-5/20日均线回测', '快线abc慢线20回测', '均线回测滑点1bps',
    '2025-02-30至2025-03-01均线回测', '2025-03-01至2025-01-01均线回测',
  ])('requires clarification instead of silently substituting parameters: %s', question => {
    expect(() => compileBacktestRequest({ question })).toThrow();
  });

  it('rejects a default-parameter response even when its artifacts have the right symbol', () => {
    const spec = compileBacktestRequest({ question: '2024年上半年5/20日均线回测，手续费10bps' });
    const result = {
      symbol: '510300', strategy_id: 'ma_crossover', fast_window: 20, slow_window: 60,
      fee_bps: 5, period: 'daily', adjustment: 'qfq', evaluation_start: null,
      evaluation_end: spec.endDate, summary: { initial_cash: 1 },
      equity_curve: [{ date: '2026-01-01' }],
    };
    expect(backtestResponseMismatches(spec, result)).toEqual(expect.arrayContaining([
      'fast_window', 'slow_window', 'fee_bps', 'evaluation_start', 'evaluation_interval',
    ]));
  });
});
