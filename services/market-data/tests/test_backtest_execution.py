from __future__ import annotations

import json
from decimal import Decimal

import pytest

from quantpilot_market_data.backtest import build_ma_crossover_backtest
from quantpilot_market_data.backtest_accounting import reconcile_backtest
from quantpilot_market_data.contracts.quotes import KlineResponse
from quantpilot_market_data.replay_backtest import replay_backtest


def history(closes=None, opens=None):
    closes = closes or [10, 10, 10, 11, 12, 9, 8, 9, 11, 13]
    opens = opens or closes
    return KlineResponse(
        symbol="fixture", secid="fixture:1", source="fixture", period="daily",
        adjustment="none", fetched_at="2026-01-01T00:00:00Z",
        bars=[{"date": f"2025-01-{i + 1:02d}", "open": open_, "close": close}
              for i, (open_, close) in enumerate(zip(opens, closes, strict=True))],
    )


def calculate(data=None, **kwargs):
    return build_ma_crossover_backtest(
        data or history(), fast_window=2, slow_window=3, initial_cash=10000, **kwargs,
    )


def test_gaps_fill_at_next_open_and_do_not_earn_the_gap_before_entry():
    data = history([10, 10, 10, 11, 20, 1, 8], [10, 10, 10, 11, 22, 18, 7])
    result = calculate(data, fee_bps=0)
    trade = result.trades[0]
    assert (trade.entry_signal_date, trade.entry_date, trade.entry_price) == (
        "2025-01-04", "2025-01-05", 22,
    )
    assert result.equity_curve[3].equity == 10000
    assert result.equity_curve[4].equity == Decimal("9090.909091")
    # The sell signal sees Jan 6's close; it cannot fill at Jan 6's open or close.
    assert (trade.exit_signal_date, trade.exit_date, trade.exit_price) == (
        "2025-01-06", "2025-01-07", 7,
    )
    assert result.summary.final_equity == Decimal("3181.818182")
    assert reconcile_backtest(result, data)["status"] == "verified"


def test_cash_funded_fees_and_adverse_slippage_reconcile_from_fill_notional():
    result = calculate(fee_bps=10, slippage_bps=20)
    buy, sell = result.fills[:2]
    assert buy.price == buy.reference_price * Decimal("1.002")
    assert sell.price == sell.reference_price * Decimal("0.998")
    assert abs(buy.notional + buy.fee - 10000) < Decimal("1e-20")
    assert buy.fee == buy.notional / 1000
    assert sell.fee == sell.notional / 1000
    assert all(point.cash_balance >= 0 and point.quantity >= 0 for point in result.equity_curve)
    assert result.summary.total_fees == sum(fill.fee for fill in result.fills)
    assert result.summary.total_slippage > 0
    assert result.experiment.engine.version == "single-asset-next-open-v3"
    assert result.experiment.slippage_bps == 20
    assert replay_backtest(json.loads(result.model_dump_json())).fills == result.fills


def test_final_buy_signal_remains_pending_without_a_phantom_fill():
    result = calculate(history([10, 10, 10, 11]), fee_bps=10, slippage_bps=20)
    assert result.fills == [] and result.trades == []
    assert result.pending_signal.model_dump() == {"date": "2025-01-04", "side": "buy"}
    assert result.summary.final_equity == 10000
    assert result.summary.total_fees == 0


def test_final_sell_signal_keeps_the_open_position_and_unrealized_pnl():
    result = calculate(history([10, 10, 10, 11, 12, 9]), fee_bps=10)
    assert result.trades[0].status == "open"
    assert result.trades[0].exit_date is None
    assert result.pending_signal.side == "sell"
    assert result.summary.trade_count == 0
    assert result.summary.unrealized_pnl < 0
    assert result.summary.realized_pnl == 0
    assert reconcile_backtest(result)["closed_trades"] == 0


@pytest.mark.parametrize("value", [-1, 10000, "NaN", "Infinity", True])
def test_invalid_slippage_is_rejected(value):
    with pytest.raises(ValueError, match="slippage_bps"):
        calculate(slippage_bps=value)


def test_next_open_execution_requires_open_prices():
    data = history()
    data.bars[4].open = None
    with pytest.raises(ValueError, match="字段缺失"):
        calculate(data)


@pytest.mark.parametrize("mutation", [
    "fee", "quantity", "balance", "summary", "trade", "date", "return", "drawdown", "total_return",
])
def test_independent_accounting_rejects_internally_inconsistent_artifacts(mutation):
    result = calculate(fee_bps=10, slippage_bps=20)
    if mutation == "fee":
        result.fills[0].fee += 1
    elif mutation == "quantity":
        result.equity_curve[4].quantity += 1
    elif mutation == "balance":
        result.equity_curve[4].cash_balance += 1
    elif mutation == "summary":
        result.summary.realized_pnl += 1
    elif mutation == "trade":
        result.trades[0].return_pct += 1
    elif mutation == "return":
        result.equity_curve[4].strategy_return_pct += 1
    elif mutation == "drawdown":
        result.equity_curve[4].drawdown_pct += 1
    elif mutation == "total_return":
        result.summary.total_return_pct += 1
    else:
        result.fills[0].signal_date = result.fills[0].date
    with pytest.raises(ValueError, match="[Aa]ccounting|Backtest"):
        reconcile_backtest(result)
