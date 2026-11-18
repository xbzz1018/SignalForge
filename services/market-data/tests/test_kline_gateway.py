from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from signalforge_market_data.contracts.quotes import (
    KlineResponse,
    LocalKlineBar,
    LocalKlineResponse,
    LocalKlineSummary,
)
from signalforge_market_data.repositories.bars import estimate_latest_completed_trade_date
from signalforge_market_data.services import kline_gateway


class NeverCalledProvider:
    id = "never-called"

    async def get_kline(self, *args, **kwargs):
        raise AssertionError("provider must not be called when local coverage is ready")


def test_same_code_in_wrong_market_falls_back_to_provider(monkeypatch) -> None:
    timestamp = datetime(2025, 12, 31, tzinfo=UTC)

    async def resolve(_symbol):
        return "000001.SZ"

    async def read(**_kwargs):
        return LocalKlineResponse(
            symbol="000001.SZ", code="000001", exchange="SZ", secid="0.000001",
            timeframe="daily", adjustment="qfq",
            bars=[LocalKlineBar(
                ts=timestamp, open=Decimal(10), high=Decimal(10),
                low=Decimal(10), close=Decimal(10), volume=Decimal(100), provider="baostock",
            )],
            summary=LocalKlineSummary(row_count=1, first_ts=timestamp, last_ts=timestamp),
        ), None

    class IndexProvider:
        id = "test"

        async def get_kline(self, symbol, **_kwargs):
            assert symbol == "000001.SH"
            return KlineResponse(
                symbol="000001", secid="1.000001", source="test", period="daily", adjustment="qfq",
                bars=[{"date": "2025-12-31", "open": "100", "close": "100"}],
                fetched_at=timestamp,
            )

    monkeypatch.setattr(kline_gateway, "resolve_local_symbol", resolve)
    monkeypatch.setattr(kline_gateway, "_read_local_and_benchmark", read)
    result = asyncio.run(kline_gateway.get_kline_local_first(
        IndexProvider(), symbol="000001.SH", period="daily", adjustment="qfq",
        limit=1, end="20260101",
    ))
    assert result.secid == "1.000001"


def test_expected_trade_date_respects_close_and_weekend() -> None:
    shanghai = ZoneInfo("Asia/Shanghai")
    assert estimate_latest_completed_trade_date(
        datetime(2024, 1, 8, 10, tzinfo=shanghai)
    ).isoformat() == "2024-01-05"
    assert estimate_latest_completed_trade_date(
        datetime(2024, 1, 8, 19, tzinfo=shanghai)
    ).isoformat() == "2024-01-08"
    assert estimate_latest_completed_trade_date(
        datetime(2024, 1, 6, 19, tzinfo=shanghai)
    ).isoformat() == "2024-01-05"


def test_local_kline_short_circuits_provider(monkeypatch) -> None:
    timestamp = datetime(2026, 7, 13, tzinfo=UTC)
    bars = [
        LocalKlineBar(
            ts=timestamp,
            open=Decimal("10"),
            high=Decimal("11"),
            low=Decimal("9"),
            close=Decimal("10.5"),
            volume=Decimal("100"),
            trade_status="1",
            is_st=False,
            limit_up=False,
            limit_down=False,
            provider="baostock",
        )
    ]
    local = LocalKlineResponse(
        symbol="600519.SH",
        code="600519",
        name="贵州茅台",
        exchange="SH",
        secid="1.600519",
        provider="baostock",
        timeframe="daily",
        adjustment="qfq",
        bars=bars,
        summary=LocalKlineSummary(row_count=1, first_ts=timestamp, last_ts=timestamp),
    )

    async def fake_resolve(symbol: str) -> str:
        assert symbol == "600519"
        return "600519.SH"

    async def fake_read(**kwargs):
        assert kwargs["local_symbol"] == "600519.SH"
        return local, timestamp

    async def fake_expected_trade_date():
        return timestamp.date(), "test_calendar"

    monkeypatch.setattr(kline_gateway, "resolve_local_symbol", fake_resolve)
    monkeypatch.setattr(kline_gateway, "_read_local_and_benchmark", fake_read)
    monkeypatch.setattr(
        kline_gateway,
        "get_expected_latest_trade_date",
        fake_expected_trade_date,
    )

    result = asyncio.run(
        kline_gateway.get_kline_local_first(
            NeverCalledProvider(),
            symbol="600519",
            period="daily",
            adjustment="qfq",
            limit=1,
            end="20500101",
        )
    )

    assert result.source == "timescaledb"
    assert result.metadata["data_basis"] == "timescaledb.canonical_stock_bars"
    assert result.metadata["freshness"]["status"] == "current"
    assert result.metadata["freshness"]["expected_trade_date_basis"] == "test_calendar"
    assert result.metadata["coverage"]["returned_bars"] == 1


def test_local_kline_rejects_incomplete_coverage(monkeypatch) -> None:
    async def fake_resolve(symbol: str) -> str:
        return "600519.SH"

    async def fake_read(**kwargs):
        return (
            LocalKlineResponse(
                symbol="600519.SH",
                exchange="SH",
                timeframe="daily",
                adjustment="qfq",
                bars=[],
                summary=LocalKlineSummary(),
            ),
            None,
        )

    async def fake_expected_trade_date():
        return datetime(2026, 7, 14, tzinfo=UTC).date(), "test_calendar"

    monkeypatch.setattr(kline_gateway, "resolve_local_symbol", fake_resolve)
    monkeypatch.setattr(kline_gateway, "_read_local_and_benchmark", fake_read)
    monkeypatch.setattr(
        kline_gateway,
        "get_expected_latest_trade_date",
        fake_expected_trade_date,
    )
    result = asyncio.run(
        kline_gateway.get_local_kline_if_ready(
            symbol="600519",
            period="daily",
            adjustment="qfq",
            limit=1,
            end="20500101",
        )
    )
    assert result is None


def test_local_kline_rejects_globally_stale_database(monkeypatch) -> None:
    timestamp = datetime(2026, 6, 15, tzinfo=UTC)
    local = LocalKlineResponse(
        symbol="600519.SH",
        code="600519",
        exchange="SH",
        timeframe="daily",
        adjustment="qfq",
        bars=[
            LocalKlineBar(
                ts=timestamp,
                open=Decimal("10"),
                high=Decimal("11"),
                low=Decimal("9"),
                close=Decimal("10.5"),
                volume=Decimal("100"),
                trade_status="1",
                is_st=False,
                limit_up=False,
                limit_down=False,
                provider="baostock",
            )
        ],
        summary=LocalKlineSummary(row_count=1, first_ts=timestamp, last_ts=timestamp),
    )

    async def fake_resolve(symbol: str) -> str:
        return "600519.SH"

    async def fake_read(**kwargs):
        return local, timestamp

    async def fake_expected_trade_date():
        return datetime(2026, 7, 14, tzinfo=UTC).date(), "test_calendar"

    monkeypatch.setattr(kline_gateway, "resolve_local_symbol", fake_resolve)
    monkeypatch.setattr(kline_gateway, "_read_local_and_benchmark", fake_read)
    monkeypatch.setattr(
        kline_gateway,
        "get_expected_latest_trade_date",
        fake_expected_trade_date,
    )

    result = asyncio.run(
        kline_gateway.get_local_kline_if_ready(
            symbol="600519",
            period="daily",
            adjustment="qfq",
            limit=1,
            end="20500101",
        )
    )
    assert result is None
