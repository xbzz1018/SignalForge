from __future__ import annotations

import os

import pytest

from signalforge_market_data import cli
from signalforge_market_data.cli import load_market_environment


def test_market_environment_uses_allowlist_and_local_precedence(tmp_path, monkeypatch) -> None:
    (tmp_path / ".env").write_text(
        "REDIS_URL=redis://base:6379/0\n"
        "DEEPSEEK_API_KEY=must-not-enter-market-process\n",
        encoding="utf8",
    )
    (tmp_path / ".env.local").write_text(
        "REDIS_URL=redis://local:6379/0\n"
        "SIGNALFORGE_REDIS_REQUIRED=1\n",
        encoding="utf8",
    )
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.delenv("SIGNALFORGE_REDIS_REQUIRED", raising=False)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    load_market_environment(tmp_path)

    assert os.environ["REDIS_URL"] == "redis://local:6379/0"
    assert os.environ["SIGNALFORGE_REDIS_REQUIRED"] == "1"
    assert "DEEPSEEK_API_KEY" not in os.environ


def test_market_environment_never_overrides_injected_runtime_secret(tmp_path, monkeypatch) -> None:
    (tmp_path / ".env").write_text("REDIS_URL=redis://file:6379/0\n", encoding="utf8")
    monkeypatch.setenv("REDIS_URL", "rediss://injected:6380/0")

    load_market_environment(tmp_path)

    assert os.environ["REDIS_URL"] == "rediss://injected:6380/0"


@pytest.mark.parametrize("reload", [False, True])
def test_market_selector_factory_matches_uvicorn_runner_contract(reload) -> None:
    config = cli.uvicorn.Config(
        "signalforge_market_data.api:app",
        loop="signalforge_market_data.cli:selector_event_loop_factory",
        reload=reload,
    )
    with cli.asyncio.Runner(loop_factory=config.get_loop_factory()) as runner:
        assert isinstance(runner.get_loop(), cli.asyncio.SelectorEventLoop)


@pytest.mark.parametrize(
    ("platform", "expected_loop"),
    [
        ("win32", "signalforge_market_data.cli:selector_event_loop_factory"),
        ("linux", "auto"),
    ],
)
def test_market_cli_uses_database_compatible_loop(monkeypatch, platform, expected_loop) -> None:
    calls = []
    monkeypatch.setattr(cli.sys, "platform", platform)
    monkeypatch.setattr(cli, "load_market_environment", lambda: None)
    monkeypatch.setattr(cli.uvicorn, "run", lambda app, **kwargs: calls.append((app, kwargs)))
    cli.main()
    assert calls[0][0] == "signalforge_market_data.api:app"
    assert calls[0][1]["loop"] == expected_loop
