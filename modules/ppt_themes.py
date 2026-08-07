"""
ppt_themes.py
A small set of distinct visual themes for AI-generated presentations, so
decks don't all look identical — each generation picks one (by requested
style, or randomly for "surprise me"), giving genuine visual variety
without needing a design tool or heavy dependencies.
"""

import random
from pptx.dml.color import RGBColor


def _rgb(hex_str: str) -> RGBColor:
    hex_str = hex_str.lstrip("#")
    return RGBColor(int(hex_str[0:2], 16), int(hex_str[2:4], 16), int(hex_str[4:6], 16))


THEMES = {
    "minimal": {
        "label": "Minimal Mono",
        "bg": _rgb("#FFFFFF"),
        "panel": _rgb("#F4F4F5"),
        "text": _rgb("#18181B"),
        "muted": _rgb("#71717A"),
        "accent": _rgb("#111827"),
        "accent_2": _rgb("#9CA3AF"),
        "heading_font": "Helvetica",
        "body_font": "Helvetica",
        "chart_palette": ["#111827", "#6B7280", "#9CA3AF", "#D1D5DB"],
        "mood": "minimal",
    },
    "bold": {
        "label": "Bold Block",
        "bg": _rgb("#12131A"),
        "panel": _rgb("#1D1F2B"),
        "text": _rgb("#FFFFFF"),
        "muted": _rgb("#A3A6C2"),
        "accent": _rgb("#FF3D57"),
        "accent_2": _rgb("#3DD6FF"),
        "heading_font": "Arial Black",
        "body_font": "Arial",
        "chart_palette": ["#FF3D57", "#3DD6FF", "#FFD23F", "#7C4DFF"],
        "mood": "bold, energetic, colorful",
    },
    "classic": {
        "label": "Classic Editorial",
        "bg": _rgb("#FBF8F2"),
        "panel": _rgb("#EFE8DA"),
        "text": _rgb("#2B2620"),
        "muted": _rgb("#7A7263"),
        "accent": _rgb("#8C4A2F"),
        "accent_2": _rgb("#C9A15A"),
        "heading_font": "Georgia",
        "body_font": "Georgia",
        "chart_palette": ["#8C4A2F", "#C9A15A", "#4A6350", "#2B2620"],
        "mood": "classic, academic, serif, understated",
    },
    "brand": {
        "label": "SAQR Red",
        "bg": _rgb("#0B0B0C"),
        "panel": _rgb("#1C1C1F"),
        "text": _rgb("#F2F1EF"),
        "muted": _rgb("#97979C"),
        "accent": _rgb("#E4002B"),
        "accent_2": _rgb("#FFFFFF"),
        "heading_font": "Arial",
        "body_font": "Arial",
        "chart_palette": ["#E4002B", "#FFFFFF", "#9E001E", "#97979C"],
        "mood": "sleek, high-contrast, red-black-white",
    },
    "fresh": {
        "label": "Fresh Pastel",
        "bg": _rgb("#FFFFFF"),
        "panel": _rgb("#EAF7F0"),
        "text": _rgb("#1F2937"),
        "muted": _rgb("#6B7280"),
        "accent": _rgb("#0EA47A"),
        "accent_2": _rgb("#FFB020"),
        "heading_font": "Verdana",
        "body_font": "Verdana",
        "chart_palette": ["#0EA47A", "#FFB020", "#3B82F6", "#EF476F"],
        "mood": "fresh, friendly, approachable, pastel",
    },
}

_STYLE_ALIASES = {
    "minimal": "minimal",
    "bold": "bold",
    "bold & colorful": "bold",
    "bold and colorful": "bold",
    "classic": "classic",
    "brand": "brand",
    "surprise": None,
    "surprise me": None,
}


def pick_theme(style_answer: str = None) -> dict:
    key = None
    if style_answer:
        key = _STYLE_ALIASES.get(style_answer.strip().lower())
    if not key:
        key = random.choice(list(THEMES.keys()))
    theme = dict(THEMES[key])
    theme["key"] = key
    return theme
