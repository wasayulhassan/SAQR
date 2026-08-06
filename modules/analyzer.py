"""
analyzer.py
Loads CSV/Excel data and produces a structured analysis:
- summary statistics
- trend detection (per numeric column)
- simple anomaly detection (z-score based)
- a couple of chart images (saved to disk, referenced by path)
"""

import os
import uuid
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

CHART_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "charts")
os.makedirs(CHART_DIR, exist_ok=True)


def load_file(filepath: str) -> pd.DataFrame:
    ext = filepath.lower().rsplit(".", 1)[-1]
    if ext == "csv":
        return pd.read_csv(filepath)
    elif ext in ("xlsx", "xls"):
        return pd.read_excel(filepath)
    else:
        raise ValueError(f"Unsupported file type: .{ext}")


def summary_stats(df: pd.DataFrame) -> dict:
    numeric = df.select_dtypes(include=[np.number])
    return {
        "rows": len(df),
        "columns": list(df.columns),
        "numeric_columns": list(numeric.columns),
        "describe": numeric.describe().round(2).to_dict(),
        "missing_values": df.isnull().sum().to_dict(),
    }


def detect_trends(df: pd.DataFrame) -> dict:
    """For each numeric column, report whether it trends up/down/flat
    based on simple linear regression slope sign."""
    numeric = df.select_dtypes(include=[np.number])
    trends = {}
    for col in numeric.columns:
        series = numeric[col].dropna().values
        if len(series) < 2:
            trends[col] = "not enough data"
            continue
        x = np.arange(len(series))
        slope = np.polyfit(x, series, 1)[0]
        pct_change = (series[-1] - series[0]) / (abs(series[0]) + 1e-9) * 100
        if abs(slope) < 1e-6:
            direction = "flat"
        elif slope > 0:
            direction = "upward"
        else:
            direction = "downward"
        trends[col] = {
            "direction": direction,
            "slope": round(float(slope), 4),
            "pct_change_start_to_end": round(float(pct_change), 2),
        }
    return trends


def detect_anomalies(df: pd.DataFrame, z_thresh: float = 2.0) -> dict:
    """Flag rows where a numeric value is more than z_thresh std devs from the mean."""
    numeric = df.select_dtypes(include=[np.number])
    anomalies = {}
    for col in numeric.columns:
        series = numeric[col].dropna()
        if series.std() == 0 or len(series) < 3:
            continue
        z_scores = (series - series.mean()) / series.std()
        outlier_idx = z_scores[abs(z_scores) > z_thresh].index.tolist()
        if outlier_idx:
            anomalies[col] = {
                "outlier_row_indices": outlier_idx,
                "outlier_values": series.loc[outlier_idx].round(2).tolist(),
            }
    return anomalies


def generate_charts(df: pd.DataFrame, max_charts: int = 4) -> list:
    """Generate a handful of relevant charts and return their file paths."""
    numeric = df.select_dtypes(include=[np.number])
    chart_paths = []
    session_id = uuid.uuid4().hex[:8]

    # Line/trend charts for first few numeric columns
    for i, col in enumerate(numeric.columns[:max_charts]):
        fig, ax = plt.subplots(figsize=(6, 3.5))
        ax.plot(numeric[col].values, color="#4F46E5", linewidth=1.8)
        ax.set_title(f"{col} over records")
        ax.set_xlabel("Record index")
        ax.set_ylabel(col)
        fig.tight_layout()
        fname = f"chart_{session_id}_{i}.png"
        fpath = os.path.join(CHART_DIR, fname)
        fig.savefig(fpath, dpi=110)
        plt.close(fig)
        chart_paths.append(fpath)

    # Correlation heatmap if 2+ numeric columns
    if numeric.shape[1] >= 2:
        fig, ax = plt.subplots(figsize=(5, 4))
        corr = numeric.corr()
        im = ax.imshow(corr, cmap="coolwarm", vmin=-1, vmax=1)
        ax.set_xticks(range(len(corr.columns)))
        ax.set_yticks(range(len(corr.columns)))
        ax.set_xticklabels(corr.columns, rotation=45, ha="right", fontsize=8)
        ax.set_yticklabels(corr.columns, fontsize=8)
        fig.colorbar(im)
        ax.set_title("Correlation matrix")
        fig.tight_layout()
        fname = f"chart_{session_id}_corr.png"
        fpath = os.path.join(CHART_DIR, fname)
        fig.savefig(fpath, dpi=110)
        plt.close(fig)
        chart_paths.append(fpath)

    return chart_paths


def full_analysis(filepath: str) -> dict:
    df = load_file(filepath)
    return {
        "dataframe": df,
        "summary": summary_stats(df),
        "trends": detect_trends(df),
        "anomalies": detect_anomalies(df),
        "charts": generate_charts(df),
    }
