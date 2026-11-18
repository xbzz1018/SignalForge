from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from time import monotonic
from typing import Any, Literal
from uuid import uuid4

import redis.asyncio as redis
from redis.exceptions import RedisError

from signalforge_market_data.contracts.common import FetchMetadata

CacheStatus = Literal["hit", "miss", "disabled"]


@dataclass(frozen=True)
class CacheEntry:
    cache_key: str
    ttl_seconds: int
    cached_at: datetime
    expires_at: datetime
    payload: dict[str, Any]
    path: Path

    def to_fetch_metadata(self, status: CacheStatus) -> FetchMetadata:
        return FetchMetadata(
            cache_status=status,
            cache_key=self.cache_key,
            cache_ttl_seconds=self.ttl_seconds,
            cached_at=self.cached_at,
            expires_at=self.expires_at,
            cache_path=str(self.path),
        )


class MarketDataCache:
    """面向后端标准化响应的本地 JSON 缓存。"""

    def __init__(self, root: Path | None = None, enabled: bool | None = None) -> None:
        self.root = root or default_cache_root()
        self.enabled = cache_enabled_from_env() if enabled is None else enabled

    def build_key(self, namespace: str, params: dict[str, Any]) -> str:
        stable_payload = json.dumps(
            {"namespace": namespace, "params": params},
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        digest = hashlib.sha256(stable_payload.encode("utf-8")).hexdigest()[:24]
        safe_namespace = "".join(
            char if char.isalnum() or char in {"-", "_"} else "-"
            for char in namespace.lower()
        ).strip("-")
        return f"{safe_namespace}-{digest}"

    def read(self, cache_key: str) -> CacheEntry | None:
        if not self.enabled:
            return None

        path = self._path_for_key(cache_key)
        try:
            raw_record = json.loads(path.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            return None

        entry = self._parse_entry(cache_key, path, raw_record)
        if entry is None:
            return None
        if entry.expires_at <= datetime.now(UTC):
            self._delete_silent(path)
            return None
        return entry

    def write(
        self,
        cache_key: str,
        *,
        ttl_seconds: int,
        payload: dict[str, Any],
    ) -> CacheEntry | None:
        if not self.enabled or ttl_seconds <= 0:
            return None

        cached_at = datetime.now(UTC)
        expires_at = cached_at + timedelta(seconds=ttl_seconds)
        path = self._path_for_key(cache_key)
        record = {
            "cache_key": cache_key,
            "ttl_seconds": ttl_seconds,
            "cached_at": cached_at.isoformat(),
            "expires_at": expires_at.isoformat(),
            "payload": payload,
        }

        try:
            self.root.mkdir(parents=True, exist_ok=True)
            temp_path = path.with_suffix(".tmp")
            temp_path.write_text(
                json.dumps(record, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            temp_path.replace(path)
        except OSError:
            return None

        return CacheEntry(
            cache_key=cache_key,
            ttl_seconds=ttl_seconds,
            cached_at=cached_at,
            expires_at=expires_at,
            payload=payload,
            path=path,
        )

    def disabled_metadata(self, cache_key: str, ttl_seconds: int) -> FetchMetadata:
        return FetchMetadata(
            cache_status="disabled",
            cache_key=cache_key,
            cache_ttl_seconds=ttl_seconds,
        )

    def miss_metadata(self, cache_key: str, ttl_seconds: int) -> FetchMetadata:
        now = datetime.now(UTC)
        return FetchMetadata(
            cache_status="miss",
            cache_key=cache_key,
            cache_ttl_seconds=ttl_seconds,
            cached_at=now,
            expires_at=now + timedelta(seconds=ttl_seconds),
        )

    def _path_for_key(self, cache_key: str) -> Path:
        return self.root / f"{cache_key}.json"

    def _parse_entry(
        self,
        cache_key: str,
        path: Path,
        raw_record: Any,
    ) -> CacheEntry | None:
        if not isinstance(raw_record, dict):
            return None
        payload = raw_record.get("payload")
        if not isinstance(payload, dict):
            return None

        try:
            ttl_seconds = int(raw_record.get("ttl_seconds") or 0)
            cached_at = parse_datetime(raw_record.get("cached_at"))
            expires_at = parse_datetime(raw_record.get("expires_at"))
        except (TypeError, ValueError):
            return None

        if cached_at is None or expires_at is None:
            return None

        return CacheEntry(
            cache_key=str(raw_record.get("cache_key") or cache_key),
            ttl_seconds=ttl_seconds,
            cached_at=cached_at,
            expires_at=expires_at,
            payload=payload,
            path=path,
        )

    def _delete_silent(self, path: Path) -> None:
        try:
            path.unlink()
        except FileNotFoundError:
            return
        except OSError:
            return


class RedisJsonCache:
    """Redis-backed JSON cache with graceful fallback when Redis is unavailable."""

    def __init__(
        self,
        *,
        url: str | None = None,
        namespace: str | None = None,
        enabled: bool | None = None,
        retry_seconds: float = 5.0,
    ) -> None:
        self.url = url if url is not None else os.getenv("REDIS_URL", "").strip()
        self.namespace = namespace or os.getenv("REDIS_NAMESPACE", "signalforge")
        self.enabled = redis_enabled_from_env() if enabled is None else enabled
        self._client: redis.Redis | None = None
        self._retry_at = 0.0
        self._retry_seconds = max(0.1, retry_seconds)

    @property
    def configured(self) -> bool:
        return bool(self.url)

    @property
    def available(self) -> bool:
        return self.enabled and self.configured and monotonic() >= self._retry_at

    def _failed(self) -> None:
        self._retry_at = monotonic() + self._retry_seconds

    def _recovered(self) -> None:
        self._retry_at = 0.0

    def key(self, cache_key: str) -> str:
        if cache_key.startswith(f"{self.namespace}:"):
            return cache_key
        return f"{self.namespace}:market-data:{cache_key}"

    async def read(self, cache_key: str) -> dict[str, Any] | None:
        if not self.available:
            return None
        client = self._get_client()
        try:
            raw = await client.get(self.key(cache_key))
            self._recovered()
        except RedisError:
            self._failed()
            return None
        if raw is None:
            return None
        try:
            payload = json.loads(raw)
            if isinstance(payload, dict):
                return payload
        except (TypeError, json.JSONDecodeError):
            pass
        # A corrupt read must not delete a valid value written concurrently.
        try:
            await client.eval(
                "if redis.call('GET', KEYS[1]) == ARGV[1] then "
                "return redis.call('DEL', KEYS[1]) end return 0",
                1, self.key(cache_key), raw,
            )
        except RedisError:
            self._failed()
        return None

    async def begin_write(self, cache_key: str, *, ttl_seconds: int) -> str | None:
        """Fence stale refreshes; only the latest started refresh may publish."""
        if not self.available or ttl_seconds <= 0:
            return None
        token = uuid4().hex
        try:
            await self._get_client().set(
                f"{self.key(cache_key)}:generation", token, ex=max(60, ttl_seconds),
            )
            self._recovered()
            return token
        except RedisError:
            self._failed()
            return None

    async def write_if_current(
        self, cache_key: str, *, token: str | None, ttl_seconds: int, payload: dict[str, Any],
    ) -> bool:
        if not token or not self.available or ttl_seconds <= 0:
            return False
        try:
            encoded = json.dumps(payload, ensure_ascii=False, default=str, allow_nan=False)
            result = await self._get_client().eval(
                "if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end "
                "redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]); return 1",
                2, self.key(cache_key), f"{self.key(cache_key)}:generation",
                token, encoded, ttl_seconds,
            )
            self._recovered()
            return bool(result)
        except (TypeError, ValueError):
            return False
        except RedisError:
            self._failed()
            return False

    async def write(self, cache_key: str, *, ttl_seconds: int, payload: dict[str, Any]) -> bool:
        if not self.available or ttl_seconds <= 0:
            return False
        client = self._get_client()
        try:
            await client.set(
                self.key(cache_key),
                json.dumps(payload, ensure_ascii=False, default=str,
                           separators=(",", ":"), allow_nan=False),
                ex=ttl_seconds,
            )
            self._recovered()
            return True
        except (TypeError, ValueError):
            return False
        except RedisError:
            self._failed()
            return False

    async def delete(self, cache_key: str) -> None:
        if not self.available:
            return
        try:
            await self._get_client().delete(
                self.key(cache_key), f"{self.key(cache_key)}:generation",
            )
            self._recovered()
        except RedisError:
            self._failed()

    async def ping(self) -> bool:
        if not self.enabled or not self.configured:
            return False
        try:
            await self._get_client().ping()
            self._recovered()
            return True
        except RedisError:
            self._failed()
            return False

    async def close(self) -> None:
        if self._client is None:
            return
        await self._client.aclose()
        self._client = None

    def _get_client(self) -> redis.Redis:
        if self._client is None:
            self._client = redis.from_url(
                self.url,
                decode_responses=True,
                socket_connect_timeout=0.5,
                socket_timeout=1.5,
                health_check_interval=30,
            )
        return self._client


def default_cache_root() -> Path:
    raw_dir = os.getenv("SIGNALFORGE_MARKET_CACHE_DIR")
    if raw_dir:
        return Path(raw_dir).expanduser()

    xdg_cache_home = os.getenv("XDG_CACHE_HOME")
    if xdg_cache_home:
        return Path(xdg_cache_home).expanduser() / "signalforge" / "market_data"
    return Path("~/.cache/signalforge/market_data").expanduser()


def cache_enabled_from_env() -> bool:
    raw_value = os.getenv("SIGNALFORGE_MARKET_CACHE_ENABLED")
    if raw_value is None:
        return True
    return raw_value.strip().lower() not in {"0", "false", "no", "off", "disabled"}


def redis_enabled_from_env() -> bool:
    raw_value = os.getenv("SIGNALFORGE_REDIS_CACHE_ENABLED")
    if raw_value is None:
        return True
    return raw_value.strip().lower() not in {"0", "false", "no", "off", "disabled"}


def ttl_from_env(name: str, default_seconds: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default_seconds
    try:
        return max(0, int(raw_value))
    except ValueError:
        return default_seconds


def parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)
