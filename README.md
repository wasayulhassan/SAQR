# SAQR — Local Analysis Console

*(صقر — "Falcon" in Arabic, the UAE's national bird)*

A website that runs entirely on your machine: data analysis, Word report
generation, PowerPoint generation, and math/logic problem solving — plus a
general-purpose chatbot powered by a **local** LLM (no API keys, no cost).

## What it does

- **Chat** — ask general questions, answered by a local LLM (via Ollama)
- **Analyze** — upload a CSV/Excel file → get summary stats, trend
  detection, anomaly flags, and auto-generated charts
- **Solve** — solve equations, simplify expressions, take derivatives/
  integrals, and solve linear optimization problems (exact math, via sympy/scipy)
- **Export** — turn your last analysis into a Word report (.docx) or a
  PowerPoint deck (.pptx), auto-built with the stats, trends, and charts

## Setup

### 1. Install Python dependencies

```bash
cd jarvis2
pip install -r requirements.txt
```

### 2. (Optional but recommended) Install Ollama for the chat feature

The Analyze / Solve / Export tools work with **no extra setup**. Only the
free-form Chat tab needs a local LLM:

1. Download Ollama: https://ollama.com/download
2. Pull a model (one-time):
   ```bash
   ollama pull llama3.2
   ```
3. Ollama runs its own local server automatically on `http://localhost:11434`
   — the app talks to it directly, nothing else to configure.

If Ollama isn't installed or running, the Chat tab will tell you so and
everything else still works normally.

### 3. Run the app

```bash
python3 app.py
```

Then open **http://localhost:5000** in your browser (works fine on mobile
browsers on the same network too — use your machine's local IP instead of
`localhost`, e.g. `http://192.168.1.23:5000`).

## Project structure

```
jarvis2/
├── app.py                 # Flask app / routes
├── requirements.txt
├── modules/
│   ├── chatbot.py          # talks to local Ollama LLM
│   ├── analyzer.py         # pandas-based data analysis + charts
│   ├── solver.py           # sympy/scipy math & optimization
│   ├── report_gen.py       # builds .docx reports
│   └── ppt_gen.py          # builds .pptx decks
├── templates/
│   └── index.html
├── static/
│   ├── style.css
│   ├── script.js
│   └── charts/              # generated chart images (auto-created)
├── uploads/                 # uploaded data files (auto-created)
└── outputs/                 # generated .docx/.pptx files (auto-created)
```

## Notes / next steps you might want

- Currently single-user (last analysis is kept in server memory) — fine for
  local/personal use. For multi-user, swap `LAST_ANALYSIS` for a proper
  per-session store.
- The optimizer only handles **linear** problems for now. Nonlinear
  optimization (scipy.optimize.minimize) can be added the same way.
- Anomaly detection uses a simple z-score method — swap in IsolationForest
  or similar from scikit-learn for larger/messier datasets.
- To deploy properly (not just `python3 app.py`), run behind gunicorn/waitress.
