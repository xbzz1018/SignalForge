"""Independently reconcile fills, balances and trade P&L without rerunning signals."""
from __future__ import annotations

from decimal import Decimal

from quantpilot_market_data.contracts.analysis import BacktestResponse
from quantpilot_market_data.contracts.quotes import KlineResponse


def _equal(actual: Decimal | None, expected: Decimal, label: str, *, rounded=False) -> None:
    tolerance = Decimal("0.000001") if rounded else Decimal("1e-18")
    tolerance = max(tolerance, abs(expected) * Decimal("1e-24"))
    if actual is None or not actual.is_finite() or abs(actual - expected) > tolerance:
        raise ValueError(f"Backtest accounting mismatch: {label}.")


def reconcile_backtest(result: BacktestResponse, data: KlineResponse | None = None) -> dict:
    if result.execution_timing != "next_open" or not result.equity_curve:
        raise ValueError("Backtest accounting requires a next-open execution ledger.")
    if (not result.summary.initial_cash.is_finite() or result.summary.initial_cash <= 0
            or not result.fee_bps.is_finite() or not 0 <= result.fee_bps <= 10000
            or not result.slippage_bps.is_finite() or not 0 <= result.slippage_bps < 10000):
        raise ValueError("Backtest accounting requires valid capital and execution costs.")
    cash, quantity = result.summary.initial_cash, Decimal("0")
    previous_equity = peak_equity = cash
    max_drawdown = Decimal("0")
    exposed_bars = 0
    fees = slippage = realized = entry_cost = Decimal("0")
    fills = iter(result.fills)
    fill = next(fills, None)
    prices = {bar.date: bar for bar in data.bars} if data is not None else {}
    trade_index = 0
    previous_date = None
    for point in result.equity_curve:
        held_before_open = quantity > 0
        if previous_date is not None and point.date <= previous_date:
            raise ValueError("Backtest accounting requires ordered dates.")
        if fill is not None and fill.date < point.date:
            raise ValueError("Backtest fill has no matching equity observation.")
        if fill is not None and fill.date == point.date:
            if fill.signal_date != previous_date or fill.quantity <= 0:
                raise ValueError("Backtest fill must follow the preceding observed close signal.")
            if point.date in prices:
                _equal(fill.reference_price, prices[point.date].open, "opening reference price")
            rate = result.slippage_bps / 10000
            _equal(fill.price, fill.reference_price * (
                1 + rate if fill.side == "buy" else 1 - rate
            ), "execution price")
            _equal(fill.notional, fill.quantity * fill.price, "fill notional")
            _equal(fill.fee, fill.notional * result.fee_bps / 10000, "fill fee")
            _equal(fill.slippage_cost, abs(fill.price - fill.reference_price) * fill.quantity,
                   "slippage cost")
            if trade_index >= len(result.trades):
                raise ValueError("Backtest fill has no matching trade.")
            trade = result.trades[trade_index]
            if fill.side == "buy":
                _equal(quantity, Decimal("0"), "flat before entry")
                entry_cost = fill.notional + fill.fee
                _equal(entry_cost, cash, "cash-funded entry")
                cash, quantity = Decimal("0"), fill.quantity
                if trade.entry_date != fill.date or trade.entry_signal_date != fill.signal_date:
                    raise ValueError("Backtest trade entry dates differ from fills.")
                _equal(trade.entry_price, fill.price, "trade entry price")
                _equal(trade.entry_fee, fill.fee, "trade entry fee")
                _equal(trade.quantity, quantity, "trade quantity")
            else:
                _equal(fill.quantity, quantity, "exit quantity")
                cash += fill.notional - fill.fee
                quantity = Decimal("0")
                pnl = fill.notional - fill.fee - entry_cost
                realized += pnl
                if (trade.status != "closed" or trade.exit_date != fill.date
                        or trade.exit_signal_date != fill.signal_date):
                    raise ValueError("Backtest trade exit differs from fills.")
                _equal(trade.exit_price, fill.price, "trade exit price")
                _equal(trade.exit_fee, fill.fee, "trade exit fee")
                _equal(trade.return_pct, pnl / entry_cost * 100, "net trade return")
                _equal(trade.gross_return_pct,
                       (fill.price / trade.entry_price - 1) * 100, "gross trade return")
                trade_index += 1
            fees += fill.fee
            slippage += fill.slippage_cost
            _equal(fill.cash_after, cash, "fill cash balance")
            _equal(fill.quantity_after, quantity, "fill quantity balance")
            fill = next(fills, None)
        if point.close is None:
            raise ValueError("Backtest accounting requires closing prices.")
        if data is not None:
            if point.date not in prices:
                raise ValueError("Backtest accounting is missing source prices.")
            _equal(point.close, prices[point.date].close, "closing price")
        equity = cash + quantity * point.close
        period_return = (equity / previous_equity - 1) * 100 if previous_equity else Decimal("0")
        peak_equity = max(peak_equity, equity)
        drawdown = (equity / peak_equity - 1) * 100
        max_drawdown = min(max_drawdown, drawdown)
        exposed_bars += int(held_before_open or quantity > 0)
        _equal(point.cash_balance, cash, "daily cash balance")
        _equal(point.quantity, quantity, "daily quantity balance")
        _equal(point.market_value, quantity * point.close, "daily market value")
        _equal(point.equity, cash + quantity * point.close, "daily equity", rounded=True)
        _equal(point.strategy_return_pct, period_return.quantize(Decimal("0.0001")),
               "period return")
        _equal(point.drawdown_pct, drawdown.quantize(Decimal("0.0001")), "drawdown")
        if point.position != int(quantity > 0):
            raise ValueError("Backtest position differs from its quantity.")
        previous_date = point.date
        previous_equity = equity
    if fill is not None:
        raise ValueError("Backtest has fills outside the evaluation interval.")
    if len(result.trades) != trade_index + int(quantity > 0):
        raise ValueError("Backtest trade count differs from fills.")
    if quantity > 0 and result.trades[-1].status != "open":
        raise ValueError("Backtest open position was reported as a closed trade.")
    market_value = quantity * result.equity_curve[-1].close
    unrealized = market_value - entry_cost if quantity > 0 else Decimal("0")
    summary = result.summary
    for label, actual, expected in [
        ("final cash", summary.cash_balance, cash),
        ("final market value", summary.market_value, market_value),
        ("fees", summary.total_fees, fees),
        ("slippage", summary.total_slippage, slippage),
        ("realized P&L", summary.realized_pnl, realized),
        ("unrealized P&L", summary.unrealized_pnl, unrealized),
    ]:
        _equal(actual, expected, label)
    _equal(summary.final_equity, cash + market_value, "final equity", rounded=True)
    _equal(summary.final_equity, summary.initial_cash + realized + unrealized,
           "P&L reconciliation", rounded=True)
    if summary.trade_count != trade_index:
        raise ValueError("Backtest closed-trade summary differs from fills.")
    if (summary.sample_count != len(result.equity_curve)
            or summary.start_date != result.equity_curve[0].date
            or summary.end_date != previous_date):
        raise ValueError("Backtest accounting summary interval differs from observations.")
    _equal(summary.total_return_pct,
           ((previous_equity / summary.initial_cash - 1) * 100).quantize(Decimal("0.0001")),
           "total return")
    _equal(summary.max_drawdown_pct, max_drawdown.quantize(Decimal("0.0001")), "max drawdown")
    _equal(summary.exposure_pct,
           (Decimal(exposed_bars) / len(result.equity_curve) * 100).quantize(Decimal("0.0001")),
           "exposure")
    if result.pending_signal is not None and result.pending_signal.date != previous_date:
        raise ValueError("Backtest pending signal is not the final observed signal.")
    if result.pending_signal is not None and (
        (result.pending_signal.side == "sell") != (quantity > 0)
    ):
        raise ValueError("Backtest pending signal conflicts with the final position.")
    return {"status": "verified", "fills": len(result.fills), "closed_trades": trade_index,
            "final_equity": str(summary.final_equity), "total_fees": str(fees),
            "total_slippage": str(slippage)}
