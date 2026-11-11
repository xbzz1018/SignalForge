import { type JsonRecord, asRecord, extractBarsFromAsset, mean, numeric, round } from './values';

export function calculateMetrics(kline: JsonRecord | null): JsonRecord {
  const inputBars = Array.isArray(kline?.bars) ? kline.bars.map((bar) => asRecord(bar) ?? {}) : [];
  const dateOf = (bar: JsonRecord) => bar.date ?? bar.time ?? bar.trade_date;
  const dates = inputBars.map(dateOf);
  const validDates = dates.length > 0 && dates.every((value) => typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value);
  const uniqueDates = new Set(dates).size === dates.length;
  const bars = validDates && uniqueDates
    ? [...inputBars].sort((a, b) => String(dateOf(a)).localeCompare(String(dateOf(b))))
    : inputBars;
  const daily = kline?.period === undefined || kline.period === 'daily';
  // Keep each observation in place: removing a missing value changes the window
  // and can turn a multi-session price change into a one-session return.
  const closes = bars.map((bar) => {
    const close = numeric(bar.close);
    return close !== null && close > 0 ? close : null;
  });
  const volumes = bars.map((bar) => numeric(bar.volume));
  const amounts = bars.map((bar) => numeric(bar.amount));
  const highs = bars.map((bar) => numeric(bar.high)).filter((value): value is number => value !== null);
  const lows = bars.map((bar) => numeric(bar.low)).filter((value): value is number => value !== null);

  const firstClose = closes[0] ?? null;
  const lastClose = closes.at(-1) ?? null;
  const volatilityCloses = daily && validDates && uniqueDates ? completeWindow(closes, 21) : null;
  const returns = volatilityCloses?.slice(1).map((close, index) => (close - volatilityCloses[index]) / volatilityCloses[index]);
  const avgReturn = returns ? mean(returns) : null;
  const variance = returns && avgReturn !== null
    ? mean(returns.map((value) => (value - avgReturn) ** 2))
    : null;
  let peak = closes[0] ?? 0;
  let maxDrawdown = 0;
  for (const close of closes) {
    if (close === null) continue;
    peak = Math.max(peak, close);
    if (peak > 0) {
      maxDrawdown = Math.min(maxDrawdown, ((close - peak) / peak) * 100);
    }
  }

  return {
    periodReturn:
      firstClose && lastClose ? round(((lastClose - firstClose) / firstClose) * 100) : null,
    return20d: calculateWindowReturn(closes, 20),
    return60d: calculateWindowReturn(closes, 60),
    return120d: calculateWindowReturn(closes, 120),
    periodHigh: highs.length ? round(Math.max(...highs)) : null,
    periodLow: lows.length ? round(Math.min(...lows)) : null,
    maxDrawdown: closes.length && closes.every((close) => close !== null) ? round(maxDrawdown) : null,
    volatility20d: variance === null ? null : round(Math.sqrt(variance) * Math.sqrt(252) * 100),
    metricWarnings: volatilityCloses ? [] : ['20 日波动率需要 21 根日期唯一、收盘价完整的日线行情。'],
    avgVolume20d: windowMean(volumes, 20),
    avgAmount20d: windowMean(amounts, 20),
    ma5: windowMean(closes, 5),
    ma10: windowMean(closes, 10),
    ma20: windowMean(closes, 20),
    ma60: windowMean(closes, 60),
  };
}

function completeWindow(values: (number | null)[], size: number): number[] | null {
  const sample = values.slice(-size);
  return sample.length === size && sample.every((value) => value !== null) ? sample as number[] : null;
}

function windowMean(values: (number | null)[], size: number): number | null {
  const sample = completeWindow(values, size);
  return sample ? round(mean(sample)) : null;
}

function calculateWindowReturn(closes: (number | null)[], windowSize: number): number | null {
  const sample = completeWindow(closes, windowSize + 1);
  if (!sample) return null;
  const latest = sample[sample.length - 1];
  const baseline = sample[0];
  return round(((latest - baseline) / baseline) * 100);
}

export function firstDateFromBars(bars: JsonRecord[]): string | null {
  const first = bars[0];
  const value = first?.date ?? first?.time ?? first?.trade_date;
  return typeof value === 'string' ? value.slice(0, 10) : null;
}

export function lastDateFromBars(bars: JsonRecord[]): string | null {
  const last = bars.at(-1);
  const value = last?.date ?? last?.time ?? last?.trade_date;
  return typeof value === 'string' ? value.slice(0, 10) : null;
}

export function ensureTechnicalSummary(asset: JsonRecord): JsonRecord {
  const quote = asRecord(asset.quote);
  const kline = asRecord(asset.kline) ?? asRecord(asset.history);
  const bars = extractBarsFromAsset(asset);
  const metrics = asRecord(asset.computedMetrics) ?? calculateMetrics(kline);
  const technicalIndicators = asRecord(asset.technicalIndicators) ?? {};
  const existingSummary = asRecord(technicalIndicators.summary) ?? {};
  const latestClose = numeric(existingSummary.latest_close) ?? numeric(quote?.price) ?? numeric(bars.at(-1)?.close);
  const ma5 = numeric(existingSummary.ma5) ?? numeric(metrics.ma5);
  const ma10 = numeric(existingSummary.ma10) ?? numeric(metrics.ma10);
  const ma20 = numeric(existingSummary.ma20) ?? numeric(metrics.ma20);
  const ma60 = numeric(existingSummary.ma60) ?? numeric(metrics.ma60);
  const return20d = numeric(existingSummary.return_20d_pct) ?? numeric(metrics.return20d);
  const return60d = numeric(existingSummary.return_60d_pct) ?? numeric(metrics.return60d);
  const return120d = numeric(existingSummary.return_120d_pct) ?? numeric(metrics.return120d);
  const maxDrawdown = numeric(existingSummary.max_drawdown_pct) ?? numeric(metrics.maxDrawdown);
  const volatility = numeric(existingSummary.volatility_20d_annualized_pct) ?? numeric(metrics.volatility20d);
  const avgVolume = numeric(existingSummary.avg_volume20) ?? numeric(metrics.avgVolume20d);
  const symbol = String(asset.symbol ?? quote?.symbol ?? '');
  const name = String(asset.name ?? quote?.name ?? symbol);

  let trendState = '趋势待确认：K 线或均线样本不足。';
  const availableMovingAverages = [ma5, ma10, ma20, ma60].filter(
    (value): value is number => value !== null
  );
  if (latestClose !== null && availableMovingAverages.length >= 3) {
    const averageLabel = ma60 === null ? 'MA5/MA10/MA20' : 'MA5/MA10/MA20/MA60';
    if (availableMovingAverages.every((average) => latestClose >= average)) {
      trendState = `趋势偏强：最新价站上 ${averageLabel}。`;
    } else if (availableMovingAverages.every((average) => latestClose < average)) {
      trendState = `趋势偏弱：最新价低于 ${averageLabel}。`;
    } else {
      trendState = '震荡观察：最新价处于均线区间内，需要等待方向确认。';
    }
  }

  const summary = {
    symbol,
    name,
    sample_window: bars.length
      ? `${firstDateFromBars(bars) ?? '-'} 至 ${lastDateFromBars(bars) ?? '-'}，${bars.length} 根日 K`
      : '暂无历史 K 线样本',
    return_20d_pct: round(return20d),
    return_60d_pct: round(return60d),
    return_120d_pct: round(return120d),
    period_return_pct: round(numeric(existingSummary.period_return_pct) ?? numeric(metrics.periodReturn)),
    max_drawdown_pct: round(maxDrawdown),
    volatility_20d_annualized_pct: round(volatility),
    ma5: round(ma5),
    ma10: round(ma10),
    ma20: round(ma20),
    ma60: round(ma60),
    latest_close: round(latestClose),
    trend_state: String(existingSummary.trend_state ?? trendState),
    volume_note: avgVolume === null
      ? '缺少连续成交量，量能指标待补充。'
      : `20 日均量约 ${round(avgVolume, 0)} 手。`,
  };

  asset.technicalIndicators = {
    ...technicalIndicators,
    symbol,
    summary,
    computedMetrics: metrics,
    data_quality: technicalIndicators.data_quality ?? {
      status: bars.length >= 20 ? 'ok' : 'warning',
      warnings: bars.length >= 20 ? [] : ['历史 K 线样本少于 20 条，技术指标稳定性较弱。'],
    },
  };
  return summary;
}
