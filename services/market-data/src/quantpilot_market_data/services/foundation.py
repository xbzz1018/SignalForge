from __future__ import annotations

from datetime import date

from quantpilot_market_data.models import (
    DataQualityScanRequest,
    DataQualityScanResponse,
    FactorDefinitionResponse,
    FoundationStatusResponse,
    TradingCalendarResponse,
)
from quantpilot_market_data.repositories.foundation import (
    list_factor_definitions,
    list_foundation_components,
    list_trading_calendar_days,
    run_data_quality_scan,
)


async def get_foundation_status() -> FoundationStatusResponse:
    return FoundationStatusResponse(components=await list_foundation_components())


async def get_factor_definitions(
    *,
    category: str | None = None,
    status: str | None = None,
) -> FactorDefinitionResponse:
    return FactorDefinitionResponse(
        factors=await list_factor_definitions(category=category, status=status)
    )


async def get_trading_calendar(
    *,
    market: str,
    start: str | None,
    end: str | None,
    limit: int,
) -> TradingCalendarResponse:
    days = await list_trading_calendar_days(
        market=market,
        start=start,
        end=end,
        limit=limit,
    )
    return TradingCalendarResponse(
        market=market,
        start=date.fromisoformat(start) if start else None,
        end=date.fromisoformat(end) if end else None,
        days=days,
    )


async def scan_data_quality(
    request: DataQualityScanRequest,
) -> DataQualityScanResponse:
    return await run_data_quality_scan(request)
