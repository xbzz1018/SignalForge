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


@pytest.mark.parametrize('local', [True, False])
@pytest.mark.parametrize('mutation', ['symbol', 'period', 'adjustment', 'end'])
def test_wrong_provider_identity_or_future_bars_are_rejected(local, mutation, monkeypatch):
    data = history()
    if mutation == 'end':
        data.bars[-1].date = '2025-02-01'
    else:
        replacements = {'symbol': 'other', 'period': 'weekly', 'adjustment': 'qfq'}
        setattr(data, mutation, replacements[mutation])

    async def read(**kwargs):
        return data if local else None

    async def fetch(*args, **kwargs):
        return data

    monkeypatch.setattr(backtests, 'get_local_kline_if_ready', read)
    monkeypatch.setattr(backtests, 'get_kline_local_first', fetch)
    with pytest.raises(ValueError, match='不一致|截止日期'):
        run_service()


def test_exchange_aliases_match_but_wrong_market_is_rejected():
    data = history().model_copy(update={'symbol': '510300', 'secid': '1.510300'})
    backtests._check_identity(data, '510300.SH', 'daily', 'none', None)
    data.secid = '0.510300'
    with pytest.raises(ValueError, match='不一致'):
        backtests._check_identity(data, '510300', 'daily', 'none', None)


def test_compact_dates_count_towards_pre_evaluation_warmup():
    data = history()
    for bar in data.bars:
        bar.date = bar.date.replace('-', '')
    assert backtests._check_coverage(data, '2025-01-25', {'slow_window': 20}, 21) is data
