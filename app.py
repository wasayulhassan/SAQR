import os
import sys
import json
import traceback
from flask import Flask, request, jsonify, render_template, send_file

sys.path.insert(0, os.path.dirname(__file__))
from modules import chatbot, analyzer, solver, report_gen, ppt_gen

app = Flask(__name__)
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Keep last analysis in memory per simple session (single-user local app)
LAST_ANALYSIS = {}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json(force=True)
    message = data.get("message", "")
    history = data.get("history", [])
    reply = chatbot.chat(message, history=history)
    return jsonify({"reply": reply})


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


@app.route("/api/status")
def api_status():
    return jsonify({"ollama_running": chatbot.is_ollama_running()})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
