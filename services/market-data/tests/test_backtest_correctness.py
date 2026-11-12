from __future__ import annotations

import json
from datetime import date, timedelta
from decimal import Decimal
from math import sqrt

import pytest

from quantpilot_market_data.backtest import build_strategy_backtest
from quantpilot_market_data.contracts.quotes import KlineResponse
from quantpilot_market_data.replay_backtest import replay_backtest

PRICES = [10, 10, 10, 9, 8, 10, 12, 14, 12, 10, 8, 9, 11, 13, 10]


def series(period="daily", prices=None):
    step = {"daily": 1, "weekly": 7, "monthly": 30}.get(period, 1)
    return KlineResponse(
        symbol="510300",
        secid="1.510300",
        asset_type="etf",
        market="SH",
        source="fixture",
        period=period,
        adjustment="qfq",
        fetched_at="2026-01-01T00:00:00Z",
        bars=[
            {
                "date": (date(2025, 1, 1) + timedelta(days=i * step)).isoformat(),
                "open": price,
                "high": price,
                "low": price,
                "close": price,
            }
            for i, price in enumerate(prices or PRICES)
        ],
    )


def calculate(data=None, **kwargs):
    return build_strategy_backtest(
        data or series(),
        strategy_id="ma_crossover",
        parameters=kwargs.pop("parameters", {"fast_window": 2, "slow_window": 3}),
        initial_cash=1000,
        **kwargs,
    )


@pytest.mark.parametrize("fee", [0, 5, 100, 10000])
def test_net_returns_reconcile_every_equity_change_including_fees(fee):
    result = calculate(fee_bps=fee)
    previous = result.summary.initial_cash
    compounded = previous
    for point in result.equity_curve:
        if previous:
            expected = (point.equity / previous - 1) * 100
            assert abs(point.strategy_return_pct - expected) < Decimal("0.00006")
        compounded *= 1 + point.strategy_return_pct / 100
        previous = point.equity
    assert abs(compounded - result.summary.final_equity) < Decimal("0.01")
    for trade in result.trades:
        if trade.status == "closed":
            expected = (
                (trade.exit_price / trade.entry_price) * (1 - Decimal(fee) / 10000) ** 2 - 1
            ) * 100
            assert abs(trade.return_pct - expected) <= Decimal("0.00005")
            assert trade.gross_return_pct is not None


@pytest.mark.parametrize("period, annual_periods", [("weekly", 52), ("monthly", 12)])
def test_annualization_matches_the_input_frequency(period, annual_periods):
    daily = calculate(series(), fee_bps=0)
    result = calculate(series(period), fee_bps=0)
    expected = ((float(result.summary.final_equity / 1000) ** (annual_periods / 14)) - 1) * 100
    assert float(result.summary.annualized_return_pct) == pytest.approx(expected, abs=0.0001)
    assert float(result.summary.volatility_annualized_pct) == pytest.approx(
        float(daily.summary.volatility_annualized_pct) * sqrt(annual_periods / 252),
        abs=0.0002,
    )


@pytest.mark.parametrize(
    "parameters",
    [
        {"fast_window": "not-a-number"},
        {"fast_window": "NaN"},
        {"fast_window": "Infinity"},
        {"fast_window": 2.5},
        {"fast_window": True},
        {"fast_window": 0},
        {"slow_window": 251},
        {"fast_window": 20, "slow_window": 10},
        {"fast_widnow": 5},
        {"fee_bps": 99},
    ],
)
def test_invalid_or_unused_parameters_are_rejected(parameters):
    with pytest.raises(ValueError):
        calculate(parameters=parameters, fee_bps=5)


def test_effective_parameters_are_the_same_as_snapshot_and_replay():
    original = calculate(parameters={"fast_window": "2", "slow_window": "3"}, fee_bps=10)
    assert original.parameters == {"fast_window": 2, "slow_window": 3, "fee_bps": "10"}
    replay = replay_backtest(json.loads(original.model_dump_json()))
    assert replay.experiment == original.experiment


def test_warmup_does_not_create_positions_or_returns_before_evaluation():
    result = calculate(start="2025-01-08", end="20250110", fee_bps=100)
    assert [point.date for point in result.equity_curve] == [
        "2025-01-08",
        "2025-01-09",
        "2025-01-10",
    ]
    assert result.trades == []
    assert result.summary.final_equity == 1000
    assert result.summary.benchmark_return_pct == Decimal("-28.5714")
    assert result.experiment.evaluation_start == "2025-01-08"
    assert len(result.experiment.data.bars) == len(PRICES)
    replay = replay_backtest(json.loads(result.model_dump_json()))
    assert replay.equity_curve == result.equity_curve


@pytest.mark.parametrize(
    "start,end",
    [
        ("2025-02-30", None),
        ("2025-02-01", "2025-01-01"),
        ("2026-01-01", "2026-02-01"),
    ],
)
def test_invalid_or_empty_evaluation_intervals_fail(start, end):
    with pytest.raises(ValueError):
        calculate(start=start, end=end)


@pytest.mark.parametrize("kind", ["duplicate", "unordered", "missing", "nonpositive"])
def test_incomplete_or_ambiguous_market_series_is_rejected(kind):
    data = series()
    if kind == "duplicate":
        data.bars[1].date = data.bars[0].date
    elif kind == "unordered":
        data.bars.reverse()
    else:
        data.bars[5].close = None if kind == "missing" else Decimal("0")
    with pytest.raises(ValueError):
        calculate(data)


def test_intraday_backtesting_is_explicitly_rejected():
    with pytest.raises(ValueError, match="仅支持"):
        calculate(series("minute5"))


def test_compact_bar_dates_are_canonicalized_before_interval_filtering_and_replay():
    data = series()
    for bar in data.bars:
        bar.date = bar.date.replace('-', '')
    result = calculate(data, start='2025-01-08', end='2025-01-10')
    assert [point.date for point in result.equity_curve] == [
        '2025-01-08', '2025-01-09', '2025-01-10',
    ]
    assert result.experiment.data.bars[0].date == '2025-01-01'
    assert data.bars[0].date == '20250101'  # Do not mutate the provider response.
    assert replay_backtest(json.loads(result.model_dump_json())).summary == result.summary


@pytest.mark.parametrize('strategy,field', [
    ('donchian_breakout', 'high'), ('turtle_trend', 'low'),
    ('volume_price_breakout', 'volume'), ('atr_trailing_breakout', 'low'),
    ('gap_reversal', 'open'),
])
def test_missing_strategy_specific_inputs_are_rejected(strategy, field):
    data = series()
    setattr(data.bars[5], field, None)
    with pytest.raises(ValueError, match='字段缺失'):
        build_strategy_backtest(data, strategy_id=strategy)


@pytest.mark.parametrize('field,value', [('high', 1), ('low', 100), ('open', -1), ('volume', -1)])
def test_inconsistent_ohlc_or_negative_volume_is_rejected(field, value):
    data = series()
    setattr(data.bars[5], field, Decimal(value) if field != 'volume' else value)
    with pytest.raises(ValueError, match='回测行情'):
        calculate(data)


def test_empty_history_cannot_be_a_successful_zero_return_backtest():
    with pytest.raises(ValueError, match='不能为空'):
        calculate(series().model_copy(update={'bars': []}))
