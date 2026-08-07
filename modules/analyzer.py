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


def _detect_header_row(raw: pd.DataFrame, max_scan: int = 15) -> int:
    """Scan the first `max_scan` rows and guess which one is the real header —
    the row most likely to be all-text labels rather than data."""
    best_idx, best_score = 0, -1
    scan_rows = min(max_scan, len(raw))
    for i in range(scan_rows):
        row = raw.iloc[i]
        non_null = row.notna().sum()
        text_like = row.apply(lambda v: isinstance(v, str) and v.strip() != "").sum()
        numeric_like = row.apply(lambda v: isinstance(v, (int, float)) and not pd.isna(v)).sum()
        # Header rows: mostly text, few/no numbers, reasonably full row
        score = (text_like * 2) - numeric_like + non_null
        if score > best_score:
            best_score = score
            best_idx = i
    return best_idx


def _clean_messy_dataframe(raw: pd.DataFrame) -> pd.DataFrame:
    """Take a raw, header-less read and turn it into a clean, typed DataFrame:
    finds the real header row, drops junk rows/columns, strips whitespace,
    and coerces mostly-numeric text columns to actual numbers."""
    if raw.empty:
        return raw

    header_idx = _detect_header_row(raw)
    columns = raw.iloc[header_idx].fillna("").astype(str).str.strip()
    columns = [c if c else f"column_{i}" for i, c in enumerate(columns)]

    data = raw.iloc[header_idx + 1:].copy()
    data.columns = columns

    # Drop fully-empty rows/columns (common in exported/messy sheets)
    data = data.dropna(axis=0, how="all").dropna(axis=1, how="all")
    data = data.reset_index(drop=True)

    # Strip whitespace from string cells
    for col in data.columns:
        if data[col].dtype == object:
            data[col] = data[col].apply(lambda v: v.strip() if isinstance(v, str) else v)

    # Coerce columns that are mostly numeric (allowing some stray text/blank
    # cells) into real numeric dtype, so stats/trends/anomalies pick them up
    for col in data.columns:
        if data[col].dtype == object:
            coerced = pd.to_numeric(
                data[col].astype(str).str.replace(",", "", regex=False).str.strip(),
                errors="coerce",
            )
            non_null_ratio = coerced.notna().sum() / max(data[col].notna().sum(), 1)
            if non_null_ratio > 0.7:
                data[col] = coerced

    # De-duplicate any repeated column names (messy exports sometimes have these)
    seen = {}
    new_cols = []
    for c in data.columns:
        if c in seen:
            seen[c] += 1
            new_cols.append(f"{c}_{seen[c]}")
        else:
            seen[c] = 0
            new_cols.append(c)
    data.columns = new_cols

    return data


def load_file(filepath: str) -> pd.DataFrame:
    """Load a CSV or Excel file — robust to messy real-world exports:
    junk rows above the header, blank rows/columns, numbers stored as text
    with stray commas, multiple sheets (first non-empty sheet is used)."""
    ext = filepath.lower().rsplit(".", 1)[-1]

    if ext == "csv":
        raw = pd.read_csv(filepath, header=None, dtype=object)
    elif ext in ("xlsx", "xls"):
        xls = pd.ExcelFile(filepath)
        raw = None
        for sheet_name in xls.sheet_names:
            candidate = pd.read_excel(xls, sheet_name=sheet_name, header=None, dtype=object)
            if not candidate.dropna(how="all").empty:
                raw = candidate
                break
        if raw is None:
            raw = pd.read_excel(xls, sheet_name=xls.sheet_names[0], header=None, dtype=object)
    else:
        raise ValueError(f"Unsupported file type: .{ext}")

    return _clean_messy_dataframe(raw)


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
