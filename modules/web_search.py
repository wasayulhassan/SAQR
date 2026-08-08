"""
web_search.py
Free, no-API-key web search (DuckDuckGo via the `ddgs` package) used to:
  1) ground chat answers in current information when the user asks for it
  2) research a topic from scratch for the presentation wizard when no
     file is attached (e.g. "make a presentation about the 2007 Honda Civic")

Best-effort like the rest of SAQR's free-tier integrations: DuckDuckGo's
free search can occasionally rate-limit or hiccup, so every failure here
is swallowed and returns an empty list rather than raising — callers
should treat "no results" as "couldn't reach the web right now" and
degrade gracefully (same philosophy as image_gen.py).
"""

from ddgs import DDGS

MAX_RESULTS = 5


def search(query: str, max_results: int = MAX_RESULTS) -> list:
    """Returns a list of {title, snippet, url} dicts, or [] on any failure."""
    query = (query or "").strip()
    if not query:
        return []
    try:
        with DDGS() as ddgs:
            raw = list(ddgs.text(query, max_results=max_results))
    except Exception:
        return []

    results = []
    for r in raw:
        results.append({
            "title": r.get("title", ""),
            "snippet": r.get("body", ""),
            "url": r.get("href", ""),
        })
    return results


def format_for_prompt(results: list) -> str:
    """Compact, source-attributed text block to feed to the model."""
    if not results:
        return ""
    lines = []
    for i, r in enumerate(results, 1):
        lines.append(f"[{i}] {r['title']}\n{r['snippet']}\nSource: {r['url']}")
    return "\n\n".join(lines)


def build_web_file_context(topic: str, results: list) -> dict:
    """Shapes web search results into the same {type, filename, meta,
    content_text, truncated} structure file_context.py produces, so the
    presentation pipeline (ai_ppt.py) can consume either one identically
    without needing to know whether the source was a file or the web."""
    return {
        "type": "web",
        "filename": topic,
        "meta": f"{len(results)} web source(s)",
        "content_text": format_for_prompt(results),
        "truncated": False,
        "sources": [r["url"] for r in results],
    }
