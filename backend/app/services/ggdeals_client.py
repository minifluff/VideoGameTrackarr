from dataclasses import dataclass

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from app.core.config import get_settings

GGDEALS_API_BASE = "https://api.gg.deals/v1"

# GG.deals' Prices API accepts at most 100 Steam AppIDs per request
# (https://gg.deals/api/prices/).
GGDEALS_MAX_IDS_PER_REQUEST = 100


def _is_retryable(exc: BaseException) -> bool:
    # Transient network failures and 5xx are worth retrying. A 4xx (bad key, malformed
    # request) never gets better on retry — and a 429 never reaches here as an
    # HTTPStatusError anyway, since _request converts it to GgDealsRateLimitError first
    # (the refresh job paces itself to the rate limit instead of retry-bursting).
    if isinstance(exc, httpx.TransportError):
        return True
    return isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code >= 500


_retryable = retry(
    retry=retry_if_exception(_is_retryable),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.5, max=4),
    reraise=True,
)


class GgDealsCredentialsError(Exception):
    """Raised when GGDEALS_API_KEY isn't configured."""


class GgDealsRateLimitError(Exception):
    """Raised on HTTP 429 — deliberately NOT retried (see _is_retryable); the refresh job
    paces its chunked requests to stay under GG.deals' 100-records/minute limit instead."""


@dataclass
class GgDealsPrices:
    title: str | None
    url: str | None
    current_retail: float | None
    current_keyshops: float | None
    historical_retail: float | None
    historical_keyshops: float | None
    currency: str | None


def _parse_amount(value: object) -> float | None:
    # GG.deals returns prices as decimal strings ("91.99"); null when unknown.
    if value is None:
        return None
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return None


def _parse_entry(entry: dict) -> GgDealsPrices:
    prices = entry.get("prices") or {}
    return GgDealsPrices(
        title=entry.get("title"),
        url=entry.get("url"),
        current_retail=_parse_amount(prices.get("currentRetail")),
        current_keyshops=_parse_amount(prices.get("currentKeyshops")),
        historical_retail=_parse_amount(prices.get("historicalRetail")),
        historical_keyshops=_parse_amount(prices.get("historicalKeyshops")),
        currency=prices.get("currency"),
    )


class GgDealsClient:
    def __init__(self, api_key: str | None = None, http_client: httpx.AsyncClient | None = None) -> None:
        settings = get_settings()
        self._api_key = api_key or settings.ggdeals_api_key
        self._http = http_client or httpx.AsyncClient(timeout=10.0)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "GgDealsClient":
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    @_retryable
    async def _request(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        response = await self._http.request(method, url, **kwargs)
        if response.status_code == 429:
            raise GgDealsRateLimitError("GG.deals rate limit exceeded (100 records/minute, 1000/hour)")
        response.raise_for_status()
        return response

    def _require_key(self) -> str:
        if not self._api_key:
            raise GgDealsCredentialsError("GGDEALS_API_KEY is not configured")
        return self._api_key

    async def get_prices_by_steam_app_id(
        self, steam_app_ids: list[int], region: str
    ) -> dict[int, GgDealsPrices | None]:
        """Batched — one request per 100 ids, not one call per game. Returns GG.deals' price
        data per Steam AppID; a None value means GG.deals knows nothing about that AppID
        (not an error). Keys are ints, matching the Steam AppID domain (unlike ITAD's
        string ids)."""
        if not steam_app_ids:
            return {}
        key = self._require_key()
        result: dict[int, GgDealsPrices | None] = {}
        for offset in range(0, len(steam_app_ids), GGDEALS_MAX_IDS_PER_REQUEST):
            chunk = steam_app_ids[offset : offset + GGDEALS_MAX_IDS_PER_REQUEST]
            response = await self._request(
                "GET",
                f"{GGDEALS_API_BASE}/prices/by-steam-app-id/",
                params={"key": key, "ids": ",".join(str(app_id) for app_id in chunk), "region": region},
            )
            data = response.json().get("data") or {}
            for app_id in chunk:
                entry = data.get(str(app_id))
                result[app_id] = _parse_entry(entry) if entry else None
        return result
