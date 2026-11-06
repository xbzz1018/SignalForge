from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any


def int_param(
    parameters: dict[str, Any],
    key: str,
    default: int,
    *,
    minimum: int = 1,
    maximum: int = 300,
) -> int:
    try:
        parsed = Decimal(str(parameters.get(key, default)))
    except InvalidOperation as error:
        raise ValueError(f"{key} 必须为 {minimum} 到 {maximum} 之间的整数。") from error
    if (
        not parsed.is_finite()
        or parsed != parsed.to_integral_value()
        or not minimum <= parsed <= maximum
    ):
        raise ValueError(f"{key} 必须为 {minimum} 到 {maximum} 之间的整数。")
    value = int(parsed)
    parameters[key] = value
    return value


def decimal_param(
    parameters: dict[str, Any],
    key: str,
    default: Decimal | int | str,
    *,
    minimum: Decimal | int | str | None = None,
    maximum: Decimal | int | str | None = None,
) -> Decimal:
    try:
        value = Decimal(str(parameters.get(key, default)))
    except InvalidOperation as error:
        raise ValueError(f"{key} 必须为有限数值。") from error
    if not value.is_finite():
        raise ValueError(f"{key} 必须为有限数值。")
    if minimum is not None and value < Decimal(str(minimum)):
        raise ValueError(f"{key} 必须大于等于 {minimum}。")
    if maximum is not None and value > Decimal(str(maximum)):
        raise ValueError(f"{key} 必须小于等于 {maximum}。")
    parameters[key] = str(value)
    return value


# Validate before inspecting bars, including empty or short input snapshots.
# Each tuple is (default, minimum, maximum); aliases share the canonical schema.
INTEGER_PARAMETERS = {
    "ma_crossover": {"fast_window": (20, 2, 120), "slow_window": (60, 3, 250)},
    "donchian_breakout": {"breakout_window": (20, 5, 250), "exit_window": (10, 3, 120)},
    "turtle_trend": {"breakout_window": (55, 5, 250), "exit_window": (20, 3, 120)},
    "volume_price_breakout": {
        "breakout_window": (20, 5, 120), "exit_window": (10, 3, 80),
        "volume_window": (20, 5, 120),
    },
    "atr_trailing_breakout": {"breakout_window": (20, 5, 120), "atr_window": (14, 5, 60)},
    "rsi_reversion": {"rsi_window": (14, 3, 60), "trend_window": (60, 10, 250)},
    "bollinger_reversion": {"lookback_window": (20, 10, 120)},
    "momentum_trend": {"momentum_window": (60, 10, 250), "trend_window": (120, 20, 300)},
    "low_volatility_trend": {"trend_window": (60, 20, 250), "vol_window": (20, 10, 120)},
    "ma_pullback_reclaim": {"pullback_window": (20, 5, 80), "trend_window": (60, 20, 250)},
    "gap_reversal": {"max_holding_days": (5, 1, 30)},
}
DECIMAL_PARAMETERS = {
    "volume_price_breakout": {"volume_ratio": ("1.4", "1", "5")},
    "atr_trailing_breakout": {"atr_multiplier": ("2.5", "0.5", "8")},
    "rsi_reversion": {"entry_rsi": (35, 5, 60), "exit_rsi": (55, 40, 95)},
    "bollinger_reversion": {"entry_z": (2, "0.5", 4), "exit_z": (0, -1, 2)},
    "momentum_trend": {"min_momentum_pct": (8, -20, 80), "exit_momentum_pct": (0, -30, 30)},
    "low_volatility_trend": {
        "max_volatility_pct": (35, 5, 120), "exit_volatility_pct": ("43.75", 5, 150),
    },
    "ma_pullback_reclaim": {"stop_loss_pct": (8, 1, 30)},
    "gap_reversal": {"gap_down_pct": (3, "0.5", 12), "stop_loss_pct": (6, 1, 30)},
}


def validate_parameters(strategy_id: str, parameters: dict[str, Any]) -> None:
    integers = INTEGER_PARAMETERS[strategy_id]
    decimals = DECIMAL_PARAMETERS.get(strategy_id, {})
    unknown = parameters.keys() - (integers.keys() | decimals.keys() | {"fee_bps"})
    if unknown:
        raise ValueError(f"未知策略参数：{', '.join(sorted(unknown))}")
    for key, (default, minimum, maximum) in integers.items():
        int_param(parameters, key, default, minimum=minimum, maximum=maximum)
    for key, (default, minimum, maximum) in decimals.items():
        if strategy_id == "low_volatility_trend" and key == "exit_volatility_pct":
            default = Decimal(parameters["max_volatility_pct"]) * Decimal("1.25")
        decimal_param(parameters, key, default, minimum=minimum, maximum=maximum)
