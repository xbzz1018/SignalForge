from __future__ import annotations

import asyncio
import os
from uuid import uuid4

import pytest

from signalforge_market_data.cache import RedisJsonCache

TEST_URL = os.getenv("MARKET_TEST_REDIS_URL", "")
pytestmark = pytest.mark.skipif(not TEST_URL, reason="requires isolated MARKET_TEST_REDIS_URL")


def test_real_redis_prevents_late_refresh_overwrites_and_invalidation_resurrection():
    async def scenario():
        cache = RedisJsonCache(url=TEST_URL, namespace=f"reliability-test:{uuid4()}", enabled=True)
        key = "intraday"
        try:
            old = await cache.begin_write(key, ttl_seconds=30)
            new = await cache.begin_write(key, ttl_seconds=30)
            assert old and new and old != new
            assert await cache.write_if_current(
                key, token=new, ttl_seconds=30, payload={"version": 2},
            )
            assert not await cache.write_if_current(
                key, token=old, ttl_seconds=30, payload={"version": 1},
            )
            assert await cache.read(key) == {"version": 2}
            assert 0 < await cache._get_client().ttl(cache.key(key)) <= 30
            outstanding = await cache.begin_write(key, ttl_seconds=30)
            await cache.delete(key)
            assert not await cache.write_if_current(
                key, token=outstanding, ttl_seconds=30, payload={"version": 3},
            )
            assert await cache.read(key) is None
        finally:
            await cache.delete(key)
            await cache.close()
    asyncio.run(scenario())


def test_real_redis_rejects_malformed_json_and_reuses_the_connection():
    async def scenario():
        cache = RedisJsonCache(url=TEST_URL, namespace=f"reliability-test:{uuid4()}", enabled=True)
        try:
            client = cache._get_client()
            await client.set(cache.key("invalid"), "{broken", ex=30)
            assert await cache.read("invalid") is None
            assert await client.get(cache.key("invalid")) is None
            assert await cache.write("valid", ttl_seconds=30, payload={"value": 1})
            assert await cache.read("valid") == {"value": 1}
        finally:
            await cache.delete("invalid")
            await cache.delete("valid")
            await cache.close()
    asyncio.run(scenario())
