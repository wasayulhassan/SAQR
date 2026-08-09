"""
chatbot.py
Talks to the free Hugging Face Inference Providers router for general
reasoning / Q&A — and, when a dataset is currently loaded in SAQR, answers
questions grounded in that dataset's stats/trends/anomalies.

Setup (one-time):
    1. Create a free account: https://huggingface.co/join
    2. Create a FINE-GRAINED access token: https://huggingface.co/settings/tokens
       Under the "Inference" section, check "Make calls to Inference
       Providers" — this exact permission is required, a plain "Read"
       token is not enough.
    3. Set it as an environment variable named HF_TOKEN wherever this app
       runs (locally: `export HF_TOKEN=hf_xxx` before `python app.py`;
       on Render: add it under Environment in your service settings)

If HF_TOKEN isn't set, or the API is temporarily unavailable, the app still
works for data analysis / reports / PPT / math-solving — only the free-form
chat replies will show a friendly fallback message.
"""

import os
import json
import requests

HF_TOKEN = os.environ.get("HF_TOKEN", "")
HF_API_URL = "https://router.huggingface.co/v1/chat/completions"

# Tried in order — ":fastest" lets HF auto-pick an available provider for
# each model. If the first model/provider pairing is temporarily unavailable
# (HF adds/removes provider mappings fairly often), we fall through to the
# next rather than surfacing a dead end.
MODEL_CANDIDATES = [
    "openai/gpt-oss-120b:fastest",
    "Qwen/Qwen2.5-7B-Instruct:fastest",
    "microsoft/Phi-3-mini-4k-instruct:fastest",
]

# How many tokens a reply is allowed to run to before HF cuts it off — the
# thing that was causing replies to stop mid-sentence/mid-table. Most of the
# candidates above have large context windows and can comfortably take the
# full amount; Phi-3-mini-4k is the exception — "4k" is its ENTIRE context
# window (prompt + reply combined), so asking it for 10000 completion tokens
# on its own would just fail outright. Since it only ever gets used as a
# last-resort fallback if the bigger models are down, give it a smaller cap
# that actually fits instead of guaranteeing that fallback attempt fails too.
DEFAULT_MAX_TOKENS = 10000
MODEL_MAX_TOKENS = {
    "microsoft/Phi-3-mini-4k-instruct:fastest": 3000,
}


def _max_tokens_for(model: str) -> int:
    return MODEL_MAX_TOKENS.get(model, DEFAULT_MAX_TOKENS)

SYSTEM_PROMPT = (
    "You are Saqr (صقر), a helpful assistant that lives entirely inside a "
    "chat interface — there are no separate tabs or forms, everything "
    "happens in this conversation. You can discuss anything, have a real "
    "conversation about an uploaded file, help build reports and slide "
    "decks, and solve math/logic problems directly. Be concise, warm, and "
    "practical.\n\n"
    "Important: you cannot browse the web yourself, and you must never say "
    "or imply that you are currently searching/checking online ('let me "
    "search for that', 'searching the web...', etc.) — you have no way to "
    "actually do that mid-reply. Live web search results, when the app has "
    "fetched them for this message, are provided to you below as a "
    "separate block; only reference the web when that block is present. If "
    "the user asks something that needs current/real-time information and "
    "no web results block appears below, say plainly that you don't have "
    "live web access for this reply and answer from general knowledge, "
    "noting it may be out of date — never fabricate a search or invent "
    "current facts/numbers."
)

# Extra instructions layered on top of SYSTEM_PROMPT depending on which of
# the three dedicated chats the message came from.
MODE_PROMPTS = {
    "report": (
        "\n\nYou are in the Report & Analysis chat — a dedicated space for "
        "working with one uploaded data file at a time. Focus on "
        "understanding the data, answering questions about it, calling out "
        "trends and outliers, and offering to generate a chart or a "
        "downloadable Word report when it would genuinely help. If the "
        "user asks for a presentation/slides/deck, tell them to use the "
        "PowerPoint chat instead — that's not what this space is for."
    ),
    "ppt": (
        "\n\nYou are in the PowerPoint chat — a dedicated space for "
        "building presentations, nothing else. When the user gives you a "
        "file, a topic, or written content, help shape a deck: ask about "
        "the purpose/audience if it's unclear, suggest a structure, add "
        "your own ideas and improvements, and confirm before generating. "
        "If the user asks for general data analysis or a Word report, tell "
        "them to use the Report & Analysis chat instead — that's not what "
        "this space is for."
    ),
}


def is_ollama_running() -> bool:
    """Kept name for backward compatibility with app.py's /api/status route.
    Really checks whether a free HF_TOKEN is configured."""
    return bool(HF_TOKEN)


def _build_system_prompt(data_context: dict = None, file_context: dict = None, web_context: list = None,
                          weather_context: dict = None, mode: str = "master", chart_info: dict = None) -> str:
    prompt = SYSTEM_PROMPT + MODE_PROMPTS.get(mode, "")

    if data_context:
        prompt += (
            "\n\nHere is a compact summary of the user's dataset (row/column "
            "counts, trends, and anomaly counts) — use it to answer "
            "questions about their data. You don't have the raw row-level "
            "values from this summary, so if they ask for an exact "
            "individual value, say you don't have that level of detail:\n"
            + json.dumps(data_context, default=str)
        )

    if file_context:
        truncated_note = (
            " (this is a partial excerpt — the file is longer than what's shown)"
            if file_context.get("truncated") else ""
        )
        prompt += (
            f"\n\nThe user has attached a file directly in this chat: "
            f"'{file_context.get('filename')}' ({file_context.get('meta')}). "
            f"Have a real conversation with them about it — answer questions, "
            f"point out issues, summarize sections, whatever they need. "
            f"Here is its extracted content{truncated_note}:\n"
            + file_context.get("content_text", "")
        )

    if web_context:
        from . import web_search
        prompt += (
            "\n\nYou just searched the web for current information relevant to "
            "the user's question. Use it to ground your answer, and briefly "
            "mention/cite sources by number like [1] where relevant. If the "
            "results don't actually answer the question, say so honestly "
            "rather than guessing:\n"
            + web_search.format_for_prompt(web_context)
        )

    if weather_context:
        prompt += (
            "\n\nYou just fetched live current weather for the user's "
            "location (they granted the browser location permission for "
            "this). Answer naturally and conversationally, like a helpful "
            "assistant would — don't just dump raw numbers verbatim:\n"
            + json.dumps(weather_context, default=str)
        )

    if chart_info:
        prompt += (
            "\n\nYou just generated a "
            f"{chart_info.get('chart_type', 'chart')} chart "
            f"({', '.join(chart_info.get('y_cols', []))} by {chart_info.get('x_col', '')}) "
            "for the user in response to their message — it's shown "
            "directly above your reply. Briefly describe what it shows in "
            "1-3 sentences, referencing real patterns from the data context "
            "above if you can, rather than just saying 'here's your chart'."
        )

    return prompt


def _call_model(model: str, messages: list, max_tokens: int = DEFAULT_MAX_TOKENS, temperature: float = 0.7) -> requests.Response:
    return requests.post(
        HF_API_URL,
        headers={
            "Authorization": f"Bearer {HF_TOKEN}",
            "Content-Type": "application/json",
        },
        json={"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": temperature},
        # Fail over to the next candidate model reasonably quickly rather
        # than leaving the user staring at a spinner for a minute and a
        # half before we even try the fallback.
        timeout=45,
    )


def chat_raw(system_prompt: str, user_prompt: str, max_tokens: int = 1200, temperature: float = 0.8) -> str:
    """Lower-level call used by other modules (e.g. ai_ppt.py) that need a
    single free-form completion rather than the chat-panel conversation
    flow. Raises RuntimeError on failure so callers can decide their own
    fallback behavior (unlike chat(), which always returns a friendly
    string since it's shown directly in the chat UI)."""
    if not HF_TOKEN:
        raise RuntimeError("HF_TOKEN not configured")

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    last_error = None
    for candidate_model in MODEL_CANDIDATES:
        try:
            resp = _call_model(candidate_model, messages, max_tokens=max_tokens, temperature=temperature)
        except requests.exceptions.RequestException as e:
            last_error = str(e)
            continue
        if not resp.ok:
            last_error = f"{resp.status_code} error from '{candidate_model}'"
            continue
        try:
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, ValueError):
            last_error = "Unexpected response format"
            continue

    raise RuntimeError(last_error or "All chat models unavailable")


def chat(message: str, model: str = None, history=None, data_context: dict = None,
         file_context: dict = None, web_context: list = None, weather_context: dict = None,
         mode: str = "master", chart_info: dict = None) -> str:
    """
    Send a message to the free Hugging Face router API and return its reply.
    `history` is an optional list of {"role": "user"/"assistant", "content": str}
    `data_context` is an optional compact dict describing a loaded dataset,
    used to ground answers in real data.
    `file_context` is an optional dict describing a file attached directly
    in the chat panel (see modules/file_context.py) — filename, meta, and
    extracted text — used to have a real conversation about that file.
    `web_context` is an optional list of {title, snippet, url} search
    results (see modules/web_search.py) for the current message, used to
    ground answers that need up-to-date information.
    `weather_context` is an optional dict with live weather fetched
    client-side (browser geolocation + a free weather API), used to answer
    "what's the weather" style questions quickly and accurately.
    `mode` is one of "master" / "report" / "ppt" — which of the three chat
    surfaces this message came from, used to focus the assistant's persona.
    `chart_info` is an optional dict describing a chart that was just
    generated for this message (report mode only), so the reply can
    reference it naturally instead of ignoring it.
    """
    if not HF_TOKEN:
        return (
            "⚠️ Chat isn't configured yet — no HF_TOKEN found. "
            "Create a free token at huggingface.co/settings/tokens and set "
            "it as the HF_TOKEN environment variable."
        )

    messages = [{"role": "system", "content": _build_system_prompt(
        data_context, file_context, web_context, weather_context, mode, chart_info
    )}]
    if history:
        for turn in history:
            role = "user" if turn["role"] == "user" else "assistant"
            messages.append({"role": role, "content": turn["content"]})
    messages.append({"role": "user", "content": message})

    candidates = [model] if model else MODEL_CANDIDATES
    last_error = None

    for candidate_model in candidates:
        try:
            resp = _call_model(candidate_model, messages, max_tokens=_max_tokens_for(candidate_model))
        except requests.exceptions.RequestException as e:
            last_error = f"Error talking to the hosted chat model: {e}"
            continue

        if resp.status_code == 403:
            last_error = (
                "403 Forbidden. Your HF token likely doesn't have 'Inference Providers' "
                "permission — go to huggingface.co/settings/tokens, create a Fine-grained "
                "token, and check 'Make calls to Inference Providers' under the Inference section."
            )
            continue
        if resp.status_code in (400, 404):
            last_error = f"{resp.status_code} error on model '{candidate_model}' — trying the next option."
            continue
        if not resp.ok:
            last_error = f"{resp.status_code} error from the chat model."
            continue

        try:
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, ValueError):
            last_error = "Unexpected response format from the chat model."
            continue

    return f"⚠️ {last_error or 'All chat models are temporarily unavailable — try again shortly.'}"
