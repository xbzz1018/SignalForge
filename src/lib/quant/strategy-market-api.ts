import { getRuntimeDegradationConfig } from '@/lib/config/degradation';

export const MARKET_API_BASE_URL =
  process.env.SIGNALFORGE_MARKET_API_URL || process.env.SIGNALFORGE_MARKET_API_BASE_URL || 'http://127.0.0.1:8000';

export class MarketApiError extends Error {
  constructor(
    readonly code: 'MARKET_API_DISABLED' | 'MARKET_API_TIMEOUT' | 'MARKET_API_UPSTREAM_ERROR',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'MarketApiError';
  }
}

export async function fetchBacktest(params: {
  symbol: string;
  parameters: Record<string, string | number>;
  strategyId: string;
  limit?: number;
}): Promise<Record<string, unknown>> {
  const query = new URLSearchParams({
    fee_bps: String(params.parameters.fee_bps ?? 5),
    slippage_bps: String(params.parameters.slippage_bps ?? 0),
    period: 'daily',
    adjustment: 'qfq',
    limit: String(params.limit ?? 1260),
  });
  for (const [key, value] of Object.entries(params.parameters)) {
    query.set(key, String(value));
  }
  return fetchMarketApiJson<Record<string, unknown>>(
    `/api/v1/backtests/strategies/${encodeURIComponent(params.strategyId)}/${encodeURIComponent(params.symbol)}?${query.toString()}`,
  );
}

export async function fetchMarketApiJson<T>(
  pathName: string,
  options: { timeoutMs?: number; init?: RequestInit } = {}
): Promise<T> {
  if (!getRuntimeDegradationConfig().components.marketApi.enabled) {
    throw new MarketApiError('MARKET_API_DISABLED', 'market API 已按降级配置停用');
  }
  const { timeoutMs, init } = options;
  const callerSignal = init?.signal;
  const deadline = timeoutMs ? new AbortController() : undefined;
  const signal = deadline && callerSignal
    ? AbortSignal.any([callerSignal, deadline.signal])
    : deadline?.signal ?? callerSignal;
  const timeout = deadline && setTimeout(() => deadline.abort(new MarketApiError(
    'MARKET_API_TIMEOUT', `market API timeout after ${timeoutMs}ms`,
  )), timeoutMs);
  try {
    signal?.throwIfAborted();
    const response = await fetch(`${MARKET_API_BASE_URL}${pathName}`, {
      cache: 'no-store',
      ...init,
      signal,
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new MarketApiError('MARKET_API_UPSTREAM_ERROR', `market API returned HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof MarketApiError) throw error;
    throw new MarketApiError('MARKET_API_UPSTREAM_ERROR', 'market API request failed', { cause: error });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function marketAdminHeaders(): Record<string, string> {
  const token = process.env.SIGNALFORGE_MARKET_ADMIN_TOKEN?.trim();
  return token ? { 'X-SignalForge-Admin-Token': token } : {};
}
