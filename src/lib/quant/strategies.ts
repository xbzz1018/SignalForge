import { getAllProjects } from '@/lib/services/project';
import { getRuntimeDegradationConfig } from '@/lib/config/degradation';
import { getQuantCapability, type QuantCapabilityId } from '@/lib/quant/capabilities';
import { serializeProjects } from '@/lib/serializers/project';
import type { Project } from '@/types';

export type {
  StrategyStatus,
  StrategyRiskLevel,
  StrategyTemplateKind,
  StrategyRule,
  StrategyDataReadiness,
  StrategyParameter,
  StrategyParameterScan,
  StrategyVersionRecord,
  StrategyBacktestArchive,
  StrategyScanRunResult,
  StrategyScanRun,
  StrategyScanJob,
  StrategyUniverseMember,
  StrategyUniverse,
  StrategyUniverseMembersPage,
  StrategyScreenerMode,
  StrategyScreenerCandidate,
  StrategyAnalyticsExecutionMetadata,
  StrategyScreenerResponse,
  StrategyDataCoverageItem,
  StrategyLocalKlineBar,
  StrategyDividendEvent,
  StrategyDividendEventsResponse,
  StrategySectorCapitalFlowItem,
  StrategySectorCapitalFlowMarketSummary,
  StrategySectorCapitalFlowTrendPoint,
  StrategySectorCapitalFlowMember,
  StrategySectorCapitalFlowDetail,
  StrategySectorCapitalFlowResponse,
  StrategyLocalKlineSummary,
  StrategyLocalKlineResponse,
  StrategyRealtimeQuote,
  StrategyIngestionPlan,
  StrategyResearchState,
  StrategyHistoryIngestionResult,
  StrategyAutoFillIngestionStartResult,
  StrategyIngestionJob,
  StrategyIngestionJobControlResult,
  StrategyIngestionJobsResponse,
  StrategyFoundationComponent,
  StrategyFactorDefinition,
  StrategyTradingCalendarDay,
  StrategyDataQualityIssue,
  StrategyDataQualityScan,
  StrategyFoundationState,
  StrategyFactorCatalogStatus,
  StrategyFactorCatalogDirection,
  StrategyFactorCatalogItem,
  StrategyFactorCatalogCategory,
  StrategyFactorCatalogEnrichmentItem,
  StrategyFactorResearchWorkflowStep,
  StrategyFactorDataLayer,
  StrategyFactorStrategyBlueprint,
  StrategyFactorCatalogState,
  StrategyUniverseMemberAddResult,
  StrategyTemplate,
  StrategyWorkspaceRef,
  StrategyCatalogItem,
  StrategyDashboardData
} from './strategy-types';
import {
  FALLBACK_FOUNDATION_STATE,
  SAMPLE_UNIVERSE_ID,
  SAMPLE_UNIVERSE_MEMBER_SEEDS,
  STRATEGY_FACTOR_CATALOG,
  STRATEGY_TEMPLATES,
} from './strategy-catalog';
import { readinessFor } from './strategy-readiness';
import { listScanJobs, listScanRuns, writeScanJob, writeScanRun } from './strategy-scan-repository';
import type {
  StrategyParameterScan,
  StrategyScanRunResult,
  StrategyScanRun,
  StrategyScanJob,
  StrategyUniverseMember,
  StrategyUniverse,
  StrategyUniverseMembersPage,
  StrategyScreenerMode,
  StrategyScreenerCandidate,
  StrategyAnalyticsExecutionMetadata,
  StrategyScreenerResponse,
  StrategyDataCoverageItem,
  StrategyLocalKlineBar,
  StrategyDividendEvent,
  StrategyDividendEventsResponse,
  StrategySectorCapitalFlowItem,
  StrategySectorCapitalFlowMarketSummary,
  StrategySectorCapitalFlowTrendPoint,
  StrategySectorCapitalFlowMember,
  StrategySectorCapitalFlowDetail,
  StrategySectorCapitalFlowResponse,
  StrategyLocalKlineResponse,
  StrategyRealtimeQuote,
  StrategyResearchState,
  StrategyHistoryIngestionResult,
  StrategyAutoFillIngestionStartResult,
  StrategyIngestionJob,
  StrategyIngestionJobControlResult,
  StrategyIngestionJobsResponse,
  StrategyFoundationComponent,
  StrategyFactorDefinition,
  StrategyTradingCalendarDay,
  StrategyDataQualityIssue,
  StrategyDataQualityScan,
  StrategyFoundationState,
  StrategyFactorCatalogState,
  StrategyUniverseMemberAddResult,
  StrategyTemplate,
  StrategyWorkspaceRef,
  StrategyCatalogItem,
  StrategyDashboardData
} from './strategy-types';

const MARKET_API_BASE_URL =
  process.env.QUANTPILOT_MARKET_API_URL ||
  process.env.QUANTPILOT_MARKET_API_BASE_URL ||
  'http://127.0.0.1:8000';
function getMarketApiConfig() {
  return getRuntimeDegradationConfig().components.marketApi;
}

function assertMarketApiEnabled() {
  if (!getMarketApiConfig().enabled) {
    throw new Error('market API 已按降级配置停用');
  }
}

const SAMPLE_UNIVERSE_MEMBERS: StrategyUniverseMember[] = SAMPLE_UNIVERSE_MEMBER_SEEDS.map(
  (member) => ({
    ...member,
    concepts: [],
    sectorTags: inferSampleSectorTags(member.name),
    assetType: 'stock',
    currency: 'CNY',
    timezone: 'Asia/Shanghai',
    provider: 'eastmoney',
    securityStatus: 'active',
    role: 'member',
    weight: Number((1 / SAMPLE_UNIVERSE_MEMBER_SEEDS.length).toFixed(8)),
    rowCount: 0,
    latestClose: null,
    latestChangePct: null,
    latestAmount: null,
    latestTurnover: null,
    strength20dPct: null,
    strength60dPct: null,
    ma20: null,
    ma60: null,
    trendStatus: 'insufficient',
    avgAmount20d: null,
    avgVolume20d: null,
    avgTurnover20d: null,
    tradeStatus: null,
    isSt: null,
    limitUp: null,
    limitDown: null,
    peTtm: null,
    pbMrq: null,
    psTtm: null,
    pcfNcfTtm: null,
    dataStatus: 'missing',
  })
);

const FALLBACK_RESEARCH_STATE: StrategyResearchState = {
  primaryUniverseId: SAMPLE_UNIVERSE_ID,
  source: 'fallback',
  universes: [
    {
      id: SAMPLE_UNIVERSE_ID,
      name: 'A 股股票池',
      description: '用于策略平台打通本地行情覆盖、数据质量检查和回测链路的默认股票池。',
      status: 'active',
      source: 'seed',
      tags: ['A股', '股票', '东方财富', '策略回测'],
      defaultTimeframe: 'daily',
      defaultAdjustment: 'qfq',
      provider: 'eastmoney',
      members: SAMPLE_UNIVERSE_MEMBERS,
      memberCount: SAMPLE_UNIVERSE_MEMBERS.length,
      stockCount: SAMPLE_UNIVERSE_MEMBERS.length,
      etfCount: 0,
      indexCount: 0,
      fundCount: 0,
      readyCount: 0,
      barCount: 0,
      latestTs: null,
    },
    {
      id: 'etf-index-pool',
      name: 'ETF/指数池',
      description: '用于指数代理、ETF 轮动和跨资产对比的独立池。',
      status: 'active',
      source: 'seed',
      tags: ['ETF', '指数', '东方财富', '轮动'],
      defaultTimeframe: 'daily',
      defaultAdjustment: 'qfq',
      provider: 'eastmoney',
      members: [],
      memberCount: 0,
      stockCount: 0,
      etfCount: 0,
      indexCount: 0,
      fundCount: 0,
      readyCount: 0,
      barCount: 0,
      latestTs: null,
    },
  ],
  coverage: SAMPLE_UNIVERSE_MEMBERS.map(member => ({
    symbol: member.symbol,
    name: member.name,
    timeframe: 'daily',
    adjustment: 'qfq',
    provider: 'eastmoney',
    rowCount: 0,
    dataStatus: 'missing',
  })),
  ingestionPlan: {
    provider: 'eastmoney',
    universeId: SAMPLE_UNIVERSE_ID,
    timeframe: 'daily',
    adjustment: 'qfq',
    suggestedLimit: 1260,
    lookbackYears: 5,
    endpoints: [
      'GET /api/v1/research/universes/summary',
      'GET /api/v1/research/universes/{id}/members',
      'POST /api/v1/ingestion/eastmoney/history',
      'POST /api/v1/ingestion/akshare/history',
      'POST /api/v1/ingestion/baostock/history',
    ],
    guardrails: [
      '默认保留近 5 年前复权日线，保证策略回测读取同一价格口径。',
      '每次同步按 symbol/timeframe/adjustment/ts 幂等 upsert。',
      '历史样本不因后续补数被删除，回测窗口由查询条件决定。',
      '回测必须读取本地 TimescaleDB，避免外部行情变化影响复现。',
    ],
  },
};

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function findTemplate(templateId: string) {
  return STRATEGY_TEMPLATES.find(template => template.id === templateId) ?? null;
}

function listCatalogTemplates() {
  return STRATEGY_TEMPLATES.filter(template => template.kind);
}

function findScan(template: StrategyTemplate, scanId: string) {
  return template.parameterScans.find(scan => scan.id === scanId) ?? null;
}

function expandGrid(scan: StrategyParameterScan): Array<Record<string, string | number>> {
  return scan.grid.reduce<Array<Record<string, string | number>>>((acc, item) => {
    const base = acc.length ? acc : [{}];
    return base.flatMap(existing =>
      item.values.map(value => ({
        ...existing,
        [item.key]: value,
      }))
    );
  }, []);
}

function isValidMaCrossoverParams(params: Record<string, string | number>) {
  const fast = asNumber(params.fast_window);
  const slow = asNumber(params.slow_window);
  return fast !== null && slow !== null && fast < slow;
}

async function fetchBacktest(params: {
  symbol: string;
  parameters: Record<string, string | number>;
  strategyId: string;
  limit?: number;
}): Promise<Record<string, unknown>> {
  assertMarketApiEnabled();
  const query = new URLSearchParams({
    fee_bps: String(params.parameters.fee_bps ?? 5),
    period: 'daily',
    adjustment: 'qfq',
    limit: String(params.limit ?? 1260),
  });
  for (const [key, value] of Object.entries(params.parameters)) {
    query.set(key, String(value));
  }
  const response = await fetch(
    `${MARKET_API_BASE_URL}/api/v1/backtests/strategies/${encodeURIComponent(params.strategyId)}/${encodeURIComponent(params.symbol)}?${query.toString()}`,
    { cache: 'no-store' }
  );
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`market API ${response.status}: ${body.slice(0, 180)}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

function summarizeBacktest(backtest: Record<string, unknown>): StrategyScanRunResult['metrics'] {
  const summary = backtest.summary && typeof backtest.summary === 'object'
    ? backtest.summary as Record<string, unknown>
    : {};
  return {
    totalReturnPct: asNumber(summary.total_return_pct),
    maxDrawdownPct: asNumber(summary.max_drawdown_pct),
    winRatePct: asNumber(summary.win_rate_pct),
    tradeCount: asNumber(summary.trade_count),
    sharpe: asNumber(summary.sharpe),
  };
}

function chooseBestResult(results: StrategyScanRunResult[]) {
  const successful = results.filter(result => result.status === 'success');
  if (!successful.length) return null;
  return successful
    .slice()
    .sort((a, b) => {
      const aReturn = a.metrics.totalReturnPct ?? Number.NEGATIVE_INFINITY;
      const bReturn = b.metrics.totalReturnPct ?? Number.NEGATIVE_INFINITY;
      if (aReturn !== bReturn) return bReturn - aReturn;
      const aDrawdown = a.metrics.maxDrawdownPct ?? Number.POSITIVE_INFINITY;
      const bDrawdown = b.metrics.maxDrawdownPct ?? Number.POSITIVE_INFINITY;
      return aDrawdown - bDrawdown;
    })[0];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
      .map(item => String(item).trim())
      .filter(item => item && !['-', '--', '无', '暂无'].includes(item))
    : [];
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 't', 'yes', 'y'].includes(normalized)) return true;
    if (['0', 'false', 'f', 'no', 'n'].includes(normalized)) return false;
  }
  return null;
}

function compactUniqueStrings(values: Array<string | null | undefined>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  values.forEach((value) => {
    const text = value?.trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  });
  return result;
}

function inferSampleSectorTags(name?: string | null): string[] {
  const value = name ?? '';
  if (/银行/.test(value)) return ['银行'];
  if (/证券|国泰君安|华泰|广发/.test(value)) return ['证券'];
  if (/保险|中国平安|太保/.test(value)) return ['保险'];
  if (/茅台|五粮液|泸州老窖|汾酒|今世缘/.test(value)) return ['白酒'];
  if (/通富|圣邦|紫光|华润微|中芯|韦尔|兆易|卓胜|汇顶/.test(value)) return ['半导体'];
  if (/三七|完美世界|世纪华通|掌趣|昆仑万维/.test(value)) return ['游戏'];
  if (/宁德|比亚迪|电池|先导智能/.test(value)) return ['新能源车'];
  if (/美的|格力|家电|三花/.test(value)) return ['家电'];
  if (/黄金/.test(value)) return ['黄金珠宝'];
  if (/联通|中兴|通信|移远|广和通/.test(value)) return ['通信服务'];
  if (/石油|石化|石化|荣盛石化|东方盛虹/.test(value)) return ['石油石化'];
  if (/医药|恒瑞/.test(value)) return ['医药'];
  if (/电力|长江电力/.test(value)) return ['电力'];
  if (/光伏|隆基/.test(value)) return ['光伏'];
  return [];
}

function dataStatus(value: unknown): StrategyUniverseMember['dataStatus'] {
  return value === 'ready' || value === 'stale' || value === 'missing' ? value : 'missing';
}

function trendStatus(value: unknown): StrategyUniverseMember['trendStatus'] {
  return value === 'bullish' || value === 'bearish' || value === 'sideways' || value === 'insufficient'
    ? value
    : 'insufficient';
}

function mapResearchMember(value: unknown): StrategyUniverseMember {
  const record = asRecord(value);
  const concepts = asStringArray(record.concepts);
  const sectorTags = asStringArray(record.sector_tags);
  const industry = typeof record.industry === 'string' ? record.industry : null;
  const region = typeof record.region === 'string' ? record.region : null;
  const sectorHint = typeof record.sector_hint === 'string' ? record.sector_hint : null;
  const name = typeof record.name === 'string' ? record.name : null;
  return {
    symbol: asString(record.symbol),
    code: asString(record.code),
    name,
    industry,
    region,
    concepts,
    sectorHint,
    sectorTags: sectorTags.length
      ? sectorTags
      : compactUniqueStrings([industry, ...concepts.slice(0, 3), region, ...inferSampleSectorTags(name)]),
    exchange: asString(record.exchange, 'UNKNOWN'),
    assetType: asString(record.asset_type, 'stock'),
    currency: asString(record.currency, 'CNY'),
    timezone: asString(record.timezone, 'Asia/Shanghai'),
    secid: typeof record.secid === 'string' ? record.secid : null,
    provider: asString(record.provider, 'eastmoney'),
    securityStatus: asString(record.security_status, 'active'),
    role: asString(record.role, 'member'),
    weight: asNumber(record.weight),
    rowCount: asNumber(record.row_count) ?? 0,
    firstTs: typeof record.first_ts === 'string' ? record.first_ts : null,
    lastTs: typeof record.last_ts === 'string' ? record.last_ts : null,
    dataProvider: typeof record.data_provider === 'string' ? record.data_provider : null,
    latestClose: asNumber(record.latest_close),
    latestChangePct: asNumber(record.latest_change_pct),
    latestAmount: asNumber(record.latest_amount),
    latestTurnover: asNumber(record.latest_turnover),
    strength20dPct: asNumber(record.strength_20d_pct),
    strength60dPct: asNumber(record.strength_60d_pct),
    ma20: asNumber(record.ma20),
    ma60: asNumber(record.ma60),
    trendStatus: trendStatus(record.trend_status),
    avgAmount20d: asNumber(record.avg_amount_20d),
    avgVolume20d: asNumber(record.avg_volume_20d),
    avgTurnover20d: asNumber(record.avg_turnover_20d),
    tradeStatus: typeof record.trade_status === 'string' ? record.trade_status : null,
    isSt: asBoolean(record.is_st),
    limitUp: asBoolean(record.limit_up),
    limitDown: asBoolean(record.limit_down),
    peTtm: asNumber(record.pe_ttm),
    pbMrq: asNumber(record.pb_mrq),
    psTtm: asNumber(record.ps_ttm),
    pcfNcfTtm: asNumber(record.pcf_ncf_ttm),
    dataStatus: dataStatus(record.data_status),
  };
}

function mapResearchUniverse(value: unknown): StrategyUniverse {
  const record = asRecord(value);
  const members = Array.isArray(record.members) ? record.members.map(mapResearchMember) : [];
  return {
    id: asString(record.id, SAMPLE_UNIVERSE_ID),
    name: asString(record.name, 'A 股股票池'),
    description: typeof record.description === 'string' ? record.description : null,
    status: asString(record.status, 'active'),
    source: asString(record.source, 'seed'),
    tags: asStringArray(record.tags),
    defaultTimeframe: asString(record.default_timeframe, 'daily'),
    defaultAdjustment: asString(record.default_adjustment, 'qfq'),
    provider: asString(record.provider, 'eastmoney'),
    members,
    memberCount: asNumber(record.member_count) ?? members.length,
    stockCount: asNumber(record.stock_count) ?? 0,
    etfCount: asNumber(record.etf_count) ?? 0,
    indexCount: asNumber(record.index_count) ?? 0,
    fundCount: asNumber(record.fund_count) ?? 0,
    readyCount: asNumber(record.ready_count) ?? 0,
    barCount: asNumber(record.bar_count) ?? 0,
    latestTs: typeof record.latest_ts === 'string' ? record.latest_ts : null,
  };
}

function mapResearchUniverseMembersPage(
  value: unknown,
  fallbackUniverseId: string,
  fallbackPage: number,
  fallbackPageSize: number
): StrategyUniverseMembersPage {
  const record = asRecord(value);
  const members = Array.isArray(record.members) ? record.members.map(mapResearchMember) : [];
  const total = asNumber(record.total) ?? members.length;
  const pageSize = asNumber(record.page_size) ?? fallbackPageSize;
  return {
    universeId: asString(record.universe_id, fallbackUniverseId),
    page: asNumber(record.page) ?? fallbackPage,
    pageSize,
    total,
    totalPages: asNumber(record.total_pages) ?? Math.max(1, Math.ceil(total / pageSize)),
    keyword: typeof record.keyword === 'string' ? record.keyword : null,
    members,
    fetchedAt: asString(record.fetched_at, new Date().toISOString()),
  };
}

function screenerMode(value: unknown): StrategyScreenerMode {
  return value === 'limit_up_relay' || value === 'trend_liquidity' || value === 'short_term'
    ? value
    : 'short_term';
}

function mapScreenerCandidate(value: unknown): StrategyScreenerCandidate {
  const record = asRecord(value);
  return {
    symbol: asString(record.symbol),
    code: asString(record.code),
    name: typeof record.name === 'string' ? record.name : null,
    exchange: asString(record.exchange, 'UNKNOWN'),
    sectorTags: asStringArray(record.sector_tags),
    tradeDate: asString(record.trade_date),
    close: asNumber(record.close),
    open: asNumber(record.open),
    high: asNumber(record.high),
    low: asNumber(record.low),
    previousClose: asNumber(record.previous_close),
    changePercent: asNumber(record.change_percent),
    amount: asNumber(record.amount),
    turnover: asNumber(record.turnover),
    ma5: asNumber(record.ma5),
    ma10: asNumber(record.ma10),
    ma20: asNumber(record.ma20),
    ma30: asNumber(record.ma30),
    ma60: asNumber(record.ma60),
    strength20dPct: asNumber(record.strength_20d_pct),
    amountRatio20d: asNumber(record.amount_ratio_20d),
    limitUpCount4d: asNumber(record.limit_up_count_4d) ?? 0,
    limitUpCount10d: asNumber(record.limit_up_count_10d) ?? 0,
    latestLimitUpDate: typeof record.latest_limit_up_date === 'string' ? record.latest_limit_up_date : null,
    isLimitUp: asBoolean(record.is_limit_up),
    isSt: asBoolean(record.is_st),
    sampleCount: asNumber(record.sample_count) ?? 0,
    score: asNumber(record.score),
    signals: asStringArray(record.signals),
    warnings: asStringArray(record.warnings),
    missingFields: asStringArray(record.missing_fields),
  };
}

function mapAnalyticsExecutionMetadata(value: unknown, fallbackBasis: string): StrategyAnalyticsExecutionMetadata {
  const record = asRecord(value);
  const engine = record.engine === 'clickhouse' ? 'clickhouse' : 'timescaledb';
  const status =
    record.status === 'hit' ||
    record.status === 'fallback' ||
    record.status === 'disabled' ||
    record.status === 'error'
      ? record.status
      : engine === 'clickhouse'
        ? 'hit'
        : 'fallback';
  const autoSyncStatus =
    record.auto_sync_status === 'synced' ||
    record.auto_sync_status === 'skipped' ||
    record.auto_sync_status === 'error'
      ? record.auto_sync_status
      : 'not_needed';
  return {
    engine,
    status,
    basis: asString(record.basis, fallbackBasis),
    targetTradeDate: typeof record.target_trade_date === 'string' ? record.target_trade_date : null,
    clickhouseTradeDate: typeof record.clickhouse_trade_date === 'string' ? record.clickhouse_trade_date : null,
    autoSyncStatus,
    autoSyncRowsWritten: asNumber(record.auto_sync_rows_written) ?? 0,
    message: typeof record.message === 'string' ? record.message : null,
  };
}

function mapScreenerResponse(value: unknown): StrategyScreenerResponse {
  const record = asRecord(value);
  const candidates = Array.isArray(record.candidates)
    ? record.candidates.map(mapScreenerCandidate)
    : [];
  const dataBasis = asString(record.data_basis, 'timescaledb.stock_bars');
  return {
    universeId: asString(record.universe_id, SAMPLE_UNIVERSE_ID),
    mode: screenerMode(record.mode),
    tradeDate: typeof record.trade_date === 'string' ? record.trade_date : null,
    timeframe: asString(record.timeframe, 'daily'),
    adjustment: asString(record.adjustment, 'qfq'),
    scannedSymbols: asNumber(record.scanned_symbols) ?? 0,
    totalCandidates: asNumber(record.total_candidates) ?? candidates.length,
    limit: asNumber(record.limit) ?? candidates.length,
    candidates,
    dataBasis,
    analytics: mapAnalyticsExecutionMetadata(record.analytics, dataBasis),
    source: asString(record.source, 'quantpilot-market-api'),
    notes: asStringArray(record.notes),
    cacheStatus: asString(record.cache_status, 'bypass'),
    cacheTtlSeconds: asNumber(record.cache_ttl_seconds),
    fetchedAt: asString(record.fetched_at, new Date().toISOString()),
  };
}

function mapCoverageItem(value: unknown): StrategyDataCoverageItem {
  const record = asRecord(value);
  return {
    symbol: asString(record.symbol),
    name: typeof record.name === 'string' ? record.name : null,
    timeframe: asString(record.timeframe, 'daily'),
    adjustment: asString(record.adjustment, 'qfq'),
    provider: asString(record.provider, 'eastmoney'),
    firstTs: typeof record.first_ts === 'string' ? record.first_ts : null,
    lastTs: typeof record.last_ts === 'string' ? record.last_ts : null,
    rowCount: asNumber(record.row_count) ?? 0,
    dataStatus: dataStatus(record.data_status),
  };
}

function mapLocalKlineBar(value: unknown): StrategyLocalKlineBar {
  const record = asRecord(value);
  const metadata = asRecord(record.metadata);
  return {
    ts: asString(record.ts, asString(record.date)),
    open: asNumber(record.open) ?? 0,
    high: asNumber(record.high) ?? 0,
    low: asNumber(record.low) ?? 0,
    close: asNumber(record.close) ?? 0,
    previousClose: asNumber(record.previous_close),
    volume: asNumber(record.volume) ?? 0,
    amount: asNumber(record.amount),
    amplitude: asNumber(record.amplitude),
    changePercent: asNumber(record.change_percent),
    changeAmount: asNumber(record.change_amount),
    turnover: asNumber(record.turnover),
    tradeStatus: typeof record.trade_status === 'string' ? record.trade_status : null,
    isSt: asBoolean(record.is_st),
    limitUp: asBoolean(record.limit_up),
    limitDown: asBoolean(record.limit_down),
    provider: asString(record.provider, asString(record.source, asString(metadata.source, 'unknown'))),
    metadata: Object.keys(metadata).length ? metadata : undefined,
  };
}

function mapDividendEvent(value: unknown): StrategyDividendEvent {
  const record = asRecord(value);
  return {
    symbol: asString(record.symbol),
    name: typeof record.name === 'string' ? record.name : null,
    reportDate: typeof record.report_date === 'string' ? record.report_date : null,
    planNoticeDate: typeof record.plan_notice_date === 'string' ? record.plan_notice_date : null,
    equityRecordDate: typeof record.equity_record_date === 'string' ? record.equity_record_date : null,
    exDividendDate: typeof record.ex_dividend_date === 'string' ? record.ex_dividend_date : null,
    noticeDate: typeof record.notice_date === 'string' ? record.notice_date : null,
    assignProgress: typeof record.assign_progress === 'string' ? record.assign_progress : null,
    planProfile: typeof record.plan_profile === 'string' ? record.plan_profile : null,
    pretaxBonusRmb: asNumber(record.pretax_bonus_rmb),
    bonusRatio: asNumber(record.bonus_ratio),
    transferRatio: asNumber(record.transfer_ratio),
    dividendYield: asNumber(record.dividend_yield),
  };
}

function mapDividendEventsResponse(value: unknown): StrategyDividendEventsResponse {
  const record = asRecord(value);
  return {
    symbol: asString(record.symbol),
    events: Array.isArray(record.events) ? record.events.map(mapDividendEvent) : [],
    source: asString(record.source, 'eastmoney'),
    fetchedAt: asString(record.fetched_at, new Date().toISOString()),
  };
}

function mapSectorCapitalFlowItem(value: unknown): StrategySectorCapitalFlowItem {
  const record = asRecord(value);
  const signal = asString(record.signal, 'insufficient');
  return {
    sector: asString(record.sector),
    memberCount: asNumber(record.member_count) ?? 0,
    coveredCount: asNumber(record.covered_count) ?? 0,
    risingCount: asNumber(record.rising_count) ?? 0,
    fallingCount: asNumber(record.falling_count) ?? 0,
    limitUpCount: asNumber(record.limit_up_count) ?? 0,
    limitDownCount: asNumber(record.limit_down_count) ?? 0,
    risingRatio: asNumber(record.rising_ratio),
    latestAmount: asNumber(record.latest_amount),
    avgAmount20d: asNumber(record.avg_amount_20d),
    amountRatio20d: asNumber(record.amount_ratio_20d),
    avgTurnover20d: asNumber(record.avg_turnover_20d),
    strength20dPct: asNumber(record.strength_20d_pct),
    strength5dPct: asNumber(record.strength_5d_pct),
    contributionRatio: asNumber(record.contribution_ratio),
    netAmountRatio: asNumber(record.net_amount_ratio),
    proxyNetAmount: asNumber(record.proxy_net_amount),
    signal: signal === 'warming' || signal === 'cooling' || signal === 'neutral' || signal === 'insufficient'
      ? signal
      : 'insufficient',
    topSymbols: Array.isArray(record.top_symbols) ? record.top_symbols.map(String).filter(Boolean) : [],
    dataBasis: asString(record.data_basis, 'stock_bars_proxy'),
  };
}

function mapSectorCapitalFlowMarketSummary(value: unknown): StrategySectorCapitalFlowMarketSummary | null {
  const record = asRecord(value);
  if (!Object.keys(record).length) return null;
  return {
    sectorCount: asNumber(record.sector_count) ?? 0,
    warmingCount: asNumber(record.warming_count) ?? 0,
    coolingCount: asNumber(record.cooling_count) ?? 0,
    neutralCount: asNumber(record.neutral_count) ?? 0,
    insufficientCount: asNumber(record.insufficient_count) ?? 0,
    coveredSymbolCount: asNumber(record.covered_symbol_count) ?? 0,
    totalLatestAmount: asNumber(record.total_latest_amount),
    proxyNetAmount: asNumber(record.proxy_net_amount),
    risingRatio: asNumber(record.rising_ratio),
    amountRatio20d: asNumber(record.amount_ratio_20d),
    avgTurnover20d: asNumber(record.avg_turnover_20d),
    strongestSectors: Array.isArray(record.strongest_sectors) ? record.strongest_sectors.map(String).filter(Boolean) : [],
    weakestSectors: Array.isArray(record.weakest_sectors) ? record.weakest_sectors.map(String).filter(Boolean) : [],
    analysis: Array.isArray(record.analysis) ? record.analysis.map(String).filter(Boolean) : [],
  };
}

function mapSectorCapitalFlowTrendPoint(value: unknown): StrategySectorCapitalFlowTrendPoint {
  const record = asRecord(value);
  return {
    tradeDate: asString(record.trade_date),
    latestAmount: asNumber(record.latest_amount),
    proxyNetAmount: asNumber(record.proxy_net_amount),
    risingRatio: asNumber(record.rising_ratio),
    amountRatio20d: asNumber(record.amount_ratio_20d),
    limitUpCount: asNumber(record.limit_up_count) ?? 0,
  };
}

function mapSectorCapitalFlowMember(value: unknown): StrategySectorCapitalFlowMember {
  const record = asRecord(value);
  return {
    symbol: asString(record.symbol),
    name: typeof record.name === 'string' ? record.name : null,
    latestAmount: asNumber(record.latest_amount),
    proxyNetAmount: asNumber(record.proxy_net_amount),
    latestChangePercent: asNumber(record.latest_change_percent),
    strength20dPct: asNumber(record.strength_20d_pct),
    turnover: asNumber(record.turnover),
    limitUp: asBoolean(record.limit_up),
  };
}

function mapSectorCapitalFlowDetail(value: unknown): StrategySectorCapitalFlowDetail | null {
  const record = asRecord(value);
  if (!Object.keys(record).length) return null;
  return {
    sector: asString(record.sector),
    item: mapSectorCapitalFlowItem(record.item),
    trend: Array.isArray(record.trend) ? record.trend.map(mapSectorCapitalFlowTrendPoint) : [],
    topMembers: Array.isArray(record.top_members) ? record.top_members.map(mapSectorCapitalFlowMember) : [],
    analysis: Array.isArray(record.analysis) ? record.analysis.map(String).filter(Boolean) : [],
  };
}

function mapSectorCapitalFlowResponse(value: unknown): StrategySectorCapitalFlowResponse {
  const record = asRecord(value);
  return {
    universeId: asString(record.universe_id),
    items: Array.isArray(record.items) ? record.items.map(mapSectorCapitalFlowItem) : [],
    marketSummary: mapSectorCapitalFlowMarketSummary(record.market_summary),
    detail: mapSectorCapitalFlowDetail(record.detail),
    source: asString(record.source, 'timescaledb'),
    proxyNote: asString(record.proxy_note),
    cacheStatus: asString(record.cache_status, 'bypass'),
    cacheTtlSeconds: asNumber(record.cache_ttl_seconds),
    fetchedAt: asString(record.fetched_at, new Date().toISOString()),
  };
}

function mapLocalKlineResponse(value: unknown): StrategyLocalKlineResponse {
  const record = asRecord(value);
  const summary = asRecord(record.summary);
  const bars = Array.isArray(record.bars) ? record.bars.map(mapLocalKlineBar) : [];
  const firstBar = bars[0] ?? null;
  const latestBar = bars.at(-1) ?? null;
  const previousBar = bars.at(-2) ?? null;
  const timeframe = asString(record.timeframe, asString(record.period, 'daily'));
  const isIntraday = timeframe.startsWith('minute');
  const previousClose = asNumber(summary.previous_close) ??
    latestBar?.previousClose ??
    (isIntraday ? null : previousBar?.close ?? null);
  const amountValues = bars.map((bar) => bar.amount).filter((value): value is number => typeof value === 'number');
  return {
    symbol: asString(record.symbol),
    code: typeof record.code === 'string' ? record.code : null,
    name: typeof record.name === 'string' ? record.name : null,
    exchange: asString(record.exchange, asString(record.market, 'UNKNOWN')),
    assetType: asString(record.asset_type, 'stock'),
    currency: asString(record.currency, 'CNY'),
    timezone: asString(record.timezone, 'Asia/Shanghai'),
    secid: typeof record.secid === 'string' ? record.secid : null,
    provider: typeof record.provider === 'string' ? record.provider : asString(record.source, '') || null,
    dataProvider: latestBar?.provider ?? null,
    timeframe,
    adjustment: asString(record.adjustment, 'qfq'),
    bars,
    summary: {
      rowCount: asNumber(summary.row_count) ?? bars.length,
      firstTs: typeof summary.first_ts === 'string' ? summary.first_ts : firstBar?.ts ?? null,
      lastTs: typeof summary.last_ts === 'string' ? summary.last_ts : latestBar?.ts ?? null,
      latestClose: asNumber(summary.latest_close) ?? latestBar?.close ?? null,
      previousClose,
      returnPct: asNumber(summary.return_pct) ??
        (latestBar && previousClose && previousClose !== 0 ? ((latestBar.close - previousClose) / previousClose) * 100 : null),
      high: asNumber(summary.high) ?? (bars.length ? Math.max(...bars.map((bar) => bar.high)) : null),
      low: asNumber(summary.low) ?? (bars.length ? Math.min(...bars.map((bar) => bar.low)) : null),
      totalVolume: asNumber(summary.total_volume) ?? bars.reduce((sum, bar) => sum + bar.volume, 0),
      totalAmount: asNumber(summary.total_amount) ?? (amountValues.length ? amountValues.reduce((sum, value) => sum + value, 0) : null),
    },
    fetchedAt: asString(record.fetched_at, new Date().toISOString()),
  };
}

function mapRealtimeQuote(value: unknown): StrategyRealtimeQuote {
  const record = asRecord(value);
  const fetchInfo = asRecord(record.fetch);
  const dataQuality = asRecord(record.data_quality);
  return {
    symbol: asString(record.symbol),
    secid: typeof record.secid === 'string' ? record.secid : null,
    name: typeof record.name === 'string' ? record.name : null,
    assetType: asString(record.asset_type, 'stock'),
    market: asString(record.market, 'UNKNOWN'),
    source: asString(record.source, 'unknown'),
    currency: asString(record.currency, 'CNY'),
    timezone: asString(record.timezone, 'Asia/Shanghai'),
    price: asNumber(record.price),
    open: asNumber(record.open),
    high: asNumber(record.high),
    low: asNumber(record.low),
    previousClose: asNumber(record.previous_close),
    changePercent: asNumber(record.change_percent),
    changeAmount: asNumber(record.change_amount),
    amplitude: asNumber(record.amplitude),
    turnover: asNumber(record.turnover),
    volume: asNumber(record.volume),
    amount: asNumber(record.amount),
    marketCap: asNumber(record.market_cap),
    floatMarketCap: asNumber(record.float_market_cap),
    quoteTime: typeof record.quote_time === 'string' ? record.quote_time : null,
    asOf: typeof record.as_of === 'string' ? record.as_of : null,
    fetchedAt: asString(record.fetched_at, new Date().toISOString()),
    cacheStatus: typeof fetchInfo.cache_status === 'string' ? fetchInfo.cache_status : null,
    cacheTtlSeconds: asNumber(fetchInfo.cache_ttl_seconds),
    dataQualityStatus: typeof dataQuality.status === 'string' ? dataQuality.status : null,
  };
}

function mapIngestionJob(value: unknown): StrategyIngestionJob {
  const record = asRecord(value);
  const metadata = asRecord(record.metadata);
  return {
    id: asString(record.id),
    universeId: typeof record.universe_id === 'string' ? record.universe_id : null,
    provider: asString(record.provider, 'unknown'),
    timeframe: asString(record.timeframe, 'daily'),
    adjustment: asString(record.adjustment, 'qfq'),
    status: asString(record.status, 'unknown'),
    totalSymbols: asNumber(record.total_symbols) ?? 0,
    completedSymbols: asNumber(record.completed_symbols) ?? 0,
    failedSymbols: asNumber(record.failed_symbols) ?? 0,
    rowsReceived: asNumber(record.rows_received) ?? 0,
    rowsUpserted: asNumber(record.rows_upserted) ?? 0,
    error: typeof record.error === 'string' ? record.error : null,
    metadata,
    batchOffset: asNumber(metadata.batch_offset),
    batchSize: asNumber(metadata.batch_size),
    nextOffset: asNumber(metadata.next_offset),
    universeTotalSymbols: asNumber(metadata.universe_total_symbols),
    startedAt: typeof record.started_at === 'string' ? record.started_at : null,
    completedAt: typeof record.completed_at === 'string' ? record.completed_at : null,
    createdAt: asString(record.created_at, new Date().toISOString()),
    updatedAt: asString(record.updated_at, new Date().toISOString()),
  };
}

function mapIngestionJobsResponse(value: unknown): StrategyIngestionJobsResponse {
  const record = asRecord(value);
  return {
    jobs: Array.isArray(record.jobs) ? record.jobs.map(mapIngestionJob) : [],
    fetchedAt: asString(record.fetched_at, new Date().toISOString()),
  };
}

function foundationStatus(value: unknown): StrategyFoundationComponent['status'] {
  return value === 'ready' || value === 'partial' || value === 'missing' ? value : 'partial';
}

function mapFoundationComponent(value: unknown): StrategyFoundationComponent {
  const record = asRecord(value);
  return {
    id: asString(record.id),
    name: asString(record.name),
    status: foundationStatus(record.status),
    count: asNumber(record.count) ?? 0,
    detail: typeof record.detail === 'string' ? record.detail : null,
  };
}

function mapFactorDefinition(value: unknown): StrategyFactorDefinition {
  const record = asRecord(value);
  return {
    factorKey: asString(record.factor_key),
    name: asString(record.name),
    category: asString(record.category, 'unknown'),
    frequency: asString(record.frequency, 'daily'),
    valueType: asString(record.value_type, 'number'),
    unit: typeof record.unit === 'string' ? record.unit : null,
    description: asString(record.description),
    formula: typeof record.formula === 'string' ? record.formula : null,
    dependencies: asStringArray(record.dependencies),
    status: asString(record.status, 'active'),
    provider: asString(record.provider, 'quantpilot'),
    metadata: asRecord(record.metadata),
    updatedAt: typeof record.updated_at === 'string' ? record.updated_at : null,
  };
}

function mapTradingCalendarDay(value: unknown): StrategyTradingCalendarDay {
  const record = asRecord(value);
  return {
    market: asString(record.market, 'CN-A'),
    tradeDate: asString(record.trade_date),
    isOpen: record.is_open !== false,
    session: asString(record.session, 'regular'),
    source: asString(record.source, 'local'),
    metadata: asRecord(record.metadata),
  };
}

function dataQualityIssueSeverity(value: unknown): StrategyDataQualityIssue['severity'] {
  return value === 'ok' || value === 'warning' || value === 'error' ? value : 'warning';
}

function mapDataQualityIssue(value: unknown): StrategyDataQualityIssue {
  const record = asRecord(value);
  return {
    symbol: typeof record.symbol === 'string' ? record.symbol : null,
    name: typeof record.name === 'string' ? record.name : null,
    severity: dataQualityIssueSeverity(record.severity),
    issueType: asString(record.issue_type, 'unknown'),
    message: asString(record.message),
    metrics: asRecord(record.metrics),
  };
}

function mapDataQualityScan(value: unknown): StrategyDataQualityScan {
  const record = asRecord(value);
  return {
    id: asString(record.id),
    universeId: typeof record.universe_id === 'string' ? record.universe_id : null,
    symbol: typeof record.symbol === 'string' ? record.symbol : null,
    scope: asString(record.scope, 'universe'),
    timeframe: asString(record.timeframe, 'daily'),
    adjustment: asString(record.adjustment, 'qfq'),
    status: asString(record.status, 'completed'),
    severity: dataQualityIssueSeverity(record.severity),
    checkedSymbols: asNumber(record.checked_symbols) ?? 0,
    passedSymbols: asNumber(record.passed_symbols) ?? 0,
    warningSymbols: asNumber(record.warning_symbols) ?? 0,
    failedSymbols: asNumber(record.failed_symbols) ?? 0,
    checkedRows: asNumber(record.checked_rows) ?? 0,
    issueCount: asNumber(record.issue_count) ?? 0,
    issues: Array.isArray(record.issues) ? record.issues.map(mapDataQualityIssue) : [],
    metrics: asRecord(record.metrics),
    startedAt: asString(record.started_at, new Date().toISOString()),
    completedAt: asString(record.completed_at, new Date().toISOString()),
  };
}

function mapIngestionJobControlResult(value: unknown): StrategyIngestionJobControlResult {
  const record = asRecord(value);
  const action = asString(record.action);
  return {
    jobId: asString(record.job_id),
    action: action === 'pause' || action === 'resume' || action === 'stop' ? action : 'pause',
    status: asString(record.status, 'unknown'),
    control: asString(record.control, 'unknown'),
    updatedAt: asString(record.updated_at, new Date().toISOString()),
  };
}

async function fetchMarketApiJson<T>(
  pathName: string,
  options: { timeoutMs?: number } = {}
): Promise<T> {
  assertMarketApiEnabled();
  const controller = options.timeoutMs ? new AbortController() : null;
  const timeout = controller && options.timeoutMs
    ? setTimeout(() => controller.abort(), options.timeoutMs)
    : null;
  try {
    const response = await fetch(`${MARKET_API_BASE_URL}${pathName}`, {
      cache: 'no-store',
      signal: controller?.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`market API ${response.status}: ${body.slice(0, 180)}`);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`market API timeout after ${options.timeoutMs}ms: ${pathName}`);
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function getStrategyUniverseMembersPage(params: {
  universeId?: string;
  page?: number;
  pageSize?: number;
  keyword?: string;
  timeoutMs?: number;
} = {}): Promise<StrategyUniverseMembersPage> {
  const universeId = params.universeId || SAMPLE_UNIVERSE_ID;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, Math.min(params.pageSize ?? 10, 100));
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  const keyword = params.keyword?.trim();
  if (keyword) query.set('keyword', keyword);
  const payload = await fetchMarketApiJson<unknown>(
    `/api/v1/research/universes/${encodeURIComponent(universeId)}/members?${query.toString()}`,
    { timeoutMs: params.timeoutMs }
  );
  return mapResearchUniverseMembersPage(payload, universeId, page, pageSize);
}

export async function runStrategyScreener(params: {
  universeId?: string;
  tradeDate?: string;
  mode?: StrategyScreenerMode;
  limit?: number;
  timeoutMs?: number;
} = {}): Promise<StrategyScreenerResponse> {
  const query = new URLSearchParams({
    universe_id: params.universeId || SAMPLE_UNIVERSE_ID,
    mode: params.mode || 'short_term',
    limit: String(Math.max(1, Math.min(params.limit ?? 20, 100))),
  });
  const tradeDate = params.tradeDate?.trim();
  if (tradeDate) query.set('trade_date', tradeDate);
  const payload = await fetchMarketApiJson<unknown>(
    `/api/v1/research/screeners/a-share/short-term-candidates?${query.toString()}`,
    { timeoutMs: params.timeoutMs }
  );
  return mapScreenerResponse(payload);
}

export async function getStrategyIngestionJobs(params: {
  universeId?: string;
  limit?: number;
} = {}): Promise<StrategyIngestionJobsResponse> {
  const query = new URLSearchParams({
    limit: String(Math.max(1, Math.min(params.limit ?? 20, 100))),
  });
  const universeId = params.universeId?.trim();
  if (universeId) query.set('universe_id', universeId);
  const payload = await fetchMarketApiJson<unknown>(`/api/v1/ingestion/jobs?${query.toString()}`);
  return mapIngestionJobsResponse(payload);
}

export async function controlStrategyIngestionJob(params: {
  jobId: string;
  action: 'pause' | 'resume' | 'stop';
  reason?: string;
}): Promise<StrategyIngestionJobControlResult> {
  assertMarketApiEnabled();
  const jobId = params.jobId.trim();
  if (!jobId) throw new Error('缺少补数任务 ID');
  const response = await fetch(
    `${MARKET_API_BASE_URL}/api/v1/ingestion/jobs/${encodeURIComponent(jobId)}/control`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: params.action, reason: params.reason }),
      cache: 'no-store',
    }
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`market API ${response.status}: ${text.slice(0, 200)}`);
  }
  return mapIngestionJobControlResult(await response.json());
}

export async function runStrategyDataQualityScan(params: {
  universeId?: string;
  symbols?: string[];
  timeframe?: string;
  adjustment?: string;
  lookbackYears?: number;
  persist?: boolean;
} = {}): Promise<StrategyDataQualityScan> {
  assertMarketApiEnabled();
  const response = await fetch(`${MARKET_API_BASE_URL}/api/v1/foundation/data-quality/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      universe_id: params.universeId || SAMPLE_UNIVERSE_ID,
      symbols: params.symbols?.length ? params.symbols : undefined,
      timeframe: params.timeframe || 'daily',
      adjustment: params.adjustment || 'qfq',
      lookback_years: params.lookbackYears ?? FALLBACK_RESEARCH_STATE.ingestionPlan.lookbackYears,
      persist: params.persist !== false,
    }),
    cache: 'no-store',
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`market API ${response.status}: ${text.slice(0, 200)}`);
  }
  return mapDataQualityScan(await response.json());
}

export async function getStrategySectorCapitalFlow(params: {
  universeId?: string;
  limit?: number;
  sector?: string;
  detailDays?: number;
} = {}): Promise<StrategySectorCapitalFlowResponse> {
  const query = new URLSearchParams({
    universe_id: params.universeId || SAMPLE_UNIVERSE_ID,
    limit: String(Math.max(1, Math.min(params.limit ?? 40, 120))),
  });
  if (params.sector) {
    query.set('sector', params.sector);
  }
  if (params.detailDays) {
    query.set('detail_days', String(Math.max(5, Math.min(params.detailDays, 60))));
  }
  const payload = await fetchMarketApiJson<unknown>(
    `/api/v1/research/sector-capital-flow?${query.toString()}`
  );
  return mapSectorCapitalFlowResponse(payload);
}

async function getStrategyResearchState(): Promise<StrategyResearchState> {
  try {
    const universesPayload = asRecord(
      await fetchMarketApiJson<unknown>('/api/v1/research/universes/summary', { timeoutMs: 2500 })
    );
    const universes = Array.isArray(universesPayload.universes)
      ? universesPayload.universes.map(mapResearchUniverse)
      : [];
    const primaryUniverse =
      universes.find((universe) => universe.id === SAMPLE_UNIVERSE_ID) ??
      universes.find((universe) => universe.stockCount > 0) ??
      universes[0] ??
      FALLBACK_RESEARCH_STATE.universes[0];
    const initialMembersPage = await getStrategyUniverseMembersPage({
      universeId: primaryUniverse.id,
      page: 1,
      pageSize: 10,
      timeoutMs: 4500,
    });
    const hydratedUniverses = universes.map((universe) => (
      universe.id === primaryUniverse.id
        ? {
            ...universe,
            members: initialMembersPage.members,
            memberCount: initialMembersPage.total || universe.memberCount,
          }
        : { ...universe, members: [] }
    ));
    const coverage = initialMembersPage.members.map((member): StrategyDataCoverageItem => ({
      symbol: member.symbol,
      name: member.name,
      timeframe: primaryUniverse.defaultTimeframe,
      adjustment: primaryUniverse.defaultAdjustment,
      provider: member.dataProvider ?? primaryUniverse.provider,
      firstTs: member.firstTs ?? null,
      lastTs: member.lastTs ?? null,
      rowCount: member.rowCount,
      dataStatus: member.dataStatus,
    }));

    return {
      ...FALLBACK_RESEARCH_STATE,
      primaryUniverseId: primaryUniverse.id,
      source: 'market-api',
      universes: hydratedUniverses.length ? hydratedUniverses : FALLBACK_RESEARCH_STATE.universes,
      coverage: coverage.length ? coverage : FALLBACK_RESEARCH_STATE.coverage,
      ingestionPlan: {
        ...FALLBACK_RESEARCH_STATE.ingestionPlan,
        universeId: primaryUniverse.id,
        timeframe: primaryUniverse.defaultTimeframe,
        adjustment: primaryUniverse.defaultAdjustment,
        provider: primaryUniverse.provider,
        lookbackYears: FALLBACK_RESEARCH_STATE.ingestionPlan.lookbackYears,
      },
      error: null,
    };
  } catch (error) {
    return {
      ...FALLBACK_RESEARCH_STATE,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getStrategyFoundationState(): Promise<StrategyFoundationState> {
  try {
    const [statusResult, factorsResult, calendarResult] = await Promise.allSettled([
      fetchMarketApiJson<unknown>('/api/v1/foundation/status', { timeoutMs: 2000 }),
      fetchMarketApiJson<unknown>('/api/v1/foundation/factors', { timeoutMs: 2000 }),
      fetchMarketApiJson<unknown>('/api/v1/foundation/trading-calendar?market=CN-A&limit=30', { timeoutMs: 2500 }),
    ]);
    const failures = [statusResult, factorsResult, calendarResult]
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
    if (
      statusResult.status === 'rejected' &&
      factorsResult.status === 'rejected' &&
      calendarResult.status === 'rejected'
    ) {
      throw new Error(failures.join('；') || '基础组件接口暂不可用');
    }
    const statusPayload = statusResult.status === 'fulfilled' ? statusResult.value : {};
    const factorsPayload = factorsResult.status === 'fulfilled' ? factorsResult.value : {};
    const calendarPayload = calendarResult.status === 'fulfilled' ? calendarResult.value : {};
    const statusRecord = asRecord(statusPayload);
    const factorsRecord = asRecord(factorsPayload);
    const calendarRecord = asRecord(calendarPayload);
    return {
      source: 'market-api',
      components: Array.isArray(statusRecord.components)
        ? statusRecord.components.map(mapFoundationComponent)
        : FALLBACK_FOUNDATION_STATE.components,
      factors: Array.isArray(factorsRecord.factors)
        ? factorsRecord.factors.map(mapFactorDefinition)
        : [],
      calendarDays: Array.isArray(calendarRecord.days)
        ? calendarRecord.days.map(mapTradingCalendarDay)
        : [],
      latestQualityScan: null,
      error: failures.length ? failures.join('；') : null,
    };
  } catch (error) {
    return {
      ...FALLBACK_FOUNDATION_STATE,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function isStrategyCapability(capabilityId?: string | null): capabilityId is QuantCapabilityId {
  return capabilityId === 'strategy_research' || capabilityId === 'backtest_review' || capabilityId === 'portfolio_risk';
}

function toWorkspaceRef(project: Project): StrategyWorkspaceRef {
  return {
    id: project.id,
    name: project.name,
    status: project.status ?? null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt ?? null,
    capabilityId: project.quantCapabilityId ?? null,
    initialPrompt: project.initialPrompt ?? null,
  };
}

function matchesTemplate(project: StrategyWorkspaceRef, template: StrategyTemplate) {
  if (project.capabilityId === template.capabilityId) return true;
  const prompt = `${project.name} ${project.initialPrompt ?? ''}`.toLowerCase();
  return template.defaultSymbols.some(symbol => prompt.includes(symbol.toLowerCase())) ||
    template.parameterSchema.some(param => prompt.includes(param.key.toLowerCase()));
}

export async function getStrategyDashboardData(): Promise<StrategyDashboardData> {
  const projects = serializeProjects(await getAllProjects().catch(() => []));
  const [scanRuns, scanJobs, research, foundation] = await Promise.all([
    listScanRuns(),
    listScanJobs(),
    getStrategyResearchState(),
    getStrategyFoundationState(),
  ]);
  const strategyWorkspaces = projects
    .filter(project => isStrategyCapability(project.quantCapabilityId))
    .map(toWorkspaceRef);

  const templates = listCatalogTemplates().map((template): StrategyCatalogItem => ({
    ...template,
    readiness: readinessFor(template),
    linkedWorkspaces: strategyWorkspaces.filter(project => matchesTemplate(project, template)),
    latestScanRun: scanRuns.find(run => run.templateId === template.id) ?? null,
  }));

  const dependencySet = new Set(templates.flatMap(template => template.dataDependencies));
  const parameterScans = templates.reduce((sum, template) => sum + template.parameterScans.length, 0);
  const archivedReports = templates.reduce((sum, template) => sum + template.backtestArchives.length, 0);
  const activeVersions = templates.reduce(
    (sum, template) => sum + template.versions.filter(version => version.status === 'active').length,
    0
  );
  const trackedSymbols = research.universes.reduce(
    (sum, universe) => sum + universe.memberCount,
    0
  );
  const syncedSymbols = research.universes.reduce((sum, universe) => sum + universe.readyCount, 0);
  const syncedBars = research.universes.reduce((sum, universe) => sum + universe.barCount, 0);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      templates: templates.length,
      readyTemplates: templates.filter(template => template.status === 'ready').length,
      plannedTemplates: templates.filter(template => template.status === 'planned').length,
      strategyWorkspaces: strategyWorkspaces.length,
      backtestWorkspaces: strategyWorkspaces.filter(project => project.capabilityId === 'backtest_review').length,
      dataDependencies: dependencySet.size,
      parameterScans,
      archivedReports,
      activeVersions,
      researchUniverses: research.universes.length,
      trackedSymbols,
      syncedSymbols,
      syncedBars,
    },
    templates,
    workspaces: strategyWorkspaces,
    scanRuns,
    scanJobs,
    research,
    foundation,
    factorCatalog: STRATEGY_FACTOR_CATALOG,
  };
}

export function buildStrategyPrompt(templateId: string, symbol?: string) {
  const template = STRATEGY_TEMPLATES.find(item => item.id === templateId) ?? STRATEGY_TEMPLATES[0];
  const target = symbol?.trim() || template.defaultSymbols[0];
  const capability = getQuantCapability(template.capabilityId);
  return {
    name: `${template.name} · ${target}`,
    prompt: `${template.promptSeed}\n\n策略模板：${template.name}\n目标标的：${target}\n能力模块：${capability.name}\n必须展示参数、数据来源、风险限制和验证结论边界。`,
    capabilityId: capability.id,
  };
}

export async function ingestStrategyUniverseHistory(params: {
  universeId?: string;
  symbols?: string[];
  limit?: number;
  lookbackYears?: number;
  period?: string;
  adjustment?: string;
} = {}): Promise<StrategyHistoryIngestionResult> {
  assertMarketApiEnabled();
  const body = {
    universe_id: params.universeId || SAMPLE_UNIVERSE_ID,
    symbols: params.symbols?.length ? params.symbols : undefined,
    period: params.period || 'daily',
    adjustment: params.adjustment || 'qfq',
    limit: params.limit ?? FALLBACK_RESEARCH_STATE.ingestionPlan.suggestedLimit,
    lookback_years: params.lookbackYears ?? FALLBACK_RESEARCH_STATE.ingestionPlan.lookbackYears,
  };
  const response = await fetch(`${MARKET_API_BASE_URL}/api/v1/ingestion/eastmoney/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`market API ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json() as Promise<StrategyHistoryIngestionResult>;
}

export async function ingestStrategyUniverseHistoryBatch(params: {
  universeId?: string;
  offset?: number;
  batchSize?: number;
  limit?: number;
  lookbackYears?: number;
  start?: string;
  end?: string;
  period?: string;
  adjustment?: string;
  includeValuationFactors?: boolean;
} = {}): Promise<StrategyHistoryIngestionResult> {
  assertMarketApiEnabled();
  const body = {
    universe_id: params.universeId || SAMPLE_UNIVERSE_ID,
    offset: Math.max(0, params.offset ?? 0),
    batch_size: Math.max(1, Math.min(params.batchSize ?? 25, 200)),
    period: params.period || 'daily',
    adjustment: params.adjustment || 'qfq',
    limit: params.limit ?? FALLBACK_RESEARCH_STATE.ingestionPlan.suggestedLimit,
    lookback_years: params.lookbackYears ?? FALLBACK_RESEARCH_STATE.ingestionPlan.lookbackYears,
    start: params.start || undefined,
    end: params.end || undefined,
    include_valuation_factors: params.includeValuationFactors === true,
    request_delay_seconds: 0.2,
  };
  const response = await fetch(`${MARKET_API_BASE_URL}/api/v1/ingestion/baostock/history/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`market API ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json() as Promise<StrategyHistoryIngestionResult>;
}

export async function startStrategyUniverseHistoryAutoFill(params: {
  universeId?: string;
  offset?: number;
  batchSize?: number;
  limit?: number;
  lookbackYears?: number;
  start?: string;
  end?: string;
  period?: string;
  adjustment?: string;
  maxBatches?: number;
  includeValuationFactors?: boolean;
} = {}): Promise<StrategyAutoFillIngestionStartResult> {
  assertMarketApiEnabled();
  const body = {
    universe_id: params.universeId || SAMPLE_UNIVERSE_ID,
    offset: Math.max(0, params.offset ?? 0),
    batch_size: Math.max(1, Math.min(params.batchSize ?? 25, 200)),
    period: params.period || 'daily',
    adjustment: params.adjustment || 'qfq',
    limit: params.limit ?? FALLBACK_RESEARCH_STATE.ingestionPlan.suggestedLimit,
    lookback_years: params.lookbackYears ?? FALLBACK_RESEARCH_STATE.ingestionPlan.lookbackYears,
    start: params.start || undefined,
    end: params.end || undefined,
    include_valuation_factors: params.includeValuationFactors === true,
    request_delay_seconds: 0.2,
    batch_delay_seconds: 0.2,
    max_batches: params.maxBatches,
  };
  const response = await fetch(`${MARKET_API_BASE_URL}/api/v1/ingestion/baostock/history/autofill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`market API ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json() as Promise<StrategyAutoFillIngestionStartResult>;
}

export async function addStrategyUniverseMember(params: {
  universeId?: string;
  query: string;
  syncHistory?: boolean;
}): Promise<StrategyUniverseMemberAddResult> {
  assertMarketApiEnabled();
  const universeId = params.universeId || SAMPLE_UNIVERSE_ID;
  const response = await fetch(
    `${MARKET_API_BASE_URL}/api/v1/research/universes/${encodeURIComponent(universeId)}/members`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: params.query }),
      cache: 'no-store',
    }
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`market API ${response.status}: ${text.slice(0, 200)}`);
  }

  const payload = asRecord(await response.json());
  const member = mapResearchMember(payload.member);
  let ingestion: StrategyHistoryIngestionResult | null = null;
  if (params.syncHistory === true) {
    ingestion = await ingestStrategyUniverseHistory({
      universeId,
      symbols: [member.symbol],
    });
  }

  return {
    universe_id: asString(payload.universe_id, universeId),
    member,
    candidates: Array.isArray(payload.candidates)
      ? payload.candidates.map(candidate => asRecord(candidate)).map(candidate => ({
        symbol: asString(candidate.symbol),
        name: typeof candidate.name === 'string' ? candidate.name : null,
        market: asString(candidate.market, 'UNKNOWN'),
        asset_type: asString(candidate.asset_type, 'stock'),
        secid: asString(candidate.secid),
        source: asString(candidate.source, 'eastmoney'),
      }))
      : [],
    ingestion,
  };
}

export async function getStrategySymbolBars(params: {
  symbol: string;
  timeframe?: string;
  adjustment?: string;
  provider?: string | null;
  limit?: number;
  includeMetadata?: boolean;
}): Promise<StrategyLocalKlineResponse> {
  assertMarketApiEnabled();
  const query = new URLSearchParams({
    timeframe: params.timeframe || 'daily',
    adjustment: params.adjustment || 'qfq',
    limit: String(params.limit ?? 240),
    include_metadata: params.includeMetadata ? 'true' : 'false',
  });
  if (params.provider) query.set('provider', params.provider);
  const response = await fetch(
    `${MARKET_API_BASE_URL}/api/v1/research/bars/${encodeURIComponent(params.symbol)}?${query.toString()}`,
    { cache: 'no-store' }
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`market API ${response.status}: ${text.slice(0, 200)}`);
  }
  return mapLocalKlineResponse(await response.json());
}

export async function getStrategySymbolDividends(params: {
  symbol: string;
  limit?: number;
}): Promise<StrategyDividendEventsResponse> {
  assertMarketApiEnabled();
  const query = new URLSearchParams({
    limit: String(params.limit ?? 20),
  });
  const response = await fetch(
    `${MARKET_API_BASE_URL}/api/v1/events/dividends/${encodeURIComponent(params.symbol)}?${query.toString()}`,
    { cache: 'no-store' }
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`market API ${response.status}: ${text.slice(0, 200)}`);
  }
  return mapDividendEventsResponse(await response.json());
}

export async function getStrategyRealtimeQuote(params: {
  symbol: string;
}): Promise<StrategyRealtimeQuote> {
  const symbol = params.symbol.trim();
  if (!symbol) throw new Error('缺少实时行情标的');
  const payload = await fetchMarketApiJson<unknown>(
    `/api/v1/quotes/realtime/${encodeURIComponent(symbol)}`
  );
  return mapRealtimeQuote(payload);
}

export async function getStrategyIntradayBars(params: {
  symbol: string;
  period?: string;
  limit?: number;
  refresh?: boolean;
}): Promise<StrategyLocalKlineResponse> {
  const symbol = params.symbol.trim();
  if (!symbol) throw new Error('缺少分时行情标的');
  const period = params.period || 'minute1';
  if (!['minute1', 'minute5', 'minute15', 'minute30', 'minute60'].includes(period)) {
    throw new Error(`不支持的分时周期：${period}`);
  }
  const query = new URLSearchParams({
    period,
    adjustment: 'none',
    limit: String(Math.max(1, Math.min(params.limit ?? 241, 1000))),
  });
  if (params.refresh) {
    query.set('refresh', 'true');
  }
  const payload = await fetchMarketApiJson<unknown>(
    `/api/v1/quotes/history/${encodeURIComponent(symbol)}?${query.toString()}`
  );
  return mapLocalKlineResponse(payload);
}

export async function runStrategyParameterScan(params: {
  templateId: string;
  scanId: string;
  symbol?: string;
}): Promise<StrategyScanRun> {
  const template = findTemplate(params.templateId);
  if (!template) {
    throw new Error(`Unknown strategy template: ${params.templateId}`);
  }
  const scan = findScan(template, params.scanId);
  if (!scan) {
    throw new Error(`Unknown parameter scan: ${params.scanId}`);
  }
  const startedAt = new Date().toISOString();
  const symbol = params.symbol?.trim() || template.defaultSymbols[0] || '510300';
  const combinations = expandGrid(scan).slice(0, 64);
  const results: StrategyScanRunResult[] = [];

  if (scan.status !== 'available') {
    const run: StrategyScanRun = {
      id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      templateId: template.id,
      scanId: scan.id,
      symbol,
      status: 'failed',
      startedAt,
      completedAt: new Date().toISOString(),
      total: combinations.length,
      succeeded: 0,
      failed: combinations.length,
      bestResultId: null,
      objective: scan.objective,
      source: scan.status === 'planned' ? 'parameter scan is planned' : 'parameter scan is blocked',
      results: combinations.map((parameters, index) => ({
        id: `${scan.id}-${index + 1}`,
        parameters,
        status: 'skipped',
        metrics: {},
        error: scan.status === 'planned' ? '扫描仍在规划中' : '扫描被依赖阻断',
      })),
    };
    await writeScanRun(run);
    return run;
  }

  for (const [index, parameters] of combinations.entries()) {
    const id = `${scan.id}-${index + 1}`;
    if (template.backtestStrategyId === 'ma_crossover' && !isValidMaCrossoverParams(parameters)) {
      results.push({
        id,
        parameters,
        status: 'skipped',
        metrics: {},
        error: 'fast_window 必须小于 slow_window',
      });
      continue;
    }

    try {
      const backtest = await fetchBacktest({
        symbol,
        parameters,
        strategyId: template.backtestStrategyId,
        limit: template.backtestLimit,
      });
      results.push({
        id,
        parameters,
        status: 'success',
        metrics: summarizeBacktest(backtest),
      });
    } catch (error) {
      results.push({
        id,
        parameters,
        status: 'failed',
        metrics: {},
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const best = chooseBestResult(results);
  const succeeded = results.filter(result => result.status === 'success').length;
  const failed = results.filter(result => result.status === 'failed').length;
  const run: StrategyScanRun = {
    id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    templateId: template.id,
    scanId: scan.id,
    symbol,
    status: succeeded === 0 ? 'failed' : failed > 0 ? 'partial' : 'completed',
    startedAt,
    completedAt: new Date().toISOString(),
    total: results.length,
    succeeded,
    failed,
    bestResultId: best?.id ?? null,
    objective: scan.objective,
    source: `${MARKET_API_BASE_URL}/api/v1/backtests/strategies/${template.backtestStrategyId}/{symbol}`,
    results,
  };
  await writeScanRun(run);
  return run;
}

async function executeScanJob(job: StrategyScanJob) {
  const runningJob: StrategyScanJob = {
    ...job,
    status: 'running',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: null,
  };
  await writeScanJob(runningJob);

  try {
    const run = await runStrategyParameterScan({
      templateId: job.templateId,
      scanId: job.scanId,
      symbol: job.symbol,
    });
    await writeScanJob({
      ...runningJob,
      status: run.status === 'failed' ? 'failed' : 'completed',
      runId: run.id,
      completedAt: run.completedAt,
      updatedAt: new Date().toISOString(),
      error: run.status === 'failed' ? '扫描未产生成功结果' : null,
    });
  } catch (error) {
    await writeScanJob({
      ...runningJob,
      status: 'failed',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function enqueueStrategyParameterScan(params: {
  templateId: string;
  scanId: string;
  symbol?: string;
}): Promise<StrategyScanJob> {
  const template = findTemplate(params.templateId);
  if (!template) {
    throw new Error(`Unknown strategy template: ${params.templateId}`);
  }
  const scan = findScan(template, params.scanId);
  if (!scan) {
    throw new Error(`Unknown parameter scan: ${params.scanId}`);
  }

  const now = new Date().toISOString();
  const job: StrategyScanJob = {
    id: `scan-job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    templateId: template.id,
    scanId: scan.id,
    symbol: params.symbol?.trim() || template.defaultSymbols[0] || '510300',
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    runId: null,
    error: null,
  };
  await writeScanJob(job);

  setTimeout(() => {
    void executeScanJob(job);
  }, 0);

  return job;
}
