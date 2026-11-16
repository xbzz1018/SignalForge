from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

from redis.exceptions import ConnectionError

from quantpilot_market_data import cache as cache_module
from quantpilot_market_data.cache import RedisJsonCache


def test_redis_recovers_after_cooldown_without_requiring_a_readiness_probe(monkeypatch):
    clock = [100.0]
    monkeypatch.setattr(cache_module, "monotonic", lambda: clock[0])
    cache = RedisJsonCache(url="redis://unused", enabled=True, retry_seconds=5)
    cache._client = AsyncMock()
    cache._client.get.side_effect = [ConnectionError("temporarily unavailable"), '{"value": 42}']

    async def scenario():
        assert await cache.read("example") is None
        clock[0] = 104
        assert await cache.read("example") is None
        assert cache._client.get.call_count == 1
        clock[0] = 106
        assert await cache.read("example") == {"value": 42}
        assert cache.available
    asyncio.run(scenario())


def test_bad_payload_does_not_disable_a_healthy_redis_connection():
    cache = RedisJsonCache(url="redis://unused", enabled=True)
    cache._client = AsyncMock()

    async def scenario():
        assert not await cache.write("example", ttl_seconds=60, payload={"value": float("nan")})
        assert cache.available
        assert await cache.write("example", ttl_seconds=60, payload={"value": 42})
    asyncio.run(scenario())


def test_non_object_json_is_a_cache_miss_and_cleanup_is_compare_and_delete():
    cache = RedisJsonCache(url="redis://unused", enabled=True)
    cache._client = AsyncMock()
    cache._client.get.return_value = '["unexpected"]'
    assert asyncio.run(cache.read("example")) is None
    assert cache._client.eval.call_args.args[-1] == '["unexpected"]'
    cache._client.delete.assert_not_called()
