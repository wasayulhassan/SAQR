"""
chatbot.py
Talks to the free Hugging Face Inference Providers API (router.huggingface.co)
for general reasoning / Q&A — and, when a dataset is currently loaded in
SAQR, answers questions grounded in that dataset's stats/trends/anomalies.

Setup (one-time):
    1. Create a free account: https://huggingface.co/join
    2. Create a free access token: https://huggingface.co/settings/tokens
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
# Ungated, freely-licensed model — no HF terms-acceptance required, unlike
# Google's Gemma or Meta's Llama models which return 403 until you accept
# their license on huggingface.co first.
DEFAULT_MODEL = "microsoft/Phi-3-mini-4k-instruct"
HF_API_URL = "https://router.huggingface.co/hf-inference/v1/chat/completions"

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

    try:
        resp = requests.post(
            HF_API_URL,
            headers={
                "Authorization": f"Bearer {HF_TOKEN}",
                "Content-Type": "application/json",
            },
            json={
                "model": model or DEFAULT_MODEL,
                "messages": messages,
                "max_tokens": 400,
                "temperature": 0.7,
            },
            timeout=60,
        )
        if resp.status_code == 403:
            return (
                "⚠️ 403 Forbidden from the chat model. This usually means either: "
                "(1) your HF token doesn't have 'Inference Providers' permission — "
                "check huggingface.co/settings/tokens and make sure that's enabled, or "
                "(2) the model requires accepting a license on its Hugging Face page first. "
                "Data analysis, report, PPT, and solver tools still work without this."
            )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()
    except requests.exceptions.RequestException as e:
        return f"⚠️ Error talking to the hosted chat model: {e}"
    except (KeyError, IndexError, ValueError):
        return "⚠️ Unexpected response from the chat model. Try again in a moment."
