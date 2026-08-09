"""
report_chat.py
Lightweight natural-language chart requests for the Report & Analysis chat
("show me a bar chart of revenue by month"). This is deliberately simple
keyword/column matching against the actual uploaded file — no extra LLM
call needed, so it's instant and free. If the message doesn't clearly ask
for a chart (or doesn't name a column we recognize), it returns None and
the caller just falls back to a normal grounded chat reply instead of
guessing at something wrong.
"""

import re

CHART_TYPE_PHRASES = [
    ("horizontal bar", "horizontal_bar"),
    ("pie chart", "pie"),
    ("pie", "pie"),
    ("scatterplot", "scatter"),
    ("scatter plot", "scatter"),
    ("scatter", "scatter"),
    ("area chart", "area"),
    ("area", "area"),
    ("line chart", "line"),
    ("trend", "line"),
    ("over time", "line"),
    ("column chart", "column"),
    ("column", "column"),
    ("bar chart", "bar"),
    ("bar", "bar"),
]

CHART_TRIGGER_RE = re.compile(
    r"\b(chart|graph|plot|visuali[sz]e|visuali[sz]ation)\b", re.IGNORECASE
)


def _detect_chart_type(message: str) -> str:
    msg = message.lower()
    for phrase, ctype in CHART_TYPE_PHRASES:
        if phrase in msg:
            return ctype
    return "bar"


def _mentioned_columns(message: str, columns: list) -> list:
    msg = message.lower()
    found = []
    for col in columns:
        col_l = str(col).strip().lower()
        if col_l and col_l in msg:
            found.append(col)
    return found


def maybe_build_chart(message: str, df, numeric_columns: list):
    """Returns a dict of {chart_type, x_col, y_cols, title} ready to pass
    into chart_builder.build_chart(df, **spec), or None if the message
    doesn't confidently ask for a chart of columns that actually exist."""
    if not message or not CHART_TRIGGER_RE.search(message):
        return None

    columns = list(df.columns)
    mentioned = _mentioned_columns(message, columns)
    mentioned_numeric = [c for c in mentioned if c in numeric_columns]

    if not mentioned_numeric:
        # Asked for a chart but didn't name a column we recognize in this
        # file — let the model reply in words and ask which column, rather
        # than silently building the wrong thing.
        return None

    y_cols = mentioned_numeric
    chart_type = _detect_chart_type(message)

    x_candidates = [c for c in mentioned if c not in mentioned_numeric]
    if x_candidates:
        x_col = x_candidates[0]
    else:
        # No explicit non-numeric axis named — fall back to the first
        # column that isn't one of the chosen Y columns.
        remaining = [c for c in columns if c not in y_cols]
        x_col = remaining[0] if remaining else columns[0]

    if chart_type == "pie" and len(y_cols) > 1:
        y_cols = y_cols[:1]
    if chart_type == "scatter":
        # scatter uses one numeric column as X too if nothing better was named
        if x_col not in numeric_columns and len(mentioned_numeric) > 1:
            x_col = mentioned_numeric[0]
            y_cols = mentioned_numeric[1:2]

    return {
        "chart_type": chart_type,
        "x_col": x_col,
        "y_cols": y_cols,
        "title": f"{', '.join(y_cols)} by {x_col}",
    }
