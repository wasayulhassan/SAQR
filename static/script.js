// ---------- panel navigation ----------
document.querySelectorAll(".rail-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".rail-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("panel-" + btn.dataset.panel).classList.add("active");
  });
});

// ---------- status check ----------
const t = (typeof saqrT === "function") ? saqrT : (key) => key;

async function checkStatus(){
  try{
    const res = await fetch("/api/status");
    const data = await res.json();
    const chip = document.getElementById("ollamaStatus");
    if(data.ollama_running){
      chip.innerHTML = '<span class="dot"></span>' + t("llm_online");
      chip.classList.add("ok");
    } else {
      chip.innerHTML = '<span class="dot"></span>' + t("llm_offline");
      chip.classList.add("down");
    }
  }catch(e){
    document.getElementById("ollamaStatus").innerHTML = '<span class="dot"></span>' + t("llm_unknown");
  }
}
checkStatus();

// ---------- chat ----------
const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
let chatHistory = [];

// ---------- lightweight markdown rendering for bot replies ----------
// Model replies come back as markdown-ish text (bold, lists, paragraphs).
// This turns that into clean, evenly-spaced HTML instead of showing the
// raw asterisks/dashes as literal characters. Escapes HTML first so
// nothing from the model (or a file's contents) can inject markup.
function escapeHtml(str){
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderInline(text){
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
  return s;
}

function renderMarkdown(raw){
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const htmlBlocks = [];
  let i = 0;

  while(i < lines.length){
    const line = lines[i];

    if(line.trim() === ""){ i++; continue; }

    // headings
    const heading = line.match(/^(#{1,6})\s+(.*)/);
    if(heading){
      htmlBlocks.push(`<p class="msg-heading">${renderInline(heading[2])}</p>`);
      i++;
      continue;
    }

    // unordered list
    if(/^\s*[-*+]\s+/.test(line)){
      const items = [];
      while(i < lines.length && /^\s*[-*+]\s+/.test(lines[i])){
        items.push(`<li>${renderInline(lines[i].replace(/^\s*[-*+]\s+/, ""))}</li>`);
        i++;
      }
      htmlBlocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // ordered list
    if(/^\s*\d+\.\s+/.test(line)){
      const items = [];
      while(i < lines.length && /^\s*\d+\.\s+/.test(lines[i])){
        items.push(`<li>${renderInline(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`);
        i++;
      }
      htmlBlocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // paragraph — collect consecutive non-blank, non-list, non-heading lines
    const para = [];
    while(
      i < lines.length && lines[i].trim() !== "" &&
      !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^#{1,6}\s+/.test(lines[i])
    ){
      para.push(renderInline(lines[i]));
      i++;
    }
    htmlBlocks.push(`<p>${para.join("<br>")}</p>`);
  }

  return htmlBlocks.join("") || `<p>${renderInline(raw)}</p>`;
}

function addMsg(text, who){
  const div = document.createElement("div");
  div.className = "msg " + (who === "user" ? "msg-user" : "msg-bot");
  const tag = document.createElement("span");
  tag.className = "msg-tag";
  tag.textContent = who === "user" ? t("you_tag") : "SAQR";
  div.appendChild(tag);

  const body = document.createElement("div");
  body.className = "msg-body";
  if(who === "user"){
    body.textContent = text; // user input stays plain, no markdown parsing needed
  } else {
    body.innerHTML = renderMarkdown(text);
  }
  div.appendChild(body);

  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if(!message) return;
  addMsg(message, "user");
  chatHistory.push({role:"user", content:message});
  chatInput.value = "";

  const thinking = document.createElement("div");
  thinking.className = "msg msg-bot";
  thinking.innerHTML = '<span class="msg-tag">SAQR</span><div class="msg-body"><span class="typing-dots"><span></span><span></span><span></span></span></div>';
  chatWindow.appendChild(thinking);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try{
    const res = await fetch("/api/chat", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({message, history: chatHistory.slice(-10)})
    });
    const data = await res.json();
    thinking.remove();
    addMsg(data.reply, "bot");
    chatHistory.push({role:"assistant", content:data.reply});
  }catch(err){
    thinking.remove();
    addMsg("⚠️ Couldn't reach the server.", "bot");
  }
});

// ---------- chat file attachment ----------
const chatAttachBtn = document.getElementById("chatAttachBtn");
const chatFileInput = document.getElementById("chatFileInput");
const chatFileChip = document.getElementById("chatFileChip");
const chatFileChipName = document.getElementById("chatFileChipName");
const chatFileChipMeta = document.getElementById("chatFileChipMeta");
const chatFileRemoveBtn = document.getElementById("chatFileRemoveBtn");

let attachedChatFile = null; // {filename, meta}

chatAttachBtn.addEventListener("click", () => chatFileInput.click());

chatFileInput.addEventListener("change", async () => {
  if(!chatFileInput.files.length) return;
  const file = chatFileInput.files[0];

  const thinking = document.createElement("div");
  thinking.className = "msg msg-bot msg-file";
  const thinkingTag = document.createElement("span");
  thinkingTag.className = "msg-tag";
  thinkingTag.textContent = "SAQR";
  const thinkingBody = document.createElement("div");
  thinkingBody.className = "msg-body";
  thinkingBody.textContent = saqrFormat("uploading_file", {filename: file.name});
  thinking.appendChild(thinkingTag);
  thinking.appendChild(thinkingBody);
  chatWindow.appendChild(thinking);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  const formData = new FormData();
  formData.append("file", file);

  try{
    const res = await fetch("/api/chat_upload", { method: "POST", body: formData });
    const data = await res.json();
    thinking.remove();

    if(!data.ok){
      addMsg(saqrFormat("file_attach_error", {error: data.error}), "bot");
      return;
    }

    attachedChatFile = { filename: data.filename, meta: data.meta };
    chatFileChipName.textContent = data.filename;
    chatFileChipMeta.textContent = data.meta;
    chatFileChip.classList.remove("hidden");
    chatAttachBtn.classList.add("has-file");

    addMsg(saqrFormat("file_attached_msg", { filename: data.filename, meta: data.meta }), "bot");
  }catch(err){
    thinking.remove();
    addMsg(saqrFormat("file_attach_error", {error: String(err)}), "bot");
  }

  chatFileInput.value = "";
});

chatFileRemoveBtn.addEventListener("click", async () => {
  if(!attachedChatFile) return;
  const removedName = attachedChatFile.filename;
  try{
    await fetch("/api/chat_file_clear", { method: "POST" });
  }catch(err){ /* best effort */ }

  attachedChatFile = null;
  chatFileChip.classList.add("hidden");
  chatAttachBtn.classList.remove("has-file");
  addMsg(saqrFormat("file_removed_msg", { filename: removedName }), "bot");
});

// ---------- analyze / upload ----------
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  if(e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => {
  if(fileInput.files.length) uploadFile(fileInput.files[0]);
});

async function uploadFile(file){
  const formData = new FormData();
  formData.append("file", file);
  dropzone.querySelector(".dropzone-inner").innerHTML = "<p>Analyzing " + file.name + "…</p>";

  try{
    const res = await fetch("/api/upload", { method:"POST", body:formData });
    const data = await res.json();
    dropzone.querySelector(".dropzone-inner").innerHTML =
      '<span class="dz-icon">⇪</span><p><b>' + file.name + '</b> loaded</p><p class="dz-hint">Click to analyze another file</p>';

    if(!data.ok){
      alert("Error: " + data.error);
      return;
    }
    renderAnalysis(data);
    document.getElementById("exportNote").classList.add("hidden");
  }catch(err){
    alert("Upload failed: " + err);
  }
}

function renderAnalysis(data){
  document.getElementById("analysisResults").classList.remove("hidden");

  // overview
  const overview = document.getElementById("overviewStats");
  overview.innerHTML = "";
  const stats = [
    {num: data.summary.rows, lbl:"rows"},
    {num: data.summary.columns.length, lbl:"columns"},
    {num: data.summary.numeric_columns.length, lbl:"numeric cols"},
  ];
  stats.forEach(s => {
    const el = document.createElement("div");
    el.className = "stat-item";
    el.innerHTML = `<div class="num">${s.num}</div><div class="lbl">${s.lbl}</div>`;
    overview.appendChild(el);
  });

  // trends
  const trendsList = document.getElementById("trendsList");
  trendsList.innerHTML = "";
  Object.entries(data.trends).forEach(([col, t]) => {
    const li = document.createElement("li");
    if(typeof t === "object"){
      const cls = t.direction === "upward" ? "up" : t.direction === "downward" ? "down" : "flat";
      li.innerHTML = `<span>${col}</span><span class="${cls}">${t.direction} · ${t.pct_change_start_to_end}%</span>`;
    } else {
      li.innerHTML = `<span>${col}</span><span class="flat">${t}</span>`;
    }
    trendsList.appendChild(li);
  });

  // anomalies
  const anomaliesList = document.getElementById("anomaliesList");
  anomaliesList.innerHTML = "";
  const anomalyEntries = Object.entries(data.anomalies);
  if(anomalyEntries.length === 0){
    const li = document.createElement("li");
    li.innerHTML = "<span>No significant anomalies detected</span>";
    anomaliesList.appendChild(li);
  } else {
    anomalyEntries.forEach(([col, info]) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${col}</span><span class="down">${info.outlier_row_indices.length} outlier(s)</span>`;
      anomaliesList.appendChild(li);
    });
  }

  // charts
  const chartsGrid = document.getElementById("chartsGrid");
  chartsGrid.innerHTML = "";
  data.chart_urls.forEach(url => {
    const img = document.createElement("img");
    img.src = url + "?t=" + Date.now();
    chartsGrid.appendChild(img);
  });

  // chart builder column dropdowns
  populateChartBuilderColumns(data.summary.columns);
}

function populateChartBuilderColumns(columns){
  const xSelect = document.getElementById("cbX");
  const ySelect = document.getElementById("cbY");
  xSelect.innerHTML = "";
  ySelect.innerHTML = "";
  columns.forEach(col => {
    const optX = document.createElement("option");
    optX.value = col; optX.textContent = col;
    xSelect.appendChild(optX);

    const optY = document.createElement("option");
    optY.value = col; optY.textContent = col;
    ySelect.appendChild(optY);
  });
}

document.getElementById("cbGenerateBtn").addEventListener("click", async () => {
  const output = document.getElementById("cbOutput");
  const chartType = document.getElementById("cbType").value;
  const xCol = document.getElementById("cbX").value;
  const yCols = Array.from(document.getElementById("cbY").selectedOptions).map(o => o.value);
  const title = document.getElementById("cbTitle").value;
  const color = document.getElementById("cbColor").value;

  if(!xCol || yCols.length === 0){
    output.innerHTML = '<span class="cb-error">Pick an X column and at least one Y column.</span>';
    return;
  }

  output.textContent = "generating…";
  try{
    const res = await fetch("/api/chart", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({chart_type: chartType, x_col: xCol, y_cols: yCols, title, color})
    });
    const data = await res.json();
    if(!data.ok){
      output.innerHTML = `<span class="cb-error">${data.error}</span>`;
      return;
    }
    output.innerHTML = `
      <img src="${data.url}?t=${Date.now()}">
      <br><a class="cb-download" href="${data.url}" download>Download image</a>
    `;
  }catch(err){
    output.innerHTML = `<span class="cb-error">Request failed: ${err}</span>`;
  }
});

// ---------- solve ----------
const solveTabs = document.querySelectorAll(".solve-tab");
const solveSimple = document.getElementById("solveSimple");
const solveOptimize = document.getElementById("solveOptimize");
let currentSolveMode = "equation";

solveTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    solveTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentSolveMode = tab.dataset.mode;
    if(currentSolveMode === "optimize"){
      solveSimple.classList.add("hidden");
      solveOptimize.classList.remove("hidden");
    } else {
      solveSimple.classList.remove("hidden");
      solveOptimize.classList.add("hidden");
      const labelHint = {
        equation: "e.g. x**2 - 4 = 0",
        simplify: "e.g. (x**2 - 1)/(x - 1)",
        derivative: "e.g. x**3 + 2*x",
        integral: "e.g. 2*x + 3",
      };
      document.querySelector("#solveSimple .hint").textContent = labelHint[currentSolveMode] || "";
    }
  });
});

document.getElementById("solveRunBtn").addEventListener("click", async () => {
  const expr = document.getElementById("solveExpr").value.trim();
  const varName = document.getElementById("solveVar").value.trim() || "x";
  const output = document.getElementById("solveOutput");
  if(!expr){ output.textContent = "Enter an expression first."; return; }
  output.textContent = "computing…";

  const payloadMap = {
    equation: {problem_type:"equation", expr_str: expr, var_str: varName},
    simplify: {problem_type:"simplify", expr_str: expr},
    derivative: {problem_type:"derivative", expr_str: expr, var_str: varName},
    integral: {problem_type:"integral", expr_str: expr, var_str: varName},
  };

  try{
    const res = await fetch("/api/solve", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payloadMap[currentSolveMode])
    });
    const data = await res.json();
    if(!data.ok){ output.textContent = "Error: " + data.error; return; }
    if(currentSolveMode === "equation"){
      output.textContent = "Solutions: " + JSON.stringify(data.solutions);
    } else {
      output.textContent = "Result: " + data.result;
    }
  }catch(err){
    output.textContent = "Request failed: " + err;
  }
});

document.getElementById("optimizeRunBtn").addEventListener("click", async () => {
  const output = document.getElementById("optimizeOutput");
  const cRaw = document.getElementById("optC").value.trim();
  const aRaw = document.getElementById("optA").value.trim();
  if(!cRaw || !aRaw){ output.textContent = "Fill in both fields."; return; }

  const c = cRaw.split(",").map(Number);
  const lines = aRaw.split("\n").map(l => l.trim()).filter(Boolean);
  const A_ub = [], b_ub = [];
  for(const line of lines){
    const [coefPart, rhsPart] = line.split("|");
    A_ub.push(coefPart.split(",").map(Number));
    b_ub.push(Number(rhsPart));
  }

  output.textContent = "computing…";
  try{
    const res = await fetch("/api/solve", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({problem_type:"optimize", c, A_ub, b_ub, maximize:true})
    });
    const data = await res.json();
    if(!data.ok){ output.textContent = "Error: " + data.error; return; }
    output.textContent = `x = ${JSON.stringify(data.x)}\nObjective value = ${data.objective_value}`;
  }catch(err){
    output.textContent = "Request failed: " + err;
  }
});

// ---------- export ----------
async function generateExport(kind){
  const titleInput = document.getElementById(kind === "report" ? "reportTitle" : "pptTitle");
  const statusEl = document.getElementById(kind === "report" ? "reportStatus" : "pptStatus");
  statusEl.textContent = "generating…";
  try{
    const res = await fetch("/api/" + kind, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({title: titleInput.value})
    });
    const data = await res.json();
    if(!data.ok){ statusEl.textContent = "Error: " + data.error; return; }
    statusEl.innerHTML = `Ready → <a href="${data.download_url}" style="color:var(--amber)">Download</a>`;
  }catch(err){
    statusEl.textContent = "Request failed: " + err;
  }
}

document.getElementById("reportBtn").addEventListener("click", () => generateExport("report"));
document.getElementById("pptBtn").addEventListener("click", () => generateExport("ppt"));

// ---------- dashboard quick actions ----------
document.querySelectorAll(".qa-card[data-goto]").forEach(card => {
  card.addEventListener("click", () => {
    const target = document.querySelector('.rail-btn[data-panel="' + card.dataset.goto + '"]');
    if(target) target.click();
  });
});
