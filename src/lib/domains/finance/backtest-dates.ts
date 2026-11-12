function isoDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('请提供有效的回测日期。');
  }
  return date.toISOString().slice(0, 10);
}

export function calendarInterval(source: string): { start: string | null; end: string } | null {
  const dates = [...source.matchAll(/((?:19|20)\d{2})[-年/](\d{1,2})[-月/](\d{1,2})(?:日)?/g)]
    .map(match => isoDate(Number(match[1]), Number(match[2]), Number(match[3])));
  if (dates.length > 2) throw new Error('检测到多个回测日期，请明确唯一的开始和结束日期。');
  // Preserve equal endpoints: a one-session evaluation is still a date interval.
  if (dates.length === 2) return { start: dates[0], end: dates[1] };
  if (dates.length === 1) {
    if (!/截至|截止/.test(source)) throw new Error('请同时提供回测开始日期和结束日期。');
    return { start: null, end: dates[0] };
  }
  const months = source.match(/((?:19|20)\d{2})年(\d{1,2})月?(?:至|到|—|-)(?:((?:19|20)\d{2})年)?(\d{1,2})月/);
  if (months) {
    const lastYear = Number(months[3] ?? months[1]), lastMonth = Number(months[4]);
    return { start: isoDate(Number(months[1]), Number(months[2]), 1),
      end: isoDate(lastYear, lastMonth, new Date(Date.UTC(lastYear, lastMonth, 0)).getUTCDate()) };
  }
  const halfYear = source.match(/((?:19|20)\d{2})年?(上半年|下半年|全年)/);
  if (halfYear) {
    const year = Number(halfYear[1]), firstHalf = halfYear[2] === '上半年';
    return { start: isoDate(year, halfYear[2] === '下半年' ? 7 : 1, 1),
      end: isoDate(year, firstHalf ? 6 : 12, firstHalf ? 30 : 31) };
  }
  return null;
}
