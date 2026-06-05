from __future__ import annotations

from quantpilot_market_data.cache import MarketDataCache
from quantpilot_market_data.indicators import build_technical_indicators
from quantpilot_market_data.models import (
    Adjustment,
    KlinePeriod,
    TechnicalIndicatorsResponse,
)
from quantpilot_market_data.providers.base import HistoricalKlineProvider
from quantpilot_market_data.services.caching import cache_response, read_cached_response


async def get_technical_indicators(
    client: HistoricalKlineProvider,
    cache: MarketDataCache,
    *,
    symbol: str,
    period: KlinePeriod,
    adjustment: Adjustment,
    limit: int,
    end: str,
    ttl_seconds: int,
) -> TechnicalIndicatorsResponse:
    normalized_limit = max(1, min(limit, 1000))
    cache_key = cache.build_key(
        "technical-indicators",
        {
            "symbol": symbol,
            "period": period,
            "adjustment": adjustment,
            "limit": normalized_limit,
            "end": end,
        },
    )
    cached = read_cached_response(cache, cache_key, TechnicalIndicatorsResponse)
    if cached is not None:
        return cached

    kline = await client.get_kline(
        symbol,
        period=period,
        adjustment=adjustment,
        limit=normalized_limit,
        end=end,
    )
    response = build_technical_indicators(kline)
    return cache_response(cache, cache_key, ttl_seconds, response, TechnicalIndicatorsResponse)
