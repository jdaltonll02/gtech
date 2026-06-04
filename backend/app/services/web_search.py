"""Web search via DuckDuckGo — no API key required."""
import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def search_web(query: str, site_restrict: Optional[str] = None, max_results: int = 4) -> list[dict]:
    """
    Run a web search and return list of {title, url, snippet}.
    If site_restrict is provided (e.g. 'example.com'), prepend site: operator.
    """
    try:
        from duckduckgo_search import DDGS
        full_query = f"site:{site_restrict} {query}" if site_restrict else query
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(full_query, max_results=max_results):
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("href", ""),
                    "snippet": r.get("body", ""),
                })
        return results
    except Exception as e:
        logger.warning("Web search failed: %s", e)
        return []
