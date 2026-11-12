/** Repeated explicit settings must agree; choosing the first silently changes intent. */
export function assertConsistentSettings(question: string): void {
  const number = '(\\d+(?:\\.\\d+)?)';
  const separator = '(?:为|是|改成|改为|设置为|[:：=])?';
  const groups: Array<[RegExp, (match: RegExpMatchArray) => number[]]> = [
    [new RegExp(`(?:fast_window|快线|短期均线)${separator}${number}`, 'gi'), m => [Number(m[1])]],
    [new RegExp(`(?:slow_window|慢线|长期均线)${separator}${number}`, 'gi'), m => [Number(m[1])]],
    [new RegExp(`(?:手续费|费用|费率|fee_bps)${separator}${number}(bps|bp|基点|%|‰)?`, 'gi'),
      m => [Number(m[1]) * (m[2] === '%' ? 100 : m[2] === '‰' ? 10 : 1)]],
    [new RegExp(`(?:初始资金|初始本金|initial_cash)${separator}${number}(万)?`, 'gi'),
      m => [Number(m[1]) * (m[2] ? 10000 : 1)]],
    [/(?:MA)?(\d+(?:\.\d+)?)(?:日|天|周|月)?(?:均线)?(?:\/|、|和|与|及|-)(?:MA)?(\d+(?:\.\d+)?)(?:日|天|周|月)?(?:均线|MA)/gi,
      m => [Number(m[1]), Number(m[2])]],
    [/MA(\d+(?:\.\d+)?)(?:\/|、|和|与|及|-)MA(\d+(?:\.\d+)?)/gi,
      m => [Number(m[1]), Number(m[2])]],
  ];
  for (const [pattern, values] of groups) {
    const matches = [...question.matchAll(pattern)].map(values);
    if (new Set(matches.map(value => JSON.stringify(value))).size > 1) {
      throw new Error('检测到冲突的回测参数，请明确唯一的窗口、手续费和资金设置。');
    }
  }
  const pair = question.match(/(?:MA)?(\d+)(?:日|天)?(?:均线)?\/(?:MA)?(\d+)(?:日|天)?(?:均线|MA)/i)
    ?? question.match(/MA(\d+)\/MA(\d+)/i);
  for (const [index, label] of [[1, 'fast_window|快线|短期均线'], [2, 'slow_window|慢线|长期均线']] as const) {
    const named = question.match(new RegExp(`(?:${label})${separator}${number}`, 'i'));
    if (pair && named && Number(pair[index]) !== Number(named[1])) {
      throw new Error('均线组合与快慢线参数冲突，请确认窗口。');
    }
  }
}
