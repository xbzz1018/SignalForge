from __future__ import annotations

from decimal import Decimal

import pytest

from quantpilot_market_data.backtest import STRATEGY_NAMES, build_strategy_backtest
from quantpilot_market_data.contracts.quotes import KlineBar, KlineResponse


def sample_kline() -> KlineResponse:
    bars: list[KlineBar] = []
    close = Decimal("20")
    for day in range(1, 180):
        if day % 37 == 0:
            close *= Decimal("0.92")
        elif day % 19 == 0:
            close *= Decimal("1.06")
        else:
            close *= Decimal("1.003")
        open_price = close * (Decimal("0.99") if day % 11 == 0 else Decimal("1.001"))
        high = max(open_price, close) * Decimal("1.015")
        low = min(open_price, close) * Decimal("0.985")
        bars.append(
            KlineBar(
                date=f"2025-{((day - 1) // 28) + 1:02d}-{((day - 1) % 28) + 1:02d}",
                open=open_price,
                high=high,
                low=low,
                close=close,
                volume=1_000_000 + day * 4_000 + (600_000 if day % 19 == 0 else 0),
                amount=close * Decimal("1000000"),
            )
        )
    return KlineResponse(
        symbol="002156",
        name="通富微电",
        secid="0.002156",
        asset_type="stock",
        market="SZ",
        source="fixture",
        period="daily",
        adjustment="qfq",
        bars=bars,
        fetched_at="2026-05-29T00:00:00Z",
    )


@pytest.mark.parametrize(
    ("strategy_id", "parameters"),
    [
        ("ma_crossover", {"fast_window": 10, "slow_window": 30}),
        ("donchian_breakout", {"breakout_window": 20, "exit_window": 10}),
        ("turtle_trend", {"breakout_window": 40, "exit_window": 20}),
        ("volume_price_breakout", {"breakout_window": 15, "exit_window": 8, "volume_ratio": 1.1}),
        ("atr_trailing_breakout", {"breakout_window": 20, "atr_window": 14, "atr_multiplier": 2}),
        ("rsi_reversion", {"rsi_window": 14, "entry_rsi": 40, "exit_rsi": 55}),
        ("bollinger_reversion", {"lookback_window": 20, "entry_z": 1.5, "exit_z": 0}),
        ("momentum_trend", {"momentum_window": 40, "trend_window": 80, "min_momentum_pct": 3}),
        ("low_volatility_trend", {"trend_window": 50, "vol_window": 20, "max_volatility_pct": 45}),
        ("ma_pullback_reclaim", {"pullback_window": 20, "trend_window": 60, "stop_loss_pct": 8}),
        ("gap_reversal", {"gap_down_pct": 1, "max_holding_days": 5, "stop_loss_pct": 6}),
    ],
)
def test_supported_strategy_backtests_return_summary(
    strategy_id: str,
    parameters: dict[str, int | float],
) -> None:
    result = build_strategy_backtest(
        sample_kline(),
        strategy_id=strategy_id,
        parameters=parameters,
        fee_bps=5,
    )

    assert result.strategy_id == strategy_id
    assert result.summary.sample_count == len(result.equity_curve)
    assert result.summary.initial_cash == Decimal("1.000000")
    assert result.summary.final_equity > 0
    assert result.parameters


def test_unknown_strategy_is_rejected() -> None:
    with pytest.raises(ValueError, match="暂不支持"):
        build_strategy_backtest(sample_kline(), strategy_id="unknown_strategy")


@pytest.mark.parametrize("value", ["invalid", "NaN", "Infinity", "10.5", True, 1, 121])
def test_invalid_integer_parameters_are_rejected(value) -> None:
    with pytest.raises(ValueError, match="fast_window"):
        build_strategy_backtest(
            sample_kline(), strategy_id="ma", parameters={"fast_window": value}
        )


@pytest.mark.parametrize("value", ["invalid", "NaN", "Infinity", True, -1, 10])
def test_invalid_decimal_parameters_are_rejected(value) -> None:
    with pytest.raises(ValueError, match="entry_z"):
        build_strategy_backtest(
            sample_kline(), strategy_id="bollinger", parameters={"entry_z": value}
        )


def test_experiment_records_effective_defaults_and_numeric_parameters() -> None:
    result = build_strategy_backtest(
        sample_kline(), strategy_id="ma", parameters={"fast_window": "10.0"}
    )
    assert result.parameters["fast_window"] == 10
    assert result.parameters["slow_window"] == 60
    assert result.experiment.parameters == result.parameters


@pytest.mark.parametrize("strategy_id", list(STRATEGY_NAMES))
def test_unknown_parameters_are_rejected_even_without_bars(strategy_id) -> None:
    with pytest.raises(ValueError, match="未知策略参数.*typo_window"):
        build_strategy_backtest(
            sample_kline().model_copy(update={"bars": []}), strategy_id=strategy_id,
            parameters={"typo_window": 20},
        )


def test_decimal_parameters_are_validated_before_iterating_bars() -> None:
    with pytest.raises(ValueError, match="entry_z"):
        build_strategy_backtest(
            sample_kline().model_copy(update={"bars": []}), strategy_id="bollinger",
            parameters={"entry_z": "NaN"},
        )


def fee_kline() -> KlineResponse:
    return sample_kline().model_copy(update={"bars": [
        KlineBar(date=f"2026-01-{index + 1:02d}", close=Decimal(close))
        for index, close in enumerate([10, 10, 10, 11, 12, 9, 8])
    ]})


def test_period_returns_reconcile_with_equity_after_fees() -> None:
    result = build_strategy_backtest(
        fee_kline(), strategy_id="ma", parameters={"fast_window": 2, "slow_window": 3},
        fee_bps=50,
    )
    previous = result.summary.initial_cash
    assert result.trades
    for point in result.equity_curve:
        expected = (point.equity / previous - 1) * 100
        assert abs(point.strategy_return_pct - expected) < Decimal("0.0002")
        previous = point.equity


def test_closed_trade_return_includes_entry_and_exit_fees() -> None:
    result = build_strategy_backtest(
        fee_kline(), strategy_id="ma", parameters={"fast_window": 2, "slow_window": 3},
        fee_bps=50,
    )
    closed = [trade for trade in result.trades if trade.status == "closed"]
    assert closed
    for trade in closed:
        expected = (trade.exit_price / trade.entry_price * Decimal("0.995") ** 2 - 1) * 100
        assert abs(trade.return_pct - expected) < Decimal("0.0001")
