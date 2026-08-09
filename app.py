import os
import sys
import json
import traceback
from flask import Flask, request, jsonify, render_template, send_file

sys.path.insert(0, os.path.dirname(__file__))
from modules import (
    chatbot, analyzer, solver, report_gen, ppt_gen, chart_builder,
    file_context, ai_ppt, ppt_themes, web_search, report_chat,
)

app = Flask(__name__)
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# SAQR is one app split into three chat surfaces (mode = "master" | "report"
# | "ppt"), each with its own attached file / analysis state so they don't
# clash with each other. All state is single-process, in-memory (single-user
# local app) — nothing here is a database.
# ---------------------------------------------------------------------------
CHAT_MODES = ("master", "report", "ppt")
CHAT_FILES = {m: {} for m in CHAT_MODES}      # mode -> {"data": file_context-shaped dict}
CHAT_ANALYSIS = {}                            # mode -> analyzer.full_analysis() output, when a
                                               # tabular file (csv/xlsx/xls) was uploaded in that chat

# Kept for the legacy (currently unused by the frontend) single-page
# analyze/report/ppt/chart routes below, so that functionality still works
# under the hood if a future UI wants to call it again.
LAST_ANALYSIS = {}


def _clean_mode(mode):
    return mode if mode in CHAT_MODES else "master"


@app.route("/")
def index():
    return render_template("index.html")


def _build_data_context():
    """Compact summary of the currently loaded dataset, if any, for the
    chatbot to ground its answers in — not the raw rows, just shape/stats."""
    if "data" not in LAST_ANALYSIS:
        return None
    a = LAST_ANALYSIS["data"]
    return {
        "rows": a["summary"]["rows"],
        "columns": a["summary"]["columns"],
        "numeric_columns": a["summary"]["numeric_columns"],
        "trends": a["trends"],
        "anomaly_counts": {
            col: len(info["outlier_row_indices"]) for col, info in a["anomalies"].items()
        },
    }


@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json(force=True)
    message = data.get("message", "")
    history = data.get("history", [])
    mode = _clean_mode(data.get("mode", "master"))
    web_results = data.get("web_results")  # client already ran /api/web_search for this turn, if triggered
    weather = data.get("weather")          # client already fetched live weather for this turn, if triggered

    chart_info = None
    chart_url = None
    if CHAT_ANALYSIS.get(mode):
        analysis = CHAT_ANALYSIS[mode]
        spec = report_chat.maybe_build_chart(
            message, analysis["dataframe"], analysis["summary"]["numeric_columns"]
        )
        if spec:
            result = chart_builder.build_chart(analysis["dataframe"], **spec)
            if result.get("ok"):
                chart_url = result["url"]
                chart_info = spec

    reply = chatbot.chat(
        message,
        history=history,
        data_context=_build_data_context(),
        file_context=CHAT_FILES.get(mode, {}).get("data"),
        web_context=web_results,
        weather_context=weather,
        mode=mode,
        chart_info=chart_info,
    )
    return jsonify({"reply": reply, "chart_url": chart_url})


@app.route("/api/web_search", methods=["POST"])
def api_web_search():
    """Free, no-key web search — used both to ground a single chat reply in
    current information, and to research a topic from scratch for the
    presentation wizard when no file is attached."""
    data = request.get_json(force=True)
    query = (data.get("query") or "").strip()
    if not query:
        return jsonify({"ok": False, "error": "No search query given"}), 400
    results = web_search.search(query)
    return jsonify({"ok": True, "results": results, "query": query})


def _process_chat_upload(f, mode):
    """Shared by every 'attach a file in this chat' endpoint. Tabular files
    (CSV/Excel) get the full analyzer pipeline — stats, trends, anomalies,
    auto-generated charts — stored per-mode in CHAT_ANALYSIS, so that chat
    (in ANY of the three surfaces, not just Report & Analysis) can build
    charts on request and generate a Word report from it. Other file types
    fall back to lighter text extraction for a grounded conversation."""
    save_path = os.path.join(UPLOAD_DIR, f.filename)
    f.save(save_path)
    ext = f.filename.lower().rsplit(".", 1)[-1] if "." in f.filename else ""

    chart_urls, trends, anomaly_counts = [], None, None

    if ext in ("csv", "xlsx", "xls"):
        analysis = analyzer.full_analysis(save_path)
        CHAT_ANALYSIS[mode] = analysis
        ctx = {
            "type": "spreadsheet",
            "filename": f.filename,
            "meta": f"{analysis['summary']['rows']} rows × {len(analysis['summary']['columns'])} columns",
            "content_text": (
                f"Columns: {', '.join(analysis['summary']['columns'])}\n"
                f"Numeric columns: {', '.join(analysis['summary']['numeric_columns']) or 'none'}"
            ),
            "truncated": False,
        }
        chart_urls = ["/static/charts/" + os.path.basename(c) for c in analysis["charts"]]
        trends = analysis["trends"]
        anomaly_counts = {
            col: len(info["outlier_row_indices"]) for col, info in analysis["anomalies"].items()
        }
    else:
        CHAT_ANALYSIS[mode] = None
        ctx = file_context.extract_context(save_path, f.filename)

    ctx["save_path"] = save_path
    CHAT_FILES[mode] = {"data": ctx}

    return {
        "ok": True,
        "filename": ctx["filename"],
        "meta": ctx["meta"],
        "type": ctx["type"],
        "truncated": ctx["truncated"],
        "trends": trends,
        "anomaly_counts": anomaly_counts,
        "chart_urls": chart_urls,
    }


@app.route("/api/chat_upload", methods=["POST"])
def api_chat_upload():
    """Attach a file directly in the Chat or PowerPoint surface. If it's a
    spreadsheet, this now runs the same full analysis pipeline as Report &
    Analysis (see _process_chat_upload) — so a spreadsheet attached in the
    master Chat can also get charts and a Word report generated from it,
    right there in the conversation."""
    if "file" not in request.files:
        return jsonify({"ok": False, "error": "No file uploaded"}), 400
    f = request.files["file"]
    if f.filename == "":
        return jsonify({"ok": False, "error": "Empty filename"}), 400
    mode = _clean_mode(request.form.get("mode", "master"))

    try:
        result = _process_chat_upload(f, mode)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 400

    return jsonify(result)


@app.route("/api/chat_file_clear", methods=["POST"])
def api_chat_file_clear():
    data = request.get_json(silent=True) or {}
    mode = _clean_mode(data.get("mode", "master"))
    CHAT_FILES.pop(mode, None)
    CHAT_ANALYSIS[mode] = None
    return jsonify({"ok": True})


@app.route("/api/chat_generate_presentation", methods=["POST"])
def api_chat_generate_presentation():
    """The chat-driven 'make me a presentation' flow: takes the guided-
    wizard answers collected client-side, asks the model for a custom
    outline (with its own opinion/rationale), picks a visual theme, builds
    real charts from the file's data where relevant, and generates the
    .pptx. Used by both the PowerPoint chat and the master Chat."""
    data = request.get_json(silent=True) or {}
    mode = _clean_mode(data.get("mode", "ppt"))
    file_ctx = CHAT_FILES.get(mode, {}).get("data")
    answers = data.get("answers", {})

    if not file_ctx:
        # No file attached — build a deck straight from a topic via web research
        topic = (answers.get("topic") or "").strip()
        if not topic:
            return jsonify({"ok": False, "error": "Attach a file, or tell me a topic to research"}), 400
        try:
            results = web_search.search(topic)
        except Exception as e:
            traceback.print_exc()
            return jsonify({"ok": False, "error": f"Web search failed: {e}"}), 500
        if not results:
            return jsonify({"ok": False, "error": "Couldn't find anything on the web for that topic right now — try again shortly, or attach a file instead"}), 502
        file_ctx = web_search.build_web_file_context(topic, results)

    try:
        outline = ai_ppt.build_outline(file_ctx, answers)
        theme = ppt_themes.pick_theme(answers.get("style"))
        fpath = ai_ppt.generate_presentation(
            outline, theme, file_ctx, saved_filepath=file_ctx.get("save_path")
        )
    except Exception as e:
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 500

    return jsonify({
        "ok": True,
        "download_url": f"/api/download/{os.path.basename(fpath)}",
        "title": outline.get("title", "Presentation"),
        "rationale": outline.get("rationale", ""),
        "theme_label": theme.get("label", ""),
        "slide_count": len(outline.get("slides", [])) + 2,  # + title + closing
        "sources": file_ctx.get("sources", []),
    })


@app.route("/api/report_upload", methods=["POST"])
def api_report_upload():
    """Upload for the Report & Analysis chat — same pipeline as
    /api/chat_upload (see _process_chat_upload), always scoped to the
    "report" mode."""
    if "file" not in request.files:
        return jsonify({"ok": False, "error": "No file uploaded"}), 400
    f = request.files["file"]
    if f.filename == "":
        return jsonify({"ok": False, "error": "Empty filename"}), 400

    try:
        result = _process_chat_upload(f, "report")
    except Exception as e:
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 400

    return jsonify(result)


@app.route("/api/report_generate", methods=["POST"])
def api_report_generate():
    """Build a Word report from whatever's currently loaded in the given
    chat (master or report — needs a spreadsheet uploaded in that same
    chat first, so it has real data to build from)."""
    data = request.get_json(silent=True) or {}
    mode = _clean_mode(data.get("mode", "report"))
    analysis = CHAT_ANALYSIS.get(mode)
    if not analysis:
        return jsonify({
            "ok": False,
            "error": "Upload a CSV or Excel file in this chat first — Word reports need tabular data",
        }), 400
    file_ctx = CHAT_FILES.get(mode, {}).get("data", {})
    default_title = f"{file_ctx.get('filename', 'Data')} — Analysis Report"
    title = data.get("title") or default_title
    fpath = report_gen.build_report(analysis, title)
    return jsonify({"ok": True, "download_url": f"/api/download/{os.path.basename(fpath)}"})


# ---------------------------------------------------------------------------
# Legacy single-page routes (Analyze Data / Problem Solver / Reports & Decks
# tabs). Nothing in the current UI calls these anymore now that everything
# lives in the three chat surfaces above, but the underlying logic is kept
# working here in case a future UI wants those standalone tools back.
# ---------------------------------------------------------------------------

@app.route("/api/upload", methods=["POST"])
def api_upload():
    if "file" not in request.files:
        return jsonify({"ok": False, "error": "No file uploaded"}), 400
    f = request.files["file"]
    if f.filename == "":
        return jsonify({"ok": False, "error": "Empty filename"}), 400

    save_path = os.path.join(UPLOAD_DIR, f.filename)
    f.save(save_path)

    try:
        analysis = analyzer.full_analysis(save_path)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"ok": False, "error": str(e)}), 400

    LAST_ANALYSIS["data"] = analysis

    chart_urls = [
        "/static/charts/" + os.path.basename(c) for c in analysis["charts"]
    ]

    return jsonify({
        "ok": True,
        "summary": analysis["summary"],
        "trends": analysis["trends"],
        "anomalies": analysis["anomalies"],
        "chart_urls": chart_urls,
    })


@app.route("/api/report", methods=["POST"])
def api_report():
    if "data" not in LAST_ANALYSIS:
        return jsonify({"ok": False, "error": "Upload and analyze a file first"}), 400
    title = request.get_json(silent=True) or {}
    fpath = report_gen.build_report(LAST_ANALYSIS["data"], title.get("title", "Data Analysis Report"))
    return jsonify({"ok": True, "download_url": f"/api/download/{os.path.basename(fpath)}"})


@app.route("/api/ppt", methods=["POST"])
def api_ppt():
    if "data" not in LAST_ANALYSIS:
        return jsonify({"ok": False, "error": "Upload and analyze a file first"}), 400
    title = request.get_json(silent=True) or {}
    fpath = ppt_gen.build_presentation(LAST_ANALYSIS["data"], title.get("title", "Data Analysis"))
    return jsonify({"ok": True, "download_url": f"/api/download/{os.path.basename(fpath)}"})


@app.route("/api/download/<fname>")
def api_download(fname):
    fpath = os.path.join(os.path.dirname(__file__), "outputs", fname)
    if not os.path.exists(fpath):
        return jsonify({"ok": False, "error": "File not found"}), 404
    return send_file(fpath, as_attachment=True)


@app.route("/api/solve", methods=["POST"])
def api_solve():
    data = request.get_json(force=True)
    problem_type = data.pop("problem_type", None)
    result = solver.solve(problem_type, **data)
    return jsonify(result)


@app.route("/api/chart", methods=["POST"])
def api_chart():
    if "data" not in LAST_ANALYSIS:
        return jsonify({"ok": False, "error": "Upload and analyze a file first"}), 400
    data = request.get_json(force=True)
    df = LAST_ANALYSIS["data"]["dataframe"]
    result = chart_builder.build_chart(
        df,
        chart_type=data.get("chart_type", ""),
        x_col=data.get("x_col", ""),
        y_cols=data.get("y_cols", []),
        title=data.get("title", ""),
        color=data.get("color") or None,
    )
    return jsonify(result)


@app.route("/api/status")
def api_status():
    return jsonify({"ollama_running": chatbot.is_ollama_running()})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
