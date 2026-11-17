from dataclasses import dataclass
from urllib.parse import urlencode

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

NINTENDO_PRICE_API_BASE = "https://api.ec.nintendo.com/v1/price"

# Title -> NSUID lookup runs against Nintendo's own public Algolia catalog index — the
# same search backend nintendo.com itself uses, and the same one the community
# nintendo-switch-eshop library queries. The application id + search key below are public,
# search-only credentials Nintendo ships in its own website's JavaScript (a search key
# cannot read or change any account data); the fork already ships a public OAuth client id
# the same way for GOG Galaxy. There is no per-user key to configure, which is why this
# provider needs no setup on the Integrations page.
_ALGOLIA_APP_ID = "U3B6GR4UA3"
_ALGOLIA_SEARCH_KEY = "6efbfb0f8f80defc44895018caf77504"
_ALGOLIA_API_BASE = f"https://{_ALGOLIA_APP_ID}-dsn.algolia.net"

# Nintendo's catalog is split by country: the search index and the price endpoint both
# take a country, and an NSUID only resolves prices for its own region's countries (an
# Americas NSUID covers CA/US/MX, not EU/JP). The price API's lang follows the same
# country; anything outside the four known Americas countries falls back to the US index
# and English.
_COUNTRY_SEARCH_LOCALE = {"CA": "en_ca", "US": "en_us", "MX": "es_mx", "BR": "pt_br"}
_COUNTRY_PRICE_LANG = {"CA": "en", "US": "en", "MX": "es", "BR": "pt"}

# The price endpoint paginates every 50 ids (per the nintendo-switch-eshop docs).
_PRICE_BATCH_SIZE = 50

NINTENDO_SHOP_NAME = "Nintendo eShop"

# Same reasoning as itad_client.py's/platprices_client.py's _retryable: transient
# network/5xx failures are worth retrying, a 4xx (malformed request) never gets better on
# retry.
_retryable = retry(
    retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    reraise=True,
)


@dataclass
class NintendoDeal:
    shop_name: str
    price_amount: float
    price_currency: str
    cut: int


@dataclass
class NintendoGamePrice:
    """One game's eShop price as of the last refresh. current_deal is the sale price when
    the game is actually discounted; regular_* is always present when Nintendo returns the
    title at all (it feeds the self-built historical low — see models/nintendo.py)."""

    current_deal: NintendoDeal | None
    regular_price_amount: float | None
    regular_price_currency: str | None


class NintendoClient:
    def __init__(self, http_client: httpx.AsyncClient | None = None) -> None:
        self._http = http_client or httpx.AsyncClient(timeout=10.0)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "NintendoClient":
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    @_retryable
    async def _request(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        response = await self._http.request(method, url, **kwargs)
        response.raise_for_status()
        return response

    def _search_locale(self, country: str) -> str:
        return _COUNTRY_SEARCH_LOCALE.get(country.strip().upper(), "en_us")

    def _price_lang(self, country: str) -> str:
        return _COUNTRY_PRICE_LANG.get(country.strip().upper(), "en")

    async def search_game(self, title: str, country: str) -> str | None:
        """Title -> the game's NSUID in `country`'s catalog, or None if no exact match.
        The index returns a ranked list of fuzzy matches rather than one canonical id
        (same situation as PlatPrices' /games/search) — to avoid ever caching a wrong
        NSUID, only an exact (case-insensitive) title match is accepted; anything else is
        treated as unmatched, same as a title ITAD itself can't find. When several exact
        matches exist (e.g. a Switch game and its 3DS namesake), the Switch-platform hit
        wins."""
        locale = self._search_locale(country)
        response = await self._request(
            "POST",
            f"{_ALGOLIA_API_BASE}/1/indexes/ncom_game_{locale}/query",
            headers={
                "X-Algolia-API-Key": _ALGOLIA_SEARCH_KEY,
                "X-Algolia-Application-Id": _ALGOLIA_APP_ID,
                "Content-Type": "application/json",
            },
            json={"params": urlencode({"query": title, "hitsPerPage": 10})},
        )
        exact: list[dict] = []
        for hit in response.json().get("hits") or []:
            name = hit.get("title") or ""
            nsuid = hit.get("nsuid")
            if nsuid and name.strip().lower() == title.strip().lower():
                exact.append(hit)
        if not exact:
            return None
        for hit in exact:
            if "switch" in str(hit.get("platformCode") or "").lower():
                return str(hit["nsuid"])
        return str(exact[0]["nsuid"])

    async def get_prices(self, nsuids: list[str], country: str) -> dict[str, NintendoGamePrice]:
        """Batched — one price-API call per 50 ids, not one call per game. A title is on
        sale only when the response carries a discount_price below the regular price:
        sales_status alone is NOT trusted — verified live 2026-11-17, Mario Kart 8 Deluxe
        and Tears of the Kingdom in CA both report sales_status "onsale" with no
        discount_price at all, so a game with no discount price simply has no actionable
        sale to show, whatever its status string says."""
        result: dict[str, NintendoGamePrice] = {}
        country_code = country.strip().upper()
        for start in range(0, len(nsuids), _PRICE_BATCH_SIZE):
            batch = nsuids[start : start + _PRICE_BATCH_SIZE]
            response = await self._request(
                "GET",
                NINTENDO_PRICE_API_BASE,
                params={
                    "country": country_code,
                    "ids": ",".join(batch),
                    "lang": self._price_lang(country_code),
                },
            )
            for entry in response.json().get("prices") or []:
                title_id = entry.get("title_id")
                if title_id is None:
                    continue
                regular = entry.get("regular_price") or {}
                try:
                    regular_amount = float(regular["raw_value"])
                except (KeyError, TypeError, ValueError):
                    continue
                regular_currency = regular.get("currency")
                deal = None
                discount = entry.get("discount_price") or {}
                try:
                    discount_amount = float(discount["raw_value"])
                except (KeyError, TypeError, ValueError):
                    discount_amount = None
                if discount_amount is not None and discount_amount < regular_amount:
                    cut = round((1 - discount_amount / regular_amount) * 100)
                    if cut > 0:
                        deal = NintendoDeal(
                            shop_name=NINTENDO_SHOP_NAME,
                            price_amount=discount_amount,
                            price_currency=discount.get("currency") or regular_currency,
                            cut=cut,
                        )
                result[str(title_id)] = NintendoGamePrice(
                    current_deal=deal,
                    regular_price_amount=regular_amount,
                    regular_price_currency=regular_currency,
                )
        return result
