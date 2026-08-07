"""
chart_builder.py
Lets the user build their own charts on demand — pick a chart type, X/Y
columns, a title, and a color — similar to inserting/customizing a chart
in Excel. Separate from analyzer.py's automatic charts.
"""

import os
import uuid
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

CHART_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "charts")
os.makedirs(CHART_DIR, exist_ok=True)

VALID_TYPES = {"bar", "column", "line", "pie", "scatter", "area", "horizontal_bar"}
PALETTE = ["#4F46E5", "#5EC8D8", "#E0616B", "#6FCF97", "#F2C94C", "#BB6BD9", "#E8A33D"]


def build_chart(df: pd.DataFrame, chart_type: str, x_col: str, y_cols: list,
                 title: str = "", color: str = None) -> dict:
    chart_type = (chart_type or "").lower()
    if chart_type not in VALID_TYPES:
        return {"ok": False, "error": f"Unsupported chart type '{chart_type}'. "
                                       f"Choose from: {', '.join(sorted(VALID_TYPES))}"}
    if x_col not in df.columns:
        return {"ok": False, "error": f"Column '{x_col}' not found in the dataset"}
    y_cols = [y for y in y_cols if y]
    if not y_cols:
        return {"ok": False, "error": "Pick at least one Y column"}
    for yc in y_cols:
        if yc not in df.columns:
            return {"ok": False, "error": f"Column '{yc}' not found in the dataset"}

    palette = [color] + PALETTE if color else PALETTE
    fig, ax = plt.subplots(figsize=(7.2, 4.3))

    try:
        if chart_type in ("bar", "column"):
            x_labels = df[x_col].astype(str)
            positions = np.arange(len(x_labels))
            width = 0.8 / max(len(y_cols), 1)
            for i, yc in enumerate(y_cols):
                ax.bar(positions + i * width, pd.to_numeric(df[yc], errors="coerce"),
                       width=width, label=yc, color=palette[i % len(palette)])
            ax.set_xticks(positions + width * (len(y_cols) - 1) / 2)
            ax.set_xticklabels(x_labels, rotation=45, ha="right", fontsize=8)

        elif chart_type == "horizontal_bar":
            x_labels = df[x_col].astype(str)
            positions = np.arange(len(x_labels))
            height = 0.8 / max(len(y_cols), 1)
            for i, yc in enumerate(y_cols):
                ax.barh(positions + i * height, pd.to_numeric(df[yc], errors="coerce"),
                        height=height, label=yc, color=palette[i % len(palette)])
            ax.set_yticks(positions + height * (len(y_cols) - 1) / 2)
            ax.set_yticklabels(x_labels, fontsize=8)

        elif chart_type == "line":
            for i, yc in enumerate(y_cols):
                ax.plot(df[x_col].astype(str), pd.to_numeric(df[yc], errors="coerce"),
                        label=yc, color=palette[i % len(palette)], linewidth=2, marker="o", markersize=3)
            plt.xticks(rotation=45, ha="right", fontsize=8)

        elif chart_type == "area":
            x_labels = df[x_col].astype(str)
            for i, yc in enumerate(y_cols):
                ax.fill_between(range(len(df)), pd.to_numeric(df[yc], errors="coerce"),
                                 alpha=0.45, label=yc, color=palette[i % len(palette)])
            ax.set_xticks(range(len(df)))
            ax.set_xticklabels(x_labels, rotation=45, ha="right", fontsize=8)

        elif chart_type == "scatter":
            ax.scatter(pd.to_numeric(df[x_col], errors="coerce"),
                       pd.to_numeric(df[y_cols[0]], errors="coerce"),
                       color=palette[0], alpha=0.75, edgecolors="none")

        elif chart_type == "pie":
            yc = y_cols[0]
            values = pd.to_numeric(df[yc], errors="coerce").fillna(0)
            labels = df[x_col].astype(str)
            colors = [palette[i % len(palette)] for i in range(len(values))]
            ax.pie(values, labels=labels, autopct="%1.1f%%", colors=colors,
                   textprops={"fontsize": 8})
            ax.axis("equal")
    except Exception as e:
        plt.close(fig)
        return {"ok": False, "error": f"Couldn't build that chart: {e}"}

    if chart_type != "pie":
        ax.set_xlabel(x_col)
        ax.set_ylabel(", ".join(y_cols))
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        if len(y_cols) > 1:
            ax.legend(fontsize=8)

    ax.set_title(title.strip() if title and title.strip() else f"{', '.join(y_cols)} by {x_col}")
    fig.tight_layout()

    fname = f"custom_{uuid.uuid4().hex[:8]}.png"
    fpath = os.path.join(CHART_DIR, fname)
    fig.savefig(fpath, dpi=130)
    plt.close(fig)

    return {"ok": True, "path": fpath, "url": "/static/charts/" + fname}
