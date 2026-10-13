"""Google Custom Search API client for finding cover art images.

Requires GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID to be configured.
Get a free API key from Google Cloud Console (Custom Search JSON API) and
create a search engine at https://programmablesearchengine.google.com/
"""

import httpx

GOOGLE_SEARCH_API = "https://www.googleapis.com/customsearch/v1"


class ImageSearchError(Exception):
    pass


class ImageSearchNotConfiguredError(ImageSearchError):
    pass


async def search_images(
    api_key: str | None,
    engine_id: str | None,
    query: str,
    limit: int = 10,
) -> list[dict]:
    """Searches Google for images matching the query.

    Returns a list of {"url": ..., "thumbnail": ..., "title": ...} dicts.
    Raises ImageSearchNotConfiguredError if credentials are missing.
    """
    if not api_key or not engine_id:
        raise ImageSearchNotConfiguredError(
            "Google image search is not configured. Set GOOGLE_SEARCH_API_KEY "
            "and GOOGLE_SEARCH_ENGINE_ID environment variables."
        )

    params = {
        "key": api_key,
        "cx": engine_id,
        "q": query,
        "searchType": "image",
        "num": min(max(limit, 1), 10),
        "safe": "active",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(GOOGLE_SEARCH_API, params=params)

    if response.status_code != 200:
        raise ImageSearchError(f"Google image search failed: {response.status_code}")

    data = response.json()
    results = []
    for item in data.get("items", []):
        image_info = item.get("image", {})
        results.append(
            {
                "url": item.get("link", ""),
                "thumbnail": image_info.get("thumbnailLink", item.get("link", "")),
                "title": item.get("title", ""),
                "width": image_info.get("width"),
                "height": image_info.get("height"),
            }
        )
    return results
