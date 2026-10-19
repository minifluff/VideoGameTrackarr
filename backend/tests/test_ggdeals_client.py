import httpx
import pytest
import respx

from app.core.config import get_settings
from app.services.ggdeals_client import (
    GGDEALS_API_BASE,
    GgDealsClient,
    GgDealsCredentialsError,
    GgDealsRateLimitError,
)


def make_client(**overrides) -> GgDealsClient:
    kwargs = {"api_key": "test-ggdeals-key"}
    kwargs.update(overrides)
    return GgDealsClient(**kwargs)


def _prices_payload(app_id: int, **overrides) -> dict:
    payload = {
        "title": f"Game {app_id}",
        "url": f"https://gg.deals/game/game-{app_id}/",
        "prices": {
            "currentRetail": "59.99",
            "currentKeyshops": "24.30",
            "historicalRetail": "29.99",
            "historicalKeyshops": "12.00",
            "currency": "USD",
        },
    }
    payload["prices"].update(overrides)
    return payload


async def test_get_prices_requires_an_api_key(monkeypatch):
    # The repo-root .env may have a real GGDEALS_API_KEY for local dev use, which the
    # constructor's `api_key or settings.ggdeals_api_key` fallback would pick up instead of
    # None — override it explicitly, same reasoning as test_itad_client.py's equivalent.
    monkeypatch.setattr(get_settings(), "ggdeals_api_key", None)
    client = make_client(api_key=None)

    with pytest.raises(GgDealsCredentialsError):
        await client.get_prices_by_steam_app_id([10], "us")


@respx.mock
async def test_get_prices_parses_strings_to_floats_and_null_entries():
    respx.get(f"{GGDEALS_API_BASE}/prices/by-steam-app-id/").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {
                    "10": _prices_payload(10),
                    "20": None,  # GG.deals knows nothing about this AppID — not an error
                },
            },
        )
    )

    prices = await make_client().get_prices_by_steam_app_id([10, 20], "us")

    entry = prices[10]
    assert entry.title == "Game 10"
    assert entry.url == "https://gg.deals/game/game-10/"
    assert entry.current_retail == 59.99
    assert entry.current_keyshops == 24.30
    assert entry.historical_retail == 29.99
    assert entry.historical_keyshops == 12.00
    assert entry.currency == "USD"
    assert prices[20] is None


@respx.mock
async def test_get_prices_chunks_at_100_ids():
    seen_id_params: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_id_params.append(request.url.params["ids"])
        app_id = request.url.params["ids"].split(",")[0]
        return httpx.Response(200, json={"success": True, "data": {app_id: _prices_payload(int(app_id))}})

    respx.get(f"{GGDEALS_API_BASE}/prices/by-steam-app-id/").mock(side_effect=handler)

    ids = list(range(1, 102))  # 101 ids -> two requests (100 + 1)
    prices = await make_client().get_prices_by_steam_app_id(ids, "us")

    assert len(seen_id_params) == 2
    assert len(seen_id_params[0].split(",")) == 100
    assert len(seen_id_params[1].split(",")) == 1
    assert len(prices) == 101


@respx.mock
async def test_get_prices_returns_empty_for_no_ids():
    route = respx.get(f"{GGDEALS_API_BASE}/prices/by-steam-app-id/").mock(
        return_value=httpx.Response(200, json={"success": True, "data": {}})
    )

    assert await make_client().get_prices_by_steam_app_id([], "us") == {}
    assert not route.called


@respx.mock
async def test_rate_limit_raises_without_retry():
    route = respx.get(f"{GGDEALS_API_BASE}/prices/by-steam-app-id/").mock(
        return_value=httpx.Response(429)
    )

    with pytest.raises(GgDealsRateLimitError):
        await make_client().get_prices_by_steam_app_id([10], "us")

    # A 429 must never be retry-burst: exactly one request goes out.
    assert route.call_count == 1


@respx.mock
async def test_client_error_is_not_retried():
    route = respx.get(f"{GGDEALS_API_BASE}/prices/by-steam-app-id/").mock(
        return_value=httpx.Response(401, json={"detail": "bad key"})
    )

    with pytest.raises(httpx.HTTPStatusError):
        await make_client().get_prices_by_steam_app_id([10], "us")

    # A 4xx never gets better on retry — exactly one request goes out.
    assert route.call_count == 1


@respx.mock
async def test_server_error_is_retried_then_succeeds():
    route = respx.get(f"{GGDEALS_API_BASE}/prices/by-steam-app-id/").mock(
        side_effect=[
            httpx.Response(500),
            httpx.Response(200, json={"success": True, "data": {"10": _prices_payload(10)}}),
        ]
    )

    prices = await make_client().get_prices_by_steam_app_id([10], "us")

    assert prices[10].current_retail == 59.99
    assert route.call_count == 2


@respx.mock
async def test_region_is_sent_lowercase():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["region"] == "ca"
        return httpx.Response(200, json={"success": True, "data": {}})

    respx.get(f"{GGDEALS_API_BASE}/prices/by-steam-app-id/").mock(side_effect=handler)

    await make_client().get_prices_by_steam_app_id([10], "ca")


@respx.mock
async def test_malformed_price_strings_become_none():
    respx.get(f"{GGDEALS_API_BASE}/prices/by-steam-app-id/").mock(
        return_value=httpx.Response(
            200,
            json={
                "success": True,
                "data": {"10": _prices_payload(10, currentRetail="n/a", historicalRetail=None)},
            },
        )
    )

    prices = await make_client().get_prices_by_steam_app_id([10], "us")

    assert prices[10].current_retail is None
    assert prices[10].historical_retail is None
