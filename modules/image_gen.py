"""
image_gen.py
Generates a small number of AI illustrations for a presentation via the
free Hugging Face Inference API (same HF_TOKEN already used for chat).
Best-effort: text-to-image free tiers can be slow or briefly unavailable,
so every failure here should be swallowed by the caller and treated as
"skip the image for this slide" rather than failing the whole deck.
"""

import os
import requests

HF_TOKEN = os.environ.get("HF_TOKEN", "")

MODEL_CANDIDATES = [
    "black-forest-labs/FLUX.1-schnell",
    "stabilityai/stable-diffusion-xl-base-1.0",
]

MAX_IMAGES_PER_DECK = 3  # keeps total generation time bounded on a free tier


def is_configured() -> bool:
    return bool(HF_TOKEN)


def generate_image(prompt: str, out_path: str, timeout: int = 45) -> bool:
    """Try each candidate model in turn; write the first successful image
    to out_path and return True. Returns False (never raises) on any
    failure — callers should fall back to a themed decorative slide."""
    if not HF_TOKEN or not prompt:
        return False

    safe_prompt = (
        f"{prompt.strip()}, clean professional illustration, presentation slide "
        f"graphic, no text, no watermark"
    )[:400]

    for model in MODEL_CANDIDATES:
        try:
            resp = requests.post(
                f"https://api-inference.huggingface.co/models/{model}",
                headers={"Authorization": f"Bearer {HF_TOKEN}"},
                json={"inputs": safe_prompt},
                timeout=timeout,
            )
        except requests.exceptions.RequestException:
            continue

        if resp.ok and resp.headers.get("content-type", "").startswith("image"):
            try:
                with open(out_path, "wb") as f:
                    f.write(resp.content)
                return True
            except OSError:
                continue
        # 503 usually means "model loading" on a cold free-tier call — try next candidate
        continue

    return False
