"""
chatbot.py
Talks to the free Hugging Face Inference API for general reasoning / Q&A.
No cost, no credit card — just a free HF account + access token.

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
DEFAULT_MODEL = "HuggingFaceH4/zephyr-7b-beta"
HF_API_URL = f"https://api-inference.huggingface.co/models/{DEFAULT_MODEL}"

SYSTEM_PROMPT = (
    "You are Saqr, an assistant specialized in data analysis, report "
    "writing, PowerPoint generation, and problem solving. Be concise and "
    "practical. If the user's request involves uploading a file, analyzing "
    "data, generating a report/PPT, or solving a math/logic problem, tell "
    "them to use the relevant tool button in the interface."
)


def is_ollama_running() -> bool:
    """Kept name for backward compatibility with app.py's /api/status route.
    Really checks whether the free hosted chat model is reachable."""
    if not HF_TOKEN:
        return False
    try:
        r = requests.get(
            "https://api-inference.huggingface.co/status/" + DEFAULT_MODEL,
            headers={"Authorization": f"Bearer {HF_TOKEN}"},
            timeout=5,
        )
        return r.status_code == 200
    except requests.exceptions.RequestException:
        return False


def chat(message: str, model: str = None, history=None) -> str:
    """
    Send a message to the free Hugging Face Inference API and return its reply.
    `history` is an optional list of {"role": "user"/"assistant", "content": str}
    """
    if not HF_TOKEN:
        return (
            "⚠️ Chat isn't configured yet — no HF_TOKEN found. "
            "Create a free token at huggingface.co/settings/tokens and set "
            "it as the HF_TOKEN environment variable. "
            "Data analysis, report, PPT, and solver tools still work without it."
        )

    convo = f"<|system|>\n{SYSTEM_PROMPT}</s>\n"
    if history:
        for turn in history:
            tag = "user" if turn["role"] == "user" else "assistant"
            convo += f"<|{tag}|>\n{turn['content']}</s>\n"
    convo += f"<|user|>\n{message}</s>\n<|assistant|>\n"

    try:
        resp = requests.post(
            HF_API_URL,
            headers={"Authorization": f"Bearer {HF_TOKEN}"},
            json={
                "inputs": convo,
                "parameters": {"max_new_tokens": 400, "temperature": 0.7, "return_full_text": False},
                "options": {"wait_for_model": True},
            },
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list) and data and "generated_text" in data[0]:
            return data[0]["generated_text"].strip()
        if isinstance(data, dict) and "error" in data:
            return f"⚠️ Model is warming up or unavailable: {data['error']}"
        return "⚠️ Unexpected response from the chat model."
    except requests.exceptions.RequestException as e:
        return f"⚠️ Error talking to the hosted chat model: {e}"
