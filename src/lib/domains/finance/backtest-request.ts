import type { QuantQueryTimeRange } from './query-rewrite';

/** Frozen execution inputs. Capability selection remains the LLM rewrite's responsibility. */
export interface QuantBacktestRequest {
  schemaVersion: 1;
  strategyId: 'ma_crossover';
  fastWindow: number;
  slowWindow: number;
  feeBps: number;
  initialCash: number;
  period: 'daily' | 'weekly' | 'monthly';
  adjustment: 'qfq' | 'hfq' | 'none';
  startDate: string | null;
  endDate: string;
  limit: number;
  defaults: string[];
}

function isoDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('请提供有效的回测日期。');
  }
  return date.toISOString().slice(0, 10);
}

function shanghaiDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

function subtractMonths(date: Date, months: number): void {
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
}

function assertSupportedStrategy(question: string): void {
  if (/(?<![a-z])(?:RSI|MACD|KDJ|Donchian|ATR|EMA)(?![a-z])|布林|海龟|动量策略|唐奇安|指数均线/i.test(question)) {
    throw new Error('对话回测当前支持简单均线交叉策略，请确认策略及参数。');
  }
}

/** Normalize explicit numeric syntax; unsupported/ambiguous inputs require clarification. */
export function compileBacktestRequest(input: {
  question: string;
  timeRange?: QuantQueryTimeRange | null;
  timeRangeLabel?: string | null;
  now?: Date;
}): QuantBacktestRequest {
  const question = (input.question ?? '').normalize('NFKC').replace(/\s+/g, '');
  const range = input.timeRange?.label ?? input.timeRangeLabel ?? '';
  const source = `${question} ${range}`;
  const defaults: string[] = [];
  assertSupportedStrategy(question);
  if (/分钟|minute\d|日内回测/.test(question)) {
    throw new Error('回测支持日线、周线和月线，请确认数据周期。');
  }
  if (/滑点|印花税|双边手续费|买入手续费|卖出手续费|买入费率|卖出费率/.test(question)) {
    throw new Error('当前回测使用统一单边手续费，请确认费用模型后再执行。');
  }
  if (/-\d+(?:\.\d+)?(?:日|天|周|月)?(?:均线)?(?:\/|、|和|与|及)\d+/.test(question)) {
    throw new Error('均线窗口必须为正整数。');
  }
  const period = /周线|周K/i.test(question) ? 'weekly' : /月线|月K/i.test(question) ? 'monthly' : 'daily';
  const adjustment = /不复权/.test(question) ? 'none' : /后复权/.test(question) ? 'hfq' : 'qfq';
  const pair = question.match(/(?:MA)?(\d+(?:\.\d+)?)(?:日|天|周|月)?(?:均线)?(?:\/|、|和|与|及|-)(?:MA)?(\d+(?:\.\d+)?)(?:日|天|周|月)?(?:均线|MA)/i)
    ?? question.match(/MA(\d+(?:\.\d+)?)(?:\/|、|和|与|及|-)MA(\d+(?:\.\d+)?)/i);
  const fast = question.match(/(?:fast_window|快线|短期均线)(?:为|是|改成|改为|设置为|[:：=])?(\d+(?:\.\d+)?)/i);
  const slow = question.match(/(?:slow_window|慢线|长期均线)(?:为|是|改成|改为|设置为|[:：=])?(\d+(?:\.\d+)?)/i);
  const fastWindow = Number(fast?.[1] ?? pair?.[1] ?? 20);
  const slowWindow = Number(slow?.[1] ?? pair?.[2] ?? 60);
  if (!fast && !slow && !pair && /\d+(?:日|天|周|月)均线|MA\d+/i.test(question)) {
    throw new Error('请明确快线和慢线两个均线窗口，例如 5/20 日均线。');
  }
  if (Boolean(fast) !== Boolean(slow) && !pair) throw new Error('请同时提供快线与慢线窗口。');
  if (/fast_window|快线|短期均线/.test(question) && !fast && !pair ||
      /slow_window|慢线|长期均线/.test(question) && !slow && !pair) {
    throw new Error('请以正整数明确快线与慢线窗口。');
  }
  if (!pair && !fast && !slow) defaults.push('均线窗口 20/60');
  if (!Number.isSafeInteger(fastWindow) || !Number.isSafeInteger(slowWindow) ||
      fastWindow < 2 || fastWindow > 120 || slowWindow < 3 || slowWindow > 250 || fastWindow >= slowWindow) {
    throw new Error('快线需为 2–120、慢线为 3–250 的整数，且快线小于慢线。');
  }
  const fee = question.match(/(?:手续费|费用|费率|fee_bps)(?:为|是|改成|改为|设置为|[:：=])?(\d+(?:\.\d+)?)(bps|bp|基点|%|‰)?/i);
  if (/手续费|费率|fee_bps/.test(question) && !fee) throw new Error('请以 bps 或百分比明确手续费。');
  if (fee && !fee[2] && !fee[0].startsWith('fee_bps')) throw new Error('手续费需要明确 bps 或百分比单位。');
  const feeBps = fee ? Number(fee[1]) * (fee[2] === '%' ? 100 : fee[2] === '‰' ? 10 : 1) : 5;
  if (!Number.isFinite(feeBps) || feeBps < 0 || feeBps > 10000) throw new Error('手续费需在 0–10000 bps 之间。');
  if (!fee) defaults.push('单边手续费 5 bps');
  const cash = question.match(/(?:初始资金|初始本金|initial_cash)(?:为|是|改成|改为|设置为|[:：=])?(\d+(?:\.\d+)?)(万)?(?:元)?/i);
  if (/初始资金|初始本金|initial_cash/.test(question) && !cash) throw new Error('请明确初始资金数值。');
  const initialCash = cash ? Number(cash[1]) * (cash[2] ? 10000 : 1) : 1;
  if (!Number.isFinite(initialCash) || initialCash <= 0 || initialCash > Number.MAX_SAFE_INTEGER) {
    throw new Error('初始资金必须为正数且不超过安全数值范围。');
  }
  if (!cash) defaults.push('初始净值 1');
  let startDate: string | null = null;
  let endDate = shanghaiDate(input.now ?? new Date());
  const explicitDays = source.match(/(?:最近|近|过去)(\d+)(?:个)?交易日/);
  let limit = explicitDays ? Number(explicitDays[1]) : 250;
  const dates = [...source.matchAll(/((?:19|20)\d{2})[-年/](\d{1,2})[-月/](\d{1,2})(?:日)?/g)]
    .map(match => isoDate(Number(match[1]), Number(match[2]), Number(match[3])));
  const uniqueDates = [...new Set(dates)];
  const monthRange = source.match(/((?:19|20)\d{2})年(\d{1,2})月?(?:至|到|—|-)(?:((?:19|20)\d{2})年)?(\d{1,2})月/);
  const halfYear = source.match(/((?:19|20)\d{2})年?(上半年|下半年|全年)/);
  if (uniqueDates.length === 2) {
    [startDate, endDate] = uniqueDates;
  } else if (uniqueDates.length > 2) {
    throw new Error('检测到多个回测日期，请明确唯一的开始和结束日期。');
  } else if (monthRange) {
    const firstYear = Number(monthRange[1]);
    const lastYear = Number(monthRange[3] ?? monthRange[1]);
    const lastMonth = Number(monthRange[4]);
    startDate = isoDate(firstYear, Number(monthRange[2]), 1);
    const lastDay = new Date(Date.UTC(lastYear, lastMonth, 0)).getUTCDate();
    endDate = isoDate(lastYear, lastMonth, lastDay);
  } else if (halfYear) {
    const year = Number(halfYear[1]);
    startDate = isoDate(year, halfYear[2] === '下半年' ? 7 : 1, 1);
    endDate = isoDate(year, halfYear[2] === '上半年' ? 6 : 12, halfYear[2] === '上半年' ? 30 : 31);
  } else if (uniqueDates.length === 1) {
    if (!/截至|截止/.test(source)) throw new Error('请同时提供回测开始日期和结束日期。');
    endDate = uniqueDates[0];
  } else {
    const duration = input.timeRange;
    if (duration?.unit === 'trading_day' && duration.value || explicitDays) {
      limit = duration?.unit === 'trading_day' && duration.value ? duration.value : Number(explicitDays![1]);
    } else if (duration?.value && ['day', 'week', 'month', 'quarter', 'year'].includes(duration.unit)) {
      const anchor = new Date(`${endDate}T00:00:00Z`);
      if (duration.unit === 'day' || duration.unit === 'week') {
        anchor.setUTCDate(anchor.getUTCDate() - duration.value * (duration.unit === 'week' ? 7 : 1));
      } else {
        subtractMonths(anchor, duration.value * (duration.unit === 'year' ? 12 : duration.unit === 'quarter' ? 3 : 1));
      }
      startDate = anchor.toISOString().slice(0, 10);
    } else if (range && /年初至今|今年以来/.test(range)) {
      startDate = `${endDate.slice(0, 4)}-01-01`;
    } else if (range || /(?:19|20)\d{2}年|最近|近\d|过去|今年|去年|上半年|下半年|起始|开始日期|结束日期/.test(question)) {
      throw new Error('请明确回测日期区间或最近多少个交易日。');
    } else {
      defaults.push('最近 250 根行情');
    }
  }
  if (startDate && startDate > endDate) throw new Error('回测开始日期不能晚于结束日期。');
  if (startDate) limit = Math.max(limit, slowWindow + 1);
  if (!Number.isSafeInteger(limit) || limit < slowWindow + 1 || limit > 1500) {
    throw new Error('样本数量需大于慢线窗口且不超过 1500。');
  }
  return { schemaVersion: 1, strategyId: 'ma_crossover', fastWindow, slowWindow,
    feeBps, initialCash, period, adjustment, startDate, endDate, limit, defaults };
}

export function reviseBacktestRequest(
  previous: QuantBacktestRequest, question: string, timeRange?: QuantQueryTimeRange | null,
): QuantBacktestRequest {
  question = question.normalize('NFKC');
  assertSupportedStrategy(question);
  const windowSyntax = /均线|快线|慢线|fast_window|slow_window|MA\d+/i;
  const periodSyntax = /周线|月线|日线|周K|月K|日K/i;
  const hasExecutionChange = windowSyntax.test(question) || periodSyntax.test(question) ||
    /手续费|费率|费用|资金|本金|复权|日期|回测|fee_bps|initial_cash|\d+年|最近|过去|至|从.*到/i.test(question);
  if (!hasExecutionChange) return previous;
  const hasRange = Boolean(timeRange) || /(?:19|20)\d{2}年|\d{4}[-/]\d{1,2}[-/]\d{1,2}|最近|过去|今年|去年/.test(question);
  const supplemental = [
    !windowSyntax.test(question) ? `快线${previous.fastWindow}慢线${previous.slowWindow}` : '',
    /快线|短期均线|fast_window/i.test(question) && !/慢线|长期均线|slow_window/i.test(question)
      ? `慢线${previous.slowWindow}` : '',
    /慢线|长期均线|slow_window/i.test(question) && !/快线|短期均线|fast_window/i.test(question)
      ? `快线${previous.fastWindow}` : '',
    !/手续费|费率|费用|fee_bps/i.test(question) ? `手续费${previous.feeBps}bps` : '',
    !/资金|本金|initial_cash/i.test(question) ? `initial_cash=${previous.initialCash}` : '',
    !periodSyntax.test(question) ? { daily: '日线', weekly: '周线', monthly: '月线' }[previous.period] : '',
    !/复权/.test(question) ? { qfq: '前复权', hfq: '后复权', none: '不复权' }[previous.adjustment] : '',
    !hasRange ? previous.startDate ? `${previous.startDate}至${previous.endDate}`
      : `截至${previous.endDate}最近${previous.limit}个交易日` : '',
  ];
  return compileBacktestRequest({ question: `${question}；${supplemental.join('；')}`, timeRange });
}

export function backtestRequestQuery(spec: QuantBacktestRequest): string {
  const query = new URLSearchParams({
    fast_window: String(spec.fastWindow), slow_window: String(spec.slowWindow),
    fee_bps: String(spec.feeBps), initial_cash: String(spec.initialCash),
    period: spec.period, adjustment: spec.adjustment, limit: String(spec.limit), end: spec.endDate,
  });
  if (spec.startDate) query.set('start', spec.startDate);
  return query.toString();
}

export function backtestResponseMismatches(spec: QuantBacktestRequest, response: Record<string, unknown>): string[] {
  const expected = { strategy_id: spec.strategyId, fast_window: spec.fastWindow,
    slow_window: spec.slowWindow, fee_bps: spec.feeBps, period: spec.period,
    adjustment: spec.adjustment, evaluation_start: spec.startDate, evaluation_end: spec.endDate };
  const mismatches = Object.entries(expected).filter(([key, value]) => {
    const actual = response[key];
    return typeof value === 'number' ? actual == null || Number(actual) !== value : actual !== value;
  }).map(([key]) => key);
  const summary = response.summary as Record<string, unknown> | undefined;
  if (!summary || Number(summary.initial_cash) !== spec.initialCash) mismatches.push('initial_cash');
  const curve = response.equity_curve;
  if (!Array.isArray(curve) || curve.length === 0 || curve.some(point =>
    !point || typeof point.date !== 'string' || point.date > spec.endDate ||
    (spec.startDate !== null && point.date < spec.startDate))) mismatches.push('evaluation_interval');
  if (Array.isArray(curve) && curve.length) {
    if (summary?.start_date !== curve[0]?.date || summary?.end_date !== curve.at(-1)?.date ||
        summary?.sample_count !== curve.length) mismatches.push('sample_summary');
    if (curve.some((point, index) => index > 0 && point.date <= curve[index - 1].date)) mismatches.push('sample_order');
    if (!spec.startDate && curve.length < spec.limit) mismatches.push('sample_coverage');
  }
  return mismatches;
}
