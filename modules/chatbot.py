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

SYSTEM_PROMPT = (
    "You are Saqr, an assistant specialized in data analysis, report "
    "writing, PowerPoint generation, and problem solving. Be concise and "
    "practical. If the user's request involves uploading a file, generating "
    "a report/PPT, or solving a math/logic problem, tell them to use the "
    "relevant tool button in the interface."
)


def is_ollama_running() -> bool:
    """Kept name for backward compatibility with app.py's /api/status route.
    Really checks whether a free HF_TOKEN is configured."""
    return bool(HF_TOKEN)


def _build_system_prompt(data_context: dict = None, file_context: dict = None, web_context: list = None) -> str:
    prompt = SYSTEM_PROMPT

    if data_context:
        prompt += (
            "\n\nThe user currently has a dataset loaded in the Analyze tab. "
            "Here is a compact summary of it (row/column counts, trends, and "
            "anomaly counts) — use it to answer questions about their data. "
            "You don't have the raw row-level values from this one, so if "
            "they ask for an exact individual value, say you don't have "
            "that level of detail and point them to the Analyze or Charts tab:\n"
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

    return prompt


def _call_model(model: str, messages: list, max_tokens: int = 400, temperature: float = 0.7) -> requests.Response:
    return requests.post(
        HF_API_URL,
        headers={
            "Authorization": f"Bearer {HF_TOKEN}",
            "Content-Type": "application/json",
        },
        json={"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": temperature},
        timeout=90,
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
         file_context: dict = None, web_context: list = None) -> str:
    """
    Send a message to the free Hugging Face router API and return its reply.
    `history` is an optional list of {"role": "user"/"assistant", "content": str}
    `data_context` is an optional compact dict describing the currently
    loaded dataset (see app.py), used to ground answers in real data.
    `file_context` is an optional dict describing a file attached directly
    in the chat panel (see modules/file_context.py) — filename, meta, and
    extracted text — used to have a real conversation about that file.
    `web_context` is an optional list of {title, snippet, url} search
    results (see modules/web_search.py) for the current message, used to
    ground answers that need up-to-date information.
    """
    if not HF_TOKEN:
        return (
            "⚠️ Chat isn't configured yet — no HF_TOKEN found. "
            "Create a free token at huggingface.co/settings/tokens and set "
            "it as the HF_TOKEN environment variable. "
            "Data analysis, report, PPT, and solver tools still work without it."
        )

    messages = [{"role": "system", "content": _build_system_prompt(data_context, file_context, web_context)}]
    if history:
        for turn in history:
            role = "user" if turn["role"] == "user" else "assistant"
            messages.append({"role": role, "content": turn["content"]})
    messages.append({"role": "user", "content": message})

    candidates = [model] if model else MODEL_CANDIDATES
    last_error = None

    for candidate_model in candidates:
        try:
            resp = _call_model(candidate_model, messages)
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

    return f"⚠️ {last_error or 'All chat models are temporarily unavailable — try again shortly.'} " \
           f"Data analysis, report, PPT, and solver tools still work without this."
