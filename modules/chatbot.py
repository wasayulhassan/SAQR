"""
chatbot.py
Talks to the free Hugging Face Inference Providers API (router.huggingface.co)
for general reasoning / Q&A. No cost, no credit card — just a free HF
account + access token.

Setup (one-time):
    1. Create a free account: https://huggingface.co/join
    2. Create a free access token: https://huggingface.co/settings/tokens
       (Read access is enough)
    3. Set it as an environment variable named HF_TOKEN wherever this app
       runs (locally: `export HF_TOKEN=hf_xxx` before `python app.py`;
       on Render: add it under Environment in your service settings)

If HF_TOKEN isn't set, or the API is temporarily unavailable, the app still
works for data analysis / reports / PPT / math-solving — only the free-form
chat replies will show a friendly fallback message.
"""

import os
import requests

HF_TOKEN = os.environ.get("HF_TOKEN", "")
DEFAULT_MODEL = "google/gemma-2-2b-it"
HF_API_URL = "https://router.huggingface.co/hf-inference/v1/chat/completions"

SYSTEM_PROMPT = (
    "You are Saqr, an assistant specialized in data analysis, report "
    "writing, PowerPoint generation, and problem solving. Be concise and "
    "practical. If the user's request involves uploading a file, analyzing "
    "data, generating a report/PPT, or solving a math/logic problem, tell "
    "them to use the relevant tool button in the interface."
)


def is_ollama_running() -> bool:
    """Kept name for backward compatibility with app.py's /api/status route.
    Really checks whether a free HF_TOKEN is configured."""
    return bool(HF_TOKEN)


def chat(message: str, model: str = None, history=None) -> str:
    """
    Send a message to the free Hugging Face router API and return its reply.
    `history` is an optional list of {"role": "user"/"assistant", "content": str}
    """
    if not HF_TOKEN:
        return (
            "⚠️ Chat isn't configured yet — no HF_TOKEN found. "
            "Create a free token at huggingface.co/settings/tokens and set "
            "it as the HF_TOKEN environment variable. "
            "Data analysis, report, PPT, and solver tools still work without it."
        )

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
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
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()
    except requests.exceptions.RequestException as e:
        return f"⚠️ Error talking to the hosted chat model: {e}"
    except (KeyError, IndexError, ValueError):
        return "⚠️ Unexpected response from the chat model. Try again in a moment."
