from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from quantpilot_market_data.backtest import (
    build_ma_crossover_backtest,
    build_strategy_backtest,
    canonical_strategy_id,
)
from quantpilot_market_data.backtest_experiments import current_engine_identity, verify_experiment
from quantpilot_market_data.backtest_parameters import (
    backtest_date,
    finite_decimal,
    normalize_strategy_parameters,
    periods_per_year,
)
from quantpilot_market_data.cache import MarketDataCache
from quantpilot_market_data.contracts.analysis import BacktestResponse
from quantpilot_market_data.contracts.quotes import Adjustment, KlinePeriod, KlineResponse
from quantpilot_market_data.providers.base import HistoricalKlineProvider
from quantpilot_market_data.services.caching import cache_response, read_cached_response
from quantpilot_market_data.services.kline_gateway import (
    get_kline_local_first,
    get_local_kline_if_ready,
)


def _read_cached_backtest(cache: MarketDataCache, cache_key: str) -> BacktestResponse | None:
    try:
        cached = read_cached_response(cache, cache_key, BacktestResponse)
        if cached is not None:
            verify_experiment(cached)
        return cached
    except ValueError:
        # A stale or damaged cache is replaceable; captured artifacts are never repaired this way.
        return None


def _history_request(
    *,
    limit: int,
    start: str | None,
    end: str,
    period: KlinePeriod,
    parameters: dict[str, object],
    initial_cash: Decimal,
) -> tuple[int, str | None, str | None]:
    periods_per_year(period)
    cash = finite_decimal(initial_cash, "initial_cash")
    if cash <= 0:
        raise ValueError("initial_cash 必须为大于 0 的有限数值。")
    if not 1 <= limit <= 1500:
        raise ValueError("limit 必须在 1 到 1500 之间。")
    start_date = backtest_date(start)
    end_date = None if end == "20500101" else backtest_date(end)
    warmup = (
        max(
            (int(value) for key, value in parameters.items() if key.endswith("_window")), default=60
        )
        + 5
    )
    required = warmup + 1
    if start_date is None:
        if limit <= warmup - 5:
            raise ValueError('limit 必须大于策略指标窗口，不能自动扩大研究样本。')
        return limit, start_date, end_date
    if start_date:
        cutoff = (
            date.fromisoformat(end_date)
            if end_date
            else datetime.now(ZoneInfo("Asia/Shanghai")).date()
        )
        first = date.fromisoformat(start_date)
        if first > cutoff:
            raise ValueError("回测开始日期不能晚于结束日期。")
        days = (cutoff - first).days
        bars = days + 1 if period == "daily" else days // 7 + 2
        if period == "monthly":
            bars = (cutoff.year - first.year) * 12 + cutoff.month - first.month + 2
        required += bars
    if required > 1500:
        raise ValueError("回测区间及指标预热超过 1500 根行情上限，请缩短区间。")
    return max(limit, required), start_date, end_date


def _check_coverage(
    kline: KlineResponse, start: str | None, parameters: dict[str, object], limit: int,
) -> KlineResponse:
    if start:
        warmup = max(
            (int(value) for key, value in parameters.items() if key.endswith("_window")), default=0
        )
        if sum(bar.date < start for bar in kline.bars) < warmup:
            raise ValueError("指定回测区间的指标预热行情不足，不能按默认样本替代。")
    else:
        if len(kline.bars) < limit:
            raise ValueError('回测行情不足请求的样本数量。')
        kline = kline.model_copy(update={'bars': kline.bars[-limit:]})
    return kline


async def get_ma_crossover_backtest(
    client: HistoricalKlineProvider,
    cache: MarketDataCache,
    *,
    symbol: str,
    fast_window: int,
    slow_window: int,
    period: KlinePeriod,
    adjustment: Adjustment,
    limit: int,
    end: str,
    initial_cash: Decimal,
    fee_bps: Decimal,
    ttl_seconds: int,
    start: str | None = None,
) -> BacktestResponse:
    parameters = normalize_strategy_parameters(
        "ma_crossover",
        {"fast_window": fast_window, "slow_window": slow_window},
        fee_bps,
    )
    normalized_fast, normalized_slow = parameters["fast_window"], parameters["slow_window"]
    normalized_limit, start_date, end_date = _history_request(
        limit=limit,
        start=start,
        end=end,
        period=period,
        parameters=parameters,
        initial_cash=initial_cash,
    )
    local = await get_local_kline_if_ready(
        symbol=symbol,
        period=period,
        adjustment=adjustment,
        limit=normalized_limit,
        end=(end_date or "2050-01-01").replace("-", ""),
    )
    if local is not None:
        local = _check_coverage(local, start_date, parameters, limit)
        return build_ma_crossover_backtest(
            local,
            fast_window=normalized_fast,
            slow_window=normalized_slow,
            initial_cash=initial_cash,
            fee_bps=fee_bps,
            start=start_date,
            end=end_date,
        )
    cache_key = cache.build_key(
        "backtest-ma-crossover",
        {
            "engine": current_engine_identity().model_dump(mode="json"),
            "symbol": symbol,
            "fast_window": normalized_fast,
            "slow_window": normalized_slow,
            "period": period,
            "adjustment": adjustment,
            "limit": normalized_limit,
            "end": end,
            "start": start_date,
            "initial_cash": str(initial_cash),
            "fee_bps": str(fee_bps),
        },
    )
    cached = _read_cached_backtest(cache, cache_key)
    if cached is not None:
        return cached

    kline = await get_kline_local_first(
        client,
        symbol=symbol,
        period=period,
        adjustment=adjustment,
        limit=normalized_limit,
        end=(end_date or "2050-01-01").replace("-", ""),
        bypass_local=True,
    )
    kline = _check_coverage(kline, start_date, parameters, limit)
    response = build_ma_crossover_backtest(
        kline,
        fast_window=normalized_fast,
        slow_window=normalized_slow,
        initial_cash=initial_cash,
        fee_bps=fee_bps,
        start=start_date,
        end=end_date,
    )
    return cache_response(cache, cache_key, ttl_seconds, response, BacktestResponse)


async def get_strategy_backtest(
    client: HistoricalKlineProvider,
    cache: MarketDataCache,
    *,
    strategy_id: str,
    symbol: str,
    parameters: dict[str, str],
    period: KlinePeriod,
    adjustment: Adjustment,
    limit: int,
    end: str,
    initial_cash: Decimal,
    fee_bps: Decimal,
    ttl_seconds: int,
    start: str | None = None,
) -> BacktestResponse:
    strategy_id = canonical_strategy_id(strategy_id)
    parameters = normalize_strategy_parameters(strategy_id, parameters, fee_bps)
    normalized_limit, start_date, end_date = _history_request(
        limit=limit,
        start=start,
        end=end,
        period=period,
        parameters=parameters,
        initial_cash=initial_cash,
    )
    local = await get_local_kline_if_ready(
        symbol=symbol,
        period=period,
        adjustment=adjustment,
        limit=normalized_limit,
        end=(end_date or "2050-01-01").replace("-", ""),
    )
    if local is not None:
        local = _check_coverage(local, start_date, parameters, limit)
        return build_strategy_backtest(
            local,
            strategy_id=strategy_id,
            parameters=parameters,
            initial_cash=initial_cash,
            fee_bps=fee_bps,
            start=start_date,
            end=end_date,
        )
    cache_key = cache.build_key(
        "backtest-strategy",
        {
            "engine": current_engine_identity().model_dump(mode="json"),
            "strategy_id": strategy_id,
            "symbol": symbol,
            "parameters": parameters,
            "period": period,
            "adjustment": adjustment,
            "limit": normalized_limit,
            "end": end,
            "start": start_date,
            "initial_cash": str(initial_cash),
            "fee_bps": str(fee_bps),
        },
    )
    cached = _read_cached_backtest(cache, cache_key)
    if cached is not None:
        return cached

    kline = await get_kline_local_first(
        client,
        symbol=symbol,
        period=period,
        adjustment=adjustment,
        limit=normalized_limit,
        end=(end_date or "2050-01-01").replace("-", ""),
        bypass_local=True,
    )
    kline = _check_coverage(kline, start_date, parameters, limit)
    response = build_strategy_backtest(
        kline,
        strategy_id=strategy_id,
        parameters=parameters,
        initial_cash=initial_cash,
        fee_bps=fee_bps,
        start=start_date,
        end=end_date,
    )
    return cache_response(cache, cache_key, ttl_seconds, response, BacktestResponse)
