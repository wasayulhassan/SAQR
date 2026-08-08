"""
web_search.py
Free, no-API-key web search (via the `ddgs` package) used to:
  1) ground chat answers in current information when the user asks for it
  2) research a topic from scratch for the presentation wizard when no
     file is attached (e.g. "make a presentation about the 2007 Honda Civic")

`ddgs` is a metasearch library — left on its default backend="auto" it
fans a query out across several engines at once (bing, brave, google,
grokipedia, wikipedia, yandex, mojeek) and merges whatever comes back.
From a cloud host's IP, some of those engines get silently blocked/
degraded and return junk filler (unrelated domains, ad-redirect pages)
instead of erroring — which then looks like a "successful" search that
just happens to be garbage. To avoid that, we try one named backend at
a time (most reliable first), keep only results that actually mention a
keyword from the query, and move on to the next backend if a given one
comes back empty or irrelevant. Every failure here is swallowed and
returns an empty list rather than raising — callers should treat "no
results" as "couldn't reach the web right now" and degrade gracefully
(same philosophy as image_gen.py).
"""

from ddgs import DDGS

MAX_RESULTS = 5

# Tried in order, one at a time (not aggregated) — see module docstring.
BACKENDS = ["duckduckgo", "brave", "bing", "wikipedia"]

_STOPWORDS = {
    "the", "a", "an", "of", "for", "and", "or", "to", "in", "on", "is", "are",
    "why", "what", "who", "how", "does", "do", "did", "with", "about", "this",
    "that", "it", "was", "be", "as", "at", "by", "from", "me", "my", "i",
}


def _keywords(query: str) -> set:
    return {w.lower().strip(".,!?") for w in query.split() if w.lower() not in _STOPWORDS and len(w) > 2}


def _looks_relevant(query: str, result: dict) -> bool:
    """Guards against a degraded backend returning results that have
    nothing to do with the query — cheap sanity check, not real ranking."""
    kws = _keywords(query)
    if not kws:
        return True
    haystack = f"{result.get('title', '')} {result.get('body', '')}".lower()
    return any(kw in haystack for kw in kws)


def search(query: str, max_results: int = MAX_RESULTS) -> list:
    """Returns a list of {title, snippet, url} dicts, or [] on any failure."""
    query = (query or "").strip()
    if not query:
        return []

    for backend in BACKENDS:
        try:
            with DDGS() as ddgs:
                raw = list(ddgs.text(query, max_results=max_results, backend=backend))
        except Exception:
            continue

        if not raw:
            continue

        relevant = [r for r in raw if _looks_relevant(query, r)]
        if relevant:
            return [
                {
                    "title": r.get("title", ""),
                    "snippet": r.get("body", ""),
                    "url": r.get("href", ""),
                }
                for r in relevant[:max_results]
            ]
        # raw came back but none of it mentions the query at all — likely a
        # blocked/degraded response from this backend; try the next one
        # rather than surfacing junk to the user.

    return []


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
