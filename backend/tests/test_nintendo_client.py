import httpx
import respx

from app.services.nintendo_client import (
    NINTENDO_PRICE_API_BASE,
    NintendoClient,
)

_ALGOLIA_SEARCH_URL = "https://U3B6GR4UA3-dsn.algolia.net/1/indexes/ncom_game_en_ca/query"


def make_client() -> NintendoClient:
    return NintendoClient()


@respx.mock
async def test_search_game_returns_the_exact_match():
    respx.post(_ALGOLIA_SEARCH_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "hits": [
                    {"title": "Mario Kart 8 Deluxe", "nsuid": "70010000000153", "platformCode": "NINTENDO_SWITCH"},
                    {"title": "Mario Kart 8 Deluxe - Booster Course Pass", "nsuid": "70010000012345"},
                ]
            },
        )
    )

    nsuid = await make_client().search_game("Mario Kart 8 Deluxe", "CA")

    assert nsuid == "70010000000153"


@respx.mock
async def test_search_game_ignores_non_exact_matches():
    respx.post(_ALGOLIA_SEARCH_URL).mock(
        return_value=httpx.Response(
            200,
            json={"hits": [{"title": "Mario Kart 8 Deluxe - Booster Course Pass", "nsuid": "70010000012345"}]},
        )
    )

    nsuid = await make_client().search_game("Mario Kart 8 Deluxe", "CA")

    assert nsuid is None


@respx.mock
async def test_search_game_returns_none_when_no_results():
    respx.post(_ALGOLIA_SEARCH_URL).mock(return_value=httpx.Response(200, json={"hits": []}))

    nsuid = await make_client().search_game("Some Obscure Title", "CA")

    assert nsuid is None


@respx.mock
async def test_search_game_prefers_the_switch_hit_among_exact_matches():
    respx.post(_ALGOLIA_SEARCH_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "hits": [
                    {"title": "Shovel Knight", "nsuid": "70010000000001", "platformCode": "NINTENDO_3DS"},
                    {"title": "Shovel Knight", "nsuid": "70010000000002", "platformCode": "NINTENDO_SWITCH"},
                ]
            },
        )
    )

    nsuid = await make_client().search_game("Shovel Knight", "CA")

    assert nsuid == "70010000000002"


@respx.mock
async def test_get_prices_maps_a_current_discount():
    respx.get(NINTENDO_PRICE_API_BASE).mock(
        return_value=httpx.Response(
            200,
            json={
                "country": "CA",
                "prices": [
                    {
                        "title_id": 70010000000153,
                        "sales_status": "onsale",
                        "regular_price": {"amount": "$84.99", "currency": "CAD", "raw_value": "84.99"},
                        "discount_price": {
                            "amount": "$56.99",
                            "currency": "CAD",
                            "raw_value": "56.99",
                            "start_datetime": "2026-11-17T00:00:00Z",
                            "end_datetime": "2026-11-24T00:00:00Z",
                        },
                    }
                ],
            },
        )
    )

    prices = await make_client().get_prices(["70010000000153"], "CA")

    price = prices["70010000000153"]
    assert price.current_deal is not None
    assert price.current_deal.price_amount == 56.99
    assert price.current_deal.price_currency == "CAD"
    assert price.current_deal.shop_name == "Nintendo eShop"
    assert price.current_deal.cut == 33  # (1 - 56.99/84.99) * 100
    assert price.regular_price_amount == 84.99
    assert price.regular_price_currency == "CAD"


@respx.mock
async def test_get_prices_reports_no_deal_when_not_on_sale():
    respx.get(NINTENDO_PRICE_API_BASE).mock(
        return_value=httpx.Response(
            200,
            json={
                "country": "CA",
                "prices": [
                    {
                        "title_id": 70010000000153,
                        "sales_status": "not_sale",
                        "regular_price": {"amount": "$84.99", "currency": "CAD", "raw_value": "84.99"},
                    }
                ],
            },
        )
    )

    prices = await make_client().get_prices(["70010000000153"], "CA")

    price = prices["70010000000153"]
    assert price.current_deal is None
    assert price.regular_price_amount == 84.99


@respx.mock
async def test_get_prices_ignores_an_onsale_status_with_no_discount_price():
    # Verified live 2026-11-17: Mario Kart 8 Deluxe and Tears of the Kingdom in CA both
    # report sales_status "onsale" with no discount_price at all — no actionable sale
    # price, so no deal is reported, whatever the status string says.
    respx.get(NINTENDO_PRICE_API_BASE).mock(
        return_value=httpx.Response(
            200,
            json={
                "country": "CA",
                "prices": [
                    {
                        "title_id": 70010000000153,
                        "sales_status": "onsale",
                        "regular_price": {"amount": "$84.99", "currency": "CAD", "raw_value": "84.99"},
                    }
                ],
            },
        )
    )

    prices = await make_client().get_prices(["70010000000153"], "CA")

    assert prices["70010000000153"].current_deal is None


@respx.mock
async def test_get_prices_ignores_a_discount_that_is_not_below_regular():
    respx.get(NINTENDO_PRICE_API_BASE).mock(
        return_value=httpx.Response(
            200,
            json={
                "country": "CA",
                "prices": [
                    {
                        "title_id": 70010000000153,
                        "sales_status": "onsale",
                        "regular_price": {"amount": "$84.99", "currency": "CAD", "raw_value": "84.99"},
                        "discount_price": {"amount": "$84.99", "currency": "CAD", "raw_value": "84.99"},
                    }
                ],
            },
        )
    )

    prices = await make_client().get_prices(["70010000000153"], "CA")

    assert prices["70010000000153"].current_deal is None


@respx.mock
async def test_get_prices_chunks_ids_into_batches_of_fifty():
    route = respx.get(NINTENDO_PRICE_API_BASE).mock(
        return_value=httpx.Response(200, json={"country": "CA", "prices": []})
    )
    ids = [f"7001000000{i:04d}" for i in range(51)]

    await make_client().get_prices(ids, "CA")

    assert route.call_count == 2
