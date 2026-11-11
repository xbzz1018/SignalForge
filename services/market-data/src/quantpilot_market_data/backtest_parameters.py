"""Validate effective strategy inputs once, before fetching or calculating data."""

from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

# (default, minimum, maximum); integer defaults identify integer parameters.
STRATEGY_PARAMETERS: dict[str, dict[str, tuple[int | str, int | str, int | str]]] = {
    "ma_crossover": {"fast_window": (20, 2, 120), "slow_window": (60, 3, 250)},
    "donchian_breakout": {"breakout_window": (20, 5, 250), "exit_window": (10, 3, 120)},
    "turtle_trend": {"breakout_window": (55, 5, 250), "exit_window": (20, 3, 120)},
    "volume_price_breakout": {
        "breakout_window": (20, 5, 120),
        "exit_window": (10, 3, 80),
        "volume_window": (20, 5, 120),
        "volume_ratio": ("1.4", "1", "5"),
    },
    "atr_trailing_breakout": {
        "breakout_window": (20, 5, 120),
        "atr_window": (14, 5, 60),
        "atr_multiplier": ("2.5", "0.5", "8"),
    },
    "rsi_reversion": {
        "rsi_window": (14, 3, 60),
        "trend_window": (60, 10, 250),
        "entry_rsi": ("35", "5", "60"),
        "exit_rsi": ("55", "40", "95"),
    },
    "bollinger_reversion": {
        "lookback_window": (20, 10, 120),
        "entry_z": ("2", "0.5", "4"),
        "exit_z": ("0", "-1", "2"),
    },
    "momentum_trend": {
        "momentum_window": (60, 10, 250),
        "trend_window": (120, 20, 300),
        "min_momentum_pct": ("8", "-20", "80"),
        "exit_momentum_pct": ("0", "-30", "30"),
    },
    "low_volatility_trend": {
        "trend_window": (60, 20, 250),
        "vol_window": (20, 10, 120),
        "max_volatility_pct": ("35", "5", "120"),
        "exit_volatility_pct": ("43.75", "5", "150"),
    },
    "ma_pullback_reclaim": {
        "pullback_window": (20, 5, 80),
        "trend_window": (60, 20, 250),
        "stop_loss_pct": ("8", "1", "30"),
    },
    "gap_reversal": {
        "gap_down_pct": ("3", "0.5", "12"),
        "max_holding_days": (5, 1, 30),
        "stop_loss_pct": ("6", "1", "30"),
    },
}

PERIODS_PER_YEAR = {"daily": 252, "weekly": 52, "monthly": 12}


def finite_decimal(value: Any, name: str) -> Decimal:
    try:
        if isinstance(value, bool):
            raise ValueError
        result = Decimal(str(value))
        if not result.is_finite():
            raise ValueError
        return result
    except (InvalidOperation, ValueError, TypeError) as error:
        raise ValueError(f"{name} 必须为有限数值。") from error


def normalize_strategy_parameters(
    strategy_id: str,
    parameters: dict[str, Any] | None,
    fee_bps: Any,
) -> dict[str, Any]:
    schema = STRATEGY_PARAMETERS.get(strategy_id)
    if schema is None:
        raise ValueError(f"暂不支持的策略：{strategy_id}")
    supplied = dict(parameters or {})
    unknown = set(supplied) - set(schema) - {"fee_bps"}
    if unknown:
        raise ValueError(f"未知策略参数：{', '.join(sorted(unknown))}")
    fee = finite_decimal(fee_bps, "fee_bps")
    if not 0 <= fee <= 10000:
        raise ValueError("fee_bps 必须为 0 到 10000 之间的有限数值。")
    if "fee_bps" in supplied and finite_decimal(supplied["fee_bps"], "fee_bps") != fee:
        raise ValueError("parameters.fee_bps 与 fee_bps 不一致。")
    effective: dict[str, Any] = {}
    for key, (default, minimum, maximum) in schema.items():
        if strategy_id == "low_volatility_trend" and key == "exit_volatility_pct":
            default = str(Decimal(effective["max_volatility_pct"]) * Decimal("1.25"))
        value = finite_decimal(supplied.get(key, default), key)
        if not Decimal(str(minimum)) <= value <= Decimal(str(maximum)):
            raise ValueError(f"{key} 必须在 {minimum} 到 {maximum} 之间。")
        if isinstance(default, int):
            if value != value.to_integral_value():
                raise ValueError(f"{key} 必须为整数。")
            effective[key] = int(value)
        else:
            effective[key] = str(value.normalize())
    if strategy_id == "ma_crossover" and effective["fast_window"] >= effective["slow_window"]:
        raise ValueError("fast_window 必须小于 slow_window。")
    if strategy_id == "rsi_reversion" and Decimal(effective["entry_rsi"]) >= Decimal(
        effective["exit_rsi"]
    ):
        raise ValueError("entry_rsi 必须小于 exit_rsi。")
    effective["fee_bps"] = str(fee)
    return effective


def backtest_date(value: str | None) -> str | None:
    if value is None:
        return None
    try:
        if len(value) == 8 and value.isascii() and value.isdigit():
            value = f"{value[:4]}-{value[4:6]}-{value[6:]}"
        parsed = date.fromisoformat(value)
        if parsed.isoformat() != value:
            raise ValueError
        return value
    except (ValueError, TypeError) as error:
        raise ValueError("回测日期必须为有效的 YYYY-MM-DD 或 YYYYMMDD。") from error


def periods_per_year(period: str) -> int:
    if period not in PERIODS_PER_YEAR:
        raise ValueError("回测仅支持 daily、weekly、monthly 周期。")
    return PERIODS_PER_YEAR[period]


def int_param(
    parameters: dict[str, Any],
    key: str,
    default: int,
    *,
    minimum: int = 1,
    maximum: int = 300,
) -> int:
    value = finite_decimal(parameters.get(key, default), key)
    if value != value.to_integral_value() or not minimum <= value <= maximum:
        raise ValueError(f"{key} 必须为 {minimum} 到 {maximum} 之间的整数。")
    return int(value)


def decimal_param(
    parameters: dict[str, Any],
    key: str,
    default: Decimal | int | str,
    *,
    minimum: Decimal | int | str | None = None,
    maximum: Decimal | int | str | None = None,
) -> Decimal:
    value = finite_decimal(parameters.get(key, default), key)
    if minimum is not None and value < Decimal(str(minimum)):
        raise ValueError(f"{key} 小于最小值 {minimum}。")
    if maximum is not None and value > Decimal(str(maximum)):
        raise ValueError(f"{key} 大于最大值 {maximum}。")
    return value
