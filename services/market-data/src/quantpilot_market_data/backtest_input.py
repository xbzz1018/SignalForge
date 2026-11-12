"""Reject missing strategy inputs instead of reporting a successful inactive strategy."""
from __future__ import annotations

from quantpilot_market_data.contracts.quotes import KlineResponse


def validate_strategy_bars(data: KlineResponse, strategy_id: str) -> None:
    if not data.bars:
        raise ValueError('回测行情不能为空。')
    required = {'close'}
    if strategy_id in {
        'donchian_breakout', 'turtle_trend', 'volume_price_breakout', 'atr_trailing_breakout',
    }:
        required.update({'high', 'low'})
    if strategy_id == 'volume_price_breakout':
        required.add('volume')
    if strategy_id == 'gap_reversal':
        required.add('open')
    for bar in data.bars:
        if any(getattr(bar, field) is None for field in required):
            raise ValueError(f'策略 {strategy_id} 所需行情字段缺失。')
        for field in ('open', 'high', 'low', 'close'):
            value = getattr(bar, field)
            if value is not None and (not value.is_finite() or value <= 0):
                raise ValueError('回测行情价格必须为有限正数。')
        if bar.volume is not None and bar.volume < 0:
            raise ValueError('回测行情成交量不能为负数。')
        prices = [value for value in (bar.open, bar.close, bar.high, bar.low) if value is not None]
        if (bar.high is not None and bar.high < max(prices)) or (
            bar.low is not None and bar.low > min(prices)
        ):
            raise ValueError('回测行情 OHLC 高低价关系无效。')
