from __future__ import annotations

from collections.abc import Mapping
from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from signalforge_market_data.backtest import build_strategy_backtest, canonical_strategy_id
from signalforge_market_data.backtest_experiments import current_engine_identity, verify_experiment
from signalforge_market_data.backtest_parameters import (
    backtest_date,
    finite_decimal,
    normalize_strategy_parameters,
    periods_per_year,
    strategy_warmup_bars,
)
from signalforge_market_data.cache import MarketDataCache
from signalforge_market_data.contracts.analysis import BacktestResponse
from signalforge_market_data.contracts.quotes import Adjustment, KlinePeriod, KlineResponse
from signalforge_market_data.providers.base import HistoricalKlineProvider
from signalforge_market_data.providers.eastmoney import normalize_secid
from signalforge_market_data.services.caching import cache_response, read_cached_response
from signalforge_market_data.services.kline_gateway import (
    get_kline_local_first,
    get_local_kline_if_ready,
)


MAX_HISTORY_BARS = 1500


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
    end: str | None,
    period: KlinePeriod,
    warmup: int,
    initial_cash: Decimal,
) -> tuple[int, str | None, str | None]:
    periods_per_year(period)
    cash = finite_decimal(initial_cash, "initial_cash")
    if cash <= 0:
        raise ValueError("initial_cash 必须为大于 0 的有限数值。")
    if not 1 <= limit <= MAX_HISTORY_BARS:
        raise ValueError(f"limit 必须在 1 到 {MAX_HISTORY_BARS} 之间。")
    start_date = backtest_date(start)
    end_date = None if end == "20500101" else backtest_date(end)
    if start_date is None:
        if limit <= warmup:
            raise ValueError("limit 不足以覆盖策略预热与至少一根评估行情。")
        return limit, start_date, end_date

    cutoff = date.fromisoformat(end_date) if end_date else datetime.now(ZoneInfo("Asia/Shanghai")).date()
    first = date.fromisoformat(start_date)
    if first > cutoff:
        raise ValueError("回测开始日期不能晚于结束日期。")
    days = (cutoff - first).days
    bars = days + 1 if period == "daily" else days // 7 + 2
    if period == "monthly":
        bars = (cutoff.year - first.year) * 12 + cutoff.month - first.month + 2
    # Calendar days are an upper estimate. Cap the fetch and validate the bars actually supplied.
    requested = min(MAX_HISTORY_BARS, max(limit, bars + warmup))
    return requested, start_date, end_date


def _check_coverage(
    kline: KlineResponse, start: str | None, warmup: int, limit: int,
) -> KlineResponse:
    if start:
        if sum(backtest_date(bar.date) < start for bar in kline.bars) < warmup:
            if len(kline.bars) >= MAX_HISTORY_BARS:
                raise ValueError(f"{MAX_HISTORY_BARS} 根行情无法覆盖指定区间及指标预热，请缩短区间。")
            raise ValueError("指定回测区间的指标预热行情不足，不能按默认样本替代。")
    else:
        if len(kline.bars) < limit:
            raise ValueError('回测行情不足请求的样本数量。')
        kline = kline.model_copy(update={'bars': kline.bars[-limit:]})
    return kline


def _check_identity(
    kline: KlineResponse, symbol: str, period: KlinePeriod, adjustment: Adjustment,
    end: str | None,
) -> None:
    try:
        requested = normalize_secid(symbol)
    except ValueError:
        matches = kline.symbol == symbol  # Non-exchange providers may use their own identifiers.
    else:
        matches = (
            kline.secid == requested
            and normalize_secid(kline.symbol).split('.')[1] == requested.split('.')[1]
        )
    if not matches or kline.period != period or kline.adjustment != adjustment:
        raise ValueError('回测行情的证券、周期或复权方式与请求不一致。')
    if end and any(backtest_date(bar.date) > end for bar in kline.bars):
        raise ValueError('回测行情包含截止日期之后的数据。')


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
    end: str | None,
    initial_cash: Decimal,
    fee_bps: Decimal,
    ttl_seconds: int,
    start: str | None = None,
    slippage_bps: Decimal = Decimal("0"),
) -> BacktestResponse:
    return await get_strategy_backtest(
        client,
        cache,
        strategy_id="ma_crossover",
        symbol=symbol,
        parameters={"fast_window": fast_window, "slow_window": slow_window},
        period=period,
        adjustment=adjustment,
        limit=limit,
        end=end,
        initial_cash=initial_cash,
        fee_bps=fee_bps,
        ttl_seconds=ttl_seconds,
        slippage_bps=slippage_bps,
        start=start,
    )


async def get_strategy_backtest(
    client: HistoricalKlineProvider,
    cache: MarketDataCache,
    *,
    strategy_id: str,
    symbol: str,
    parameters: Mapping[str, str | int],
    period: KlinePeriod,
    adjustment: Adjustment,
    limit: int,
    end: str | None,
    initial_cash: Decimal,
    fee_bps: Decimal,
    ttl_seconds: int,
    start: str | None = None,
    slippage_bps: Decimal = Decimal("0"),
) -> BacktestResponse:
    slippage_bps = _slippage(slippage_bps)
    strategy_id = canonical_strategy_id(strategy_id)
    normalized_parameters = normalize_strategy_parameters(strategy_id, dict(parameters), fee_bps)
    warmup = strategy_warmup_bars(strategy_id, normalized_parameters)
    normalized_limit, start_date, end_date = _history_request(
        limit=limit,
        start=start,
        end=end,
        period=period,
        warmup=warmup,
        initial_cash=initial_cash,
    )
    history_end = end_date.replace("-", "") if end_date else None

    def compute(kline: KlineResponse) -> BacktestResponse:
        _check_identity(kline, symbol, period, adjustment, end_date)
        return build_strategy_backtest(
            _check_coverage(kline, start_date, warmup, limit),
            strategy_id=strategy_id,
            parameters=normalized_parameters,
            initial_cash=initial_cash,
            fee_bps=fee_bps,
            slippage_bps=slippage_bps,
            start=start_date,
            end=end_date,
        )

    local = await get_local_kline_if_ready(
        symbol=symbol,
        period=period,
        adjustment=adjustment,
        limit=normalized_limit,
        end=history_end,
    )
    if local is not None:
        return compute(local)

    cache_key = cache.build_key(
        "backtest-strategy",
        {
            "history_contract": 4,
            "engine": current_engine_identity().model_dump(mode="json"),
            "strategy_id": strategy_id,
            "symbol": symbol,
            "parameters": normalized_parameters,
            "period": period,
            "adjustment": adjustment,
            "limit": normalized_limit,
            "end": end_date,
            "start": start_date,
            "initial_cash": str(initial_cash),
            "fee_bps": str(fee_bps),
            "slippage_bps": str(slippage_bps),
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
        end=history_end,
        bypass_local=True,
    )
    return cache_response(cache, cache_key, ttl_seconds, compute(kline), BacktestResponse)


def _slippage(value: Decimal) -> Decimal:
    value = finite_decimal(value, "slippage_bps")
    if not 0 <= value < 10000:
        raise ValueError("slippage_bps 必须为 0 到小于 10000 的有限数值。")
    return value
