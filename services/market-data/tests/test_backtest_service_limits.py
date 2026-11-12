import asyncio
from decimal import Decimal

import pytest

from quantpilot_market_data.cache import MarketDataCache
from quantpilot_market_data.contracts.quotes import KlineResponse
from quantpilot_market_data.services import backtests


def history(count=30):
    return KlineResponse(
        symbol='fixture', secid='fixture:1', period='daily', adjustment='none',
        fetched_at='2026-01-01T00:00:00Z',
        bars=[{'date': f'2025-01-{i + 1:02d}', 'close': i + 10} for i in range(count)],
    )


def run_service():
    return asyncio.run(backtests.get_ma_crossover_backtest(
        object(), MarketDataCache(enabled=False), symbol='fixture', fast_window=5,
        slow_window=20, period='daily', adjustment='none', limit=21, end='20250131',
        initial_cash=Decimal(1), fee_bps=Decimal(5), ttl_seconds=300,
    ))


@pytest.mark.parametrize('local', [True, False])
def test_exact_requested_sample_is_not_inflated_by_warmup(local, monkeypatch):
    requests = []

    async def read(**kwargs):
        requests.append(kwargs['limit'])
        return history() if local else None

    async def fetch(*args, **kwargs):
        requests.append(kwargs['limit'])
        return history()

    monkeypatch.setattr(backtests, 'get_local_kline_if_ready', read)
    monkeypatch.setattr(backtests, 'get_kline_local_first', fetch)
    result = run_service()
    assert requests == ([21] if local else [21, 21])
    assert result.summary.sample_count == 21
    assert result.summary.start_date == '2025-01-10'


def test_insufficient_samples_do_not_produce_a_successful_shorter_backtest(monkeypatch):
    async def read(**kwargs):
        return history(20)

    monkeypatch.setattr(backtests, 'get_local_kline_if_ready', read)
    with pytest.raises(ValueError, match='样本数量'):
        run_service()
