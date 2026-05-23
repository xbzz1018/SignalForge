from __future__ import annotations

from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from math import sqrt

from quantpilot_market_data.models import (
    BacktestEquityPoint,
    BacktestResponse,
    BacktestSummary,
    BacktestTrade,
    KlineResponse,
)


def _round(value: Decimal | None, places: int = 4) -> Decimal | None:
    if value is None:
        return None
    quant = Decimal("1").scaleb(-places)
    return value.quantize(quant, rounding=ROUND_HALF_UP)


def _mean(values: list[Decimal]) -> Decimal | None:
    if not values:
        return None
    return sum(values, Decimal("0")) / Decimal(len(values))


def _rolling_mean(closes: list[Decimal | None], end_index: int, window: int) -> Decimal | None:
    if end_index + 1 < window:
        return None
    values = closes[end_index + 1 - window : end_index + 1]
    if any(value is None for value in values):
        return None
    return _mean([value for value in values if value is not None])


def _return_pct(current: Decimal | None, previous: Decimal | None) -> Decimal | None:
    if current is None or previous is None or previous == 0:
        return None
    return ((current - previous) / previous) * Decimal("100")


def _annualized_return_pct(final_equity: Decimal, sample_count: int) -> Decimal | None:
    if sample_count <= 1 or final_equity <= 0:
        return None
    value = (float(final_equity) ** (252 / (sample_count - 1)) - 1) * 100
    return Decimal(str(value))


def _annualized_volatility_pct(returns: list[Decimal]) -> Decimal | None:
    if len(returns) < 2:
        return None
    mean_return = _mean(returns)
    if mean_return is None:
        return None
    variance = sum((value - mean_return) ** 2 for value in returns) / Decimal(len(returns))
    return Decimal(str(sqrt(float(variance)))) * Decimal(str(sqrt(252)))


def _safe_decimal(value: int | float | Decimal | str) -> Decimal:
    return value if isinstance(value, Decimal) else Decimal(str(value))


def build_ma_crossover_backtest(
    kline: KlineResponse,
    *,
    fast_window: int = 20,
    slow_window: int = 60,
    initial_cash: Decimal | int | float | str = Decimal("1"),
    fee_bps: Decimal | int | float | str = Decimal("5"),
) -> BacktestResponse:
    if fast_window <= 0 or slow_window <= 0:
        raise ValueError("fast_window 和 slow_window 必须大于 0。")
    if fast_window >= slow_window:
        raise ValueError("fast_window 必须小于 slow_window。")

    cash = _safe_decimal(initial_cash)
    if cash <= 0:
        raise ValueError("initial_cash 必须大于 0。")

    fee_rate = _safe_decimal(fee_bps) / Decimal("10000")
    closes = [bar.close for bar in kline.bars]
    equity = cash
    peak_equity = cash
    position = 0
    trades: list[BacktestTrade] = []
    current_trade: BacktestTrade | None = None
    equity_curve: list[BacktestEquityPoint] = []
    strategy_returns: list[Decimal] = []
    position_days = 0

    for index, bar in enumerate(kline.bars):
        close = bar.close
        previous_close = closes[index - 1] if index > 0 else None
        fast_ma = _rolling_mean(closes, index, fast_window)
        slow_ma = _rolling_mean(closes, index, slow_window)
        previous_fast_ma = _rolling_mean(closes, index - 1, fast_window) if index > 0 else None
        previous_slow_ma = _rolling_mean(closes, index - 1, slow_window) if index > 0 else None

        benchmark_return = _return_pct(close, previous_close)
        strategy_return = Decimal("0")
        if position == 1 and benchmark_return is not None:
            strategy_return = benchmark_return / Decimal("100")
            equity *= Decimal("1") + strategy_return
            position_days += 1

        cross_up = (
            close is not None
            and previous_fast_ma is not None
            and previous_slow_ma is not None
            and fast_ma is not None
            and slow_ma is not None
            and previous_fast_ma <= previous_slow_ma
            and fast_ma > slow_ma
        )
        cross_down = (
            close is not None
            and previous_fast_ma is not None
            and previous_slow_ma is not None
            and fast_ma is not None
            and slow_ma is not None
            and previous_fast_ma >= previous_slow_ma
            and fast_ma < slow_ma
        )

        if position == 0 and cross_up and close is not None:
            equity *= Decimal("1") - fee_rate
            position = 1
            current_trade = BacktestTrade(entry_date=bar.date, entry_price=close, holding_days=0)
            trades.append(current_trade)
        elif position == 1 and cross_down and close is not None:
            equity *= Decimal("1") - fee_rate
            position = 0
            if current_trade is not None:
                current_trade.exit_date = bar.date
                current_trade.exit_price = close
                current_trade.holding_days = max(
                    0,
                    index - _trade_entry_index(kline, current_trade.entry_date),
                )
                current_trade.return_pct = _round(_return_pct(close, current_trade.entry_price), 4)
                current_trade.status = "closed"
                current_trade = None

        peak_equity = max(peak_equity, equity)
        drawdown_pct = (
            ((equity - peak_equity) / peak_equity) * Decimal("100") if peak_equity else None
        )
        strategy_return_pct = strategy_return * Decimal("100")
        if index > 0:
            strategy_returns.append(strategy_return_pct)

        equity_curve.append(
            BacktestEquityPoint(
                date=bar.date,
                close=close,
                fast_ma=_round(fast_ma, 4),
                slow_ma=_round(slow_ma, 4),
                position=position,
                daily_return_pct=_round(benchmark_return, 4),
                strategy_return_pct=_round(strategy_return_pct, 4),
                equity=_round(equity, 6) or equity,
                drawdown_pct=_round(drawdown_pct, 4),
            )
        )

    closed_trades = [trade for trade in trades if trade.status == "closed"]
    winning_trades = [
        trade for trade in closed_trades if trade.return_pct is not None and trade.return_pct > 0
    ]
    first_close = next((close for close in closes if close is not None), None)
    latest_close = next((close for close in reversed(closes) if close is not None), None)
    total_return = _return_pct(equity, cash)
    benchmark_return = _return_pct(latest_close, first_close)
    max_drawdown = min(
        [point.drawdown_pct for point in equity_curve if point.drawdown_pct is not None],
        default=None,
    )
    volatility = _annualized_volatility_pct(strategy_returns)
    annualized_return = _annualized_return_pct(equity / cash, len(equity_curve))

    sharpe = None
    if annualized_return is not None and volatility is not None and volatility != 0:
        sharpe = annualized_return / volatility

    summary = BacktestSummary(
        start_date=equity_curve[0].date if equity_curve else None,
        end_date=equity_curve[-1].date if equity_curve else None,
        sample_count=len(equity_curve),
        initial_cash=_round(cash, 6) or cash,
        final_equity=_round(equity, 6) or equity,
        total_return_pct=_round(total_return, 4),
        benchmark_return_pct=_round(benchmark_return, 4),
        excess_return_pct=_round(
            total_return - benchmark_return
            if total_return is not None and benchmark_return is not None
            else None,
            4,
        ),
        max_drawdown_pct=_round(max_drawdown, 4),
        annualized_return_pct=_round(annualized_return, 4),
        volatility_annualized_pct=_round(volatility, 4),
        sharpe=_round(sharpe, 4),
        trade_count=len(closed_trades),
        win_rate_pct=_round(
            (Decimal(len(winning_trades)) / Decimal(len(closed_trades))) * Decimal("100")
            if closed_trades
            else None,
            4,
        ),
        exposure_pct=_round(
            (Decimal(position_days) / Decimal(len(equity_curve))) * Decimal("100")
            if equity_curve
            else None,
            4,
        ),
    )

    return BacktestResponse(
        symbol=kline.symbol,
        name=kline.name,
        secid=kline.secid,
        asset_type=kline.asset_type,
        market=kline.market,
        source=kline.source,
        fast_window=fast_window,
        slow_window=slow_window,
        fee_bps=_round(fee_rate * Decimal("10000"), 4) or fee_rate * Decimal("10000"),
        period=kline.period,
        adjustment=kline.adjustment,
        equity_curve=equity_curve,
        trades=trades,
        summary=summary,
        as_of=kline.as_of,
        fetched_at=datetime.now(UTC),
    )


def _trade_entry_index(kline: KlineResponse, entry_date: str) -> int:
    for index, bar in enumerate(kline.bars):
        if bar.date == entry_date:
            return index
    return 0
