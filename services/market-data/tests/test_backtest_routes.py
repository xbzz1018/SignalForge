from __future__ import annotations

import asyncio
import json
from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from quantpilot_market_data import backtest_experiments
from quantpilot_market_data.cache import MarketDataCache
from quantpilot_market_data.contracts.quotes import KlineResponse
from quantpilot_market_data.replay_backtest import replay_backtest
from quantpilot_market_data.routers.backtests import create_backtest_router
from quantpilot_market_data.services import backtests


@pytest.mark.parametrize(("fast", "slow"), [(1, 60), (121, 250), (20, 2), (20, 251), (20, 20)])
def test_ma_service_rejects_invalid_windows_before_fetch(fast, slow, monkeypatch):
    async def must_not_fetch(*args, **kwargs):
        raise AssertionError("invalid parameters must be rejected before reading market data")

    monkeypatch.setattr(backtests, "get_local_kline_if_ready", must_not_fetch)
    with pytest.raises(ValueError, match="window"):
        asyncio.run(backtests.get_ma_crossover_backtest(
            object(), MarketDataCache(enabled=False), symbol="fixture",
            fast_window=fast, slow_window=slow, period="daily", adjustment="none",
            limit=250, end="20500101", initial_cash=Decimal(1), fee_bps=Decimal(5),
            ttl_seconds=300,
        ))


def test_routes_preserve_replayable_responses_across_cache_and_engine_changes(
    tmp_path, monkeypatch
):
    calls = []
    data = KlineResponse(
        symbol="fixture",
        secid="fixture:1",
        source="fixture",
        period="daily",
        adjustment="none",
        fetched_at="2026-01-01T00:00:00Z",
        bars=[{"date": f"2025-01-{day:02d}", "close": str(20 + day)} for day in range(1, 25)],
    )

    async def no_local(**_kwargs):
        return None

    async def remote_data(*_args, **_kwargs):
        calls.append(True)
        return data

    monkeypatch.setattr(backtests, "get_local_kline_if_ready", no_local)
    monkeypatch.setattr(backtests, "get_kline_local_first", remote_data)
    cache = MarketDataCache(root=tmp_path, enabled=True)
    app = FastAPI()
    app.include_router(
        create_backtest_router(
            client=object(),
            cache=cache,
            kline_cache_ttl_seconds=3600,
        )
    )
    with TestClient(app) as client:
        for endpoint in ["ma-crossover/fixture", "strategies/ma_crossover/fixture"]:
            url = f"/api/v1/backtests/{endpoint}?fast_window=3&slow_window=7&fee_bps=5.123456"
            first = client.get(url)
            assert first.status_code == 200
            assert first.json()["fetch"]["cache_status"] == "miss"
            replay_backtest(first.json())
            second = client.get(url)
            assert second.json()["fetch"]["cache_status"] == "hit"
            assert second.json()["experiment"] == first.json()["experiment"]
            replay_backtest(second.json())
        assert len(calls) == 2

        # Corrupt one replaceable cache entry; the service must produce a fresh receipt.
        cached_path = tmp_path / f"{second.json()['fetch']['cache_key']}.json"
        record = json.loads(cached_path.read_text(encoding="utf-8"))
        record["payload"]["summary"]["final_equity"] = "999"
        cached_path.write_text(json.dumps(record), encoding="utf-8")
        repaired = client.get(url)
        assert repaired.json()["fetch"]["cache_status"] == "miss"
        replay_backtest(repaired.json())
        assert len(calls) == 3

        monkeypatch.setattr(backtest_experiments, "_CODE_SHA256", "sha256:" + "0" * 64)
        changed = client.get(url)
        assert changed.json()["fetch"]["cache_status"] == "miss"
        assert len(calls) == 4
        with pytest.raises(ValueError, match="engine or runtime changed"):
            replay_backtest(second.json())


def test_requested_interval_parameters_and_fees_reach_the_engine(monkeypatch):
    calls = []
    data = KlineResponse(
        symbol="510300",
        secid="1.510300",
        source="fixture",
        period="daily",
        adjustment="qfq",
        fetched_at="2026-01-01T00:00:00Z",
        bars=[
            {
                "date": (date(2023, 10, 1) + timedelta(days=i)).isoformat(),
                "close": str(100 + i % 40),
            }
            for i in range(260)
        ],
    )

    async def no_local(**_kwargs):
        return None

    async def fetch(*_args, **kwargs):
        calls.append(kwargs)
        return data

    monkeypatch.setattr(backtests, "get_local_kline_if_ready", no_local)
    monkeypatch.setattr(backtests, "get_kline_local_first", fetch)
    app = FastAPI()
    app.include_router(
        create_backtest_router(
            client=object(),
            cache=MarketDataCache(enabled=False),
            kline_cache_ttl_seconds=300,
        )
    )
    with TestClient(app) as client:
        for endpoint in ["ma-crossover/510300", "strategies/ma_crossover/510300"]:
            response = client.get(
                f"/api/v1/backtests/{endpoint}",
                params={
                    "start": "2024-01-01",
                    "end": "2024-04-01",
                    "fast_window": 5,
                    "slow_window": 20,
                    "fee_bps": 10,
                    "initial_cash": 25000,
                },
            )
            assert response.status_code == 200, response.text
            body = response.json()
            assert body["fast_window"] == 5 and body["slow_window"] == 20
            assert Decimal(body["fee_bps"]) == 10
            assert body["evaluation_start"] == "2024-01-01"
            assert body["evaluation_end"] == "2024-04-01"
            assert body["summary"]["start_date"] == "2024-01-01"
            assert body["summary"]["end_date"] == "2024-04-01"
            replay_backtest(body)
            assert calls[-1]["end"] == "20240401"

        fetch_count = len(calls)
        for query in [
            "fast_window=garbage",
            "fast_window=2.5",
            "fast_widnow=5",
            "fast_window=60&slow_window=20",
            "period=minute5",
            "fast_window=5&fast_window=10",
            "start=2025-02-30",
        ]:
            response = client.get(f"/api/v1/backtests/strategies/ma_crossover/510300?{query}")
            assert response.status_code == 400, (query, response.text)
        assert len(calls) == fetch_count
