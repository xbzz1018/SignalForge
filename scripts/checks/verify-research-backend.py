"""Opt-in acceptance against real providers and an isolated PostgreSQL/Redis deployment."""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

import httpx
import psycopg
from fastapi import FastAPI
from fastapi.testclient import TestClient

from quantpilot_market_data.backtest_accounting import reconcile_backtest
from quantpilot_market_data.cache import MarketDataCache, RedisJsonCache
from quantpilot_market_data.providers.baostock import BaoStockClient
from quantpilot_market_data.providers.eastmoney import EastMoneyClient
from quantpilot_market_data.replay_backtest import replay_backtest
from quantpilot_market_data.repositories import upserts
from quantpilot_market_data.routers.backtests import create_backtest_router

ROOT = Path(__file__).resolve().parents[2]


def save(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


async def run(args: argparse.Namespace) -> int:
    url = os.environ.get("MARKET_TEST_DATABASE_URL", "")
    redis_url = os.environ.get("MARKET_TEST_REDIS_URL", "")
    if not url or not redis_url:
        raise ValueError("Set isolated MARKET_TEST_DATABASE_URL and MARKET_TEST_REDIS_URL.")
    with psycopg.connect(url) as connection:
        if not connection.info.dbname.endswith("_test"):
            raise ValueError("Acceptance requires an isolated database ending in _test.")
        extension = connection.execute(
            "SELECT extversion FROM pg_extension WHERE extname='timescaledb'"
        ).fetchone()
        if not extension:
            raise ValueError("Acceptance requires TimescaleDB and the repository bootstrap SQL.")
    os.environ["DATABASE_URL"] = url
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    diff = subprocess.check_output(["git", "diff", "--binary", "HEAD"], cwd=ROOT,
                                   stderr=subprocess.DEVNULL)
    changed = subprocess.check_output(
        ["git", "diff", "--name-only", "HEAD"], cwd=ROOT, text=True, stderr=subprocess.DEVNULL,
    ).splitlines()
    added = subprocess.check_output(
        ["git", "ls-files", "--others", "--exclude-standard"], cwd=ROOT, text=True,
    ).splitlines()
    source_files = {
        name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
        for name in sorted(set(changed + added))
        if (ROOT / name).is_file() and Path(name).suffix in {".py", ".ts", ".js", ".yml"}
    }
    report = {
        "schema_version": 1,
        "started_at": datetime.now(UTC).isoformat(),
        "revision": revision,
        "tracked_diff_sha256": hashlib.sha256(diff).hexdigest(),
        "changed_source_files_sha256": source_files,
        "timescaledb_version": extension[0],
        "cases": [],
    }
    eastmoney = EastMoneyClient()
    app = FastAPI()
    app.include_router(
        create_backtest_router(
            client=eastmoney,
            cache=MarketDataCache(enabled=False),
            kline_cache_ttl_seconds=300,
        )
    )
    for symbol in args.symbols.split(","):
        case = {"symbol": symbol, "status": "failed", "provider_attempts": []}
        try:
            data = None
            for provider in (eastmoney, BaoStockClient()):
                try:
                    if isinstance(provider, BaoStockClient):
                        data = await asyncio.wait_for(
                            provider.get_kline_range(
                                symbol,
                                start_date=args.start,
                                end_date=args.end,
                                limit=250,
                            ),
                            timeout=45,
                        )
                    else:
                        data = await asyncio.wait_for(
                            provider.get_kline(
                                symbol,
                                limit=250,
                                end=args.end.replace("-", ""),
                                allow_fallback=False,
                            ),
                            timeout=25,
                        )
                    if len(data.bars) < 61:
                        raise ValueError("Provider returned insufficient historical samples.")
                    case["provider_attempts"].append({"provider": provider.id, "status": "passed"})
                    break
                except Exception as error:
                    data = None
                    case["provider_attempts"].append(
                        {
                            "provider": provider.id,
                            "status": "failed",
                            "error_type": type(error).__name__,
                        }
                    )
            if data is None:
                raise ValueError("No real provider returned sufficient historical data.")
            save(output / f"{symbol}-market.json", data.model_dump(mode="json"))
            stored_symbol, count, _, _ = await upserts.upsert_kline_response(data, universe_id=None)
            # Exercise the real repository transaction: a fault after bar writes must roll back.
            with psycopg.connect(url) as connection:
                before = connection.execute(
                    "SELECT ts,close,metadata FROM quant.stock_bars WHERE symbol=%s ORDER BY ts",
                    (stored_symbol,),
                ).fetchall()
            original = upserts._refresh_market_data_sync_state

            async def fail_after_writes(*_args, **_kwargs):
                raise RuntimeError("acceptance-injected-after-bar-writes")

            upserts._refresh_market_data_sync_state = fail_after_writes
            changed = data.model_copy(deep=True)
            changed.bars[-1].metadata["acceptance_rollback_probe"] = True
            try:
                await upserts.upsert_kline_response(changed, universe_id=None)
                raise AssertionError("Injected transaction failure was not raised.")
            except RuntimeError:
                pass
            finally:
                upserts._refresh_market_data_sync_state = original
            with psycopg.connect(url) as connection:
                after = connection.execute(
                    "SELECT ts,close,metadata FROM quant.stock_bars WHERE symbol=%s ORDER BY ts",
                    (stored_symbol,),
                ).fetchall()
                if before != after:
                    raise AssertionError("Repository transaction left partial writes.")
                plan = connection.execute(
                    "EXPLAIN (FORMAT JSON) SELECT * FROM quant.stock_bars WHERE symbol=%s "
                    "AND timeframe='daily' AND adjustment='qfq' ORDER BY ts DESC LIMIT 120",
                    (stored_symbol,),
                ).fetchone()[0]
            save(output / f"{symbol}-query-plan.json", plan)
            # The application gateway must now read the real persisted data.
            backend_options = (
                {"loop_factory": asyncio.SelectorEventLoop} if sys.platform == "win32" else {}
            )
            with TestClient(app, backend_options=backend_options) as client:
                response = client.get(
                    f"/api/v1/backtests/ma-crossover/{symbol}",
                    params={
                        "fast_window": 5,
                        "slow_window": 20,
                        "fee_bps": 10,
                        "slippage_bps": 5,
                        "limit": min(count, 250),
                        "initial_cash": 100000,
                        "end": data.bars[-1].date,
                    },
                )
            if response.status_code != 200:
                raise ValueError(f"Backtest HTTP status {response.status_code}.")
            payload = response.json()
            replay = replay_backtest(payload)
            if replay.source != "timescaledb":
                raise ValueError("Backtest did not use the persisted TimescaleDB data.")
            accounting = reconcile_backtest(replay)
            save(output / f"{symbol}-backtest.json", payload)
            cache = RedisJsonCache(url=redis_url, namespace="signalforge-acceptance", enabled=True)
            key = f"backtest:{replay.experiment.experiment_id}"
            try:
                if not await cache.write(key, ttl_seconds=120, payload=payload):
                    raise ValueError("Real Redis write failed.")
                cached = await cache.read(key)
                if cached != payload:
                    raise ValueError("Real Redis round trip changed the artifact.")
            finally:
                await cache.delete(key)
                await cache.close()
            case.update(
                status="passed",
                source=data.source,
                stored_rows=count,
                first_date=data.bars[0].date,
                last_date=data.bars[-1].date,
                asset_type=data.asset_type,
                experiment_id=replay.experiment.experiment_id,
                engine_code_sha256=replay.experiment.engine.code_sha256,
                accounting=accounting,
                repository_rollback="passed",
                redis_round_trip="passed",
                offline_replay="passed",
            )
        except Exception as error:
            case["error_type"] = type(error).__name__
            # Avoid leaking provider URLs, connection strings or auth values into evidence.
        report["cases"].append(case)
        save(output / "report.json", report)
    # Real model readiness is reported separately and never replaced by a fixture model.
    profile = json.loads((ROOT / "config/llm.json").read_text(encoding="utf-8"))
    selected = profile["profiles"][profile["defaultProfileId"]]
    key = os.environ.get(selected["credentialEnv"], "")
    report["model"] = {
        "profile": profile["defaultProfileId"],
        "status": "blocked",
        "reason": "credential_missing" if not key else "endpoint_unavailable",
    }
    if key:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(
                    selected["baseUrl"].rstrip("/") + "/chat/completions",
                    headers={"Authorization": f"Bearer {key}"},
                    json={
                        "model": selected["model"],
                        "messages": [{"role": "user", "content": "Reply with OK."}],
                        "max_tokens": 8,
                    },
                )
                response.raise_for_status()
                if not response.json().get("choices"):
                    raise ValueError("Model response lacks choices.")
            report["model"] = {
                "profile": profile["defaultProfileId"],
                "status": "reachable",
                "note": "Model probe only; full Agent/browser delivery needs separate E2E.",
            }
        except Exception as error:
            report["model"]["error_type"] = type(error).__name__
    report["completed_at"] = datetime.now(UTC).isoformat()
    report["backend_status"] = (
        "passed" if all(case["status"] == "passed" for case in report["cases"]) else "failed"
    )
    report["full_agent_delivery"] = "not_run"
    save(output / "report.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["backend_status"] == "passed" else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--symbols", default="600519,510300,000300")
    parser.add_argument("--start", default="2025-01-01")
    parser.add_argument("--end", default="2025-12-31")
    options = {"loop_factory": asyncio.SelectorEventLoop} if sys.platform == "win32" else {}
    with asyncio.Runner(**options) as runner:
        raise SystemExit(runner.run(run(parser.parse_args())))
