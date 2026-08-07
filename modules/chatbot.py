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


def _build_system_prompt(data_context: dict = None) -> str:
    if not data_context:
        return SYSTEM_PROMPT
    return (
        SYSTEM_PROMPT
        + "\n\nThe user currently has a dataset loaded in the Analyze tab. "
          "Here is a compact summary of it (row/column counts, trends, and "
          "anomaly counts) — use it to answer questions about their data. "
          "You don't have the raw row-level values, so if they ask for an "
          "exact individual value, say you don't have that level of detail "
          "and point them to the Analyze or Charts tab:\n"
        + json.dumps(data_context, default=str)
    )


def _call_model(model: str, messages: list) -> requests.Response:
    return requests.post(
        HF_API_URL,
        headers={
            "Authorization": f"Bearer {HF_TOKEN}",
            "Content-Type": "application/json",
        },
        json={"model": model, "messages": messages, "max_tokens": 400, "temperature": 0.7},
        timeout=60,
    )


def chat(message: str, model: str = None, history=None, data_context: dict = None) -> str:
    """
    Send a message to the free Hugging Face router API and return its reply.
    `history` is an optional list of {"role": "user"/"assistant", "content": str}
    `data_context` is an optional compact dict describing the currently
    loaded dataset (see app.py), used to ground answers in real data.
    """
    if not HF_TOKEN:
        return (
            "⚠️ Chat isn't configured yet — no HF_TOKEN found. "
            "Create a free token at huggingface.co/settings/tokens and set "
            "it as the HF_TOKEN environment variable. "
            "Data analysis, report, PPT, and solver tools still work without it."
        )

    messages = [{"role": "system", "content": _build_system_prompt(data_context)}]
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
