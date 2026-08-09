// ============================================================================
// SAQR — three independent chat surfaces (Chat / Report & Analysis /
// PowerPoint), each built by createChatSurface() below from a shared
// template of behavior, with per-surface local state (messages, attached
// file, wizard, voice) and a locally-stored (per-browser) list of past
// conversations in its own sidebar.
// ============================================================================

// ---------- panel navigation ----------
let chatSurfaceInstances = []; // filled in as each surface is created, used to stop voice when switching tabs

document.querySelectorAll(".rail-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    chatSurfaceInstances.forEach(s => s.stopVoice());
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

// ---------- shared: web search trigger ----------
// Broad on purpose — this decides whether SAQR actually reaches out to the
// web before answering, so it's better to search a little too often than to
// miss a question that needed live data and let the model guess/hallucinate.
const WEB_SEARCH_TRIGGER_RE = /\b(search( the web| online)?|look ?up|google|find (out|info|information) about|what'?s (the )?(latest|current|newest|recent)|current (price|status|news|weather|version|events?)|latest (news|update|updates|version|release|info|information)|recent(ly)?|up[- ]?to[- ]?date|breaking news|who (is|are) the (current )?(ceo|president|prime minister|leader)|as of (today|now|this (week|month|year))|right now|these days|nowadays|today'?s|this (week|month|year)|real[- ]?time|live (score|update|data)|what'?s happening|what happened (to|with|in)|(stock|share) price|exchange rate|weather (in|today|forecast)|election results?|just (announced|released|launched)|newly released|any (news|updates?) (on|about)|has .* (happened|changed|launched|released))\b/i;

// Beyond the phrase-based regex above, any year mention close to "now" reads
// as a request for current information too ("updates from 2026", "in 2025")
// — catches natural phrasing the trigger phrases above don't cover.
function messageWantsLiveData(message){
  if(WEB_SEARCH_TRIGGER_RE.test(message)) return true;
  const yearMatch = message.match(/\b(20[0-9]{2})\b/);
  if(yearMatch){
    const thisYear = new Date().getFullYear();
    const y = parseInt(yearMatch[1], 10);
    if(y >= thisYear - 1 && y <= thisYear + 1) return true;
  }
  return false;
}

// ---------- shared: weather (browser geolocation + a free weather API) ----------
const WEATHER_TRIGGER_RE = /\b(weather|temperature outside|is it raining|is it snowing|how (hot|cold) (is it|out)|forecast)\b/i;
const WEATHER_CODES = {
  0: "clear sky", 1: "mostly clear", 2: "partly cloudy", 3: "overcast",
  45: "fog", 48: "depositing rime fog",
  51: "light drizzle", 53: "moderate drizzle", 55: "dense drizzle",
  61: "light rain", 63: "moderate rain", 65: "heavy rain",
  71: "light snow", 73: "moderate snow", 75: "heavy snow",
  80: "light rain showers", 81: "moderate rain showers", 82: "violent rain showers",
  95: "thunderstorm", 96: "thunderstorm with hail", 99: "thunderstorm with heavy hail",
};

let cachedLocation = null; // {lat, lon, city} — cached for the page session so we only prompt once

function getLocation(){
  if(cachedLocation) return Promise.resolve(cachedLocation);
  if(!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let city = "";
        try{
          const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
          const data = await res.json();
          city = data.city || data.locality || data.principalSubdivision || "";
        }catch(e){ /* best effort — weather still works without a city name */ }
        cachedLocation = { lat: latitude, lon: longitude, city };
        resolve(cachedLocation);
      },
      () => resolve(null),                 // permission denied / unavailable
      { timeout: 8000, maximumAge: 600000 }
    );
  });
}

async function fetchWeather(){
  const loc = await getLocation();
  if(!loc) return null;
  try{
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current_weather=true&temperature_unit=celsius&windspeed_unit=kmh`);
    const data = await res.json();
    const cw = data.current_weather;
    if(!cw) return null;
    return {
      city: loc.city || null,
      temperature: cw.temperature,
      unit: "°C",
      condition: WEATHER_CODES[cw.weathercode] || "",
      wind_speed: cw.windspeed,
      wind_unit: "km/h",
    };
  }catch(e){
    return null;
  }
}

// ---------- shared: voice (speech-to-text + text-to-speech) ----------
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

function speechLangCode(){
  const lang = (typeof SAQR_CURRENT_LANG !== "undefined" && SAQR_CURRENT_LANG) || "en";
  const map = { en: "en-US", ar: "ar-SA", ur: "ur-PK", hi: "hi-IN" };
  return map[lang] || "en-US";
}

// Rates how human/natural a browser voice is likely to sound, purely from
// its metadata (there's no way to actually hear it ahead of time). Cloud/
// network voices and ones vendors label "Natural"/"Neural" rank highest;
// classic offline synthesizers (eSpeak, Festival, old "Desktop" SAPI
// voices) — the ones people usually mean by "sounds like a robot" — rank
// lowest, but aren't excluded outright in case it's all a device has.
function scoreVoice(v){
  let score = 0;
  if(v.localService === false) score += 3;
  if(/neural|natural/i.test(v.name)) score += 4;
  if(/premium|enhanced|plus|pro\b/i.test(v.name)) score += 2;
  if(/google|online|microsoft (?!.*desktop)/i.test(v.name)) score += 1;
  if(/espeak|festival|pico|compact|robotic|legacy/i.test(v.name)) score -= 4;
  if(/desktop/i.test(v.name)) score -= 2;
  return score;
}

let ttsVoices = [];
let selectedVoiceURI = localStorage.getItem("saqr_voice_uri") || "";
let allVoiceSelects = []; // every <select class="voice-select"> across the 3 surfaces, kept in sync

function populateAllVoiceSelects(){
  allVoiceSelects.forEach(populateVoiceSelect);
}

function populateVoiceSelect(selectEl){
  if(!selectEl) return;
  const langPrefix = speechLangCode().split("-")[0];
  const matching = ttsVoices.filter(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix));
  const list = (matching.length ? matching : ttsVoices).slice().sort((a, b) => scoreVoice(b) - scoreVoice(a));

  selectEl.innerHTML = "";
  const autoOpt = document.createElement("option");
  autoOpt.value = "";
  autoOpt.textContent = saqrT("voice_auto_label");
  selectEl.appendChild(autoOpt);

  list.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v.voiceURI;
    opt.textContent = v.name + (v.lang ? ` (${v.lang})` : "");
    selectEl.appendChild(opt);
  });
  selectEl.value = (selectedVoiceURI && list.some(v => v.voiceURI === selectedVoiceURI)) ? selectedVoiceURI : "";
}

function loadTtsVoices(){
  if(!("speechSynthesis" in window)) return;
  ttsVoices = window.speechSynthesis.getVoices();
  populateAllVoiceSelects();
}

if("speechSynthesis" in window){
  loadTtsVoices();
  window.speechSynthesis.onvoiceschanged = loadTtsVoices; // most browsers load voices async
}

function pickBestVoice(){
  if(!ttsVoices.length) return null;
  if(selectedVoiceURI){
    const chosen = ttsVoices.find(v => v.voiceURI === selectedVoiceURI);
    if(chosen) return chosen;
  }
  const langPrefix = speechLangCode().split("-")[0];
  const candidates = ttsVoices.filter(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix));
  const pool = candidates.length ? candidates : ttsVoices;
  if(!pool.length) return null;
  return pool.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

function stripMarkdownForSpeech(text){
  return String(text || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\[(\d+)\]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Re-filter every registered voice list when the UI language changes.
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#langSwitch button").forEach(btn => {
    btn.addEventListener("click", () => populateAllVoiceSelects());
  });
});

// ---------- presentation wizard: shared constants ----------
const WIZARD_STEPS = [
  { key: "purpose", type: "text", promptKey: "wiz_q_purpose", placeholderKey: "wiz_q_purpose_placeholder" },
  { key: "tone", type: "choice", promptKey: "wiz_q_tone", choices: [
      { value: "formal", labelKey: "wiz_tone_formal" },
      { value: "casual", labelKey: "wiz_tone_casual" },
      { value: "academic", labelKey: "wiz_tone_academic" },
      { value: "creative", labelKey: "wiz_tone_creative" },
    ]},
  { key: "slide_count", type: "choice", promptKey: "wiz_q_slides", choices: [
      { value: "5", labelKey: "wiz_slides_5" },
      { value: "8", labelKey: "wiz_slides_8" },
      { value: "12", labelKey: "wiz_slides_12" },
      { value: "auto", labelKey: "wiz_slides_auto" },
    ]},
  { key: "style", type: "choice", promptKey: "wiz_q_style", choices: [
      { value: "minimal", labelKey: "wiz_style_minimal" },
      { value: "bold", labelKey: "wiz_style_bold" },
      { value: "classic", labelKey: "wiz_style_classic" },
      { value: "surprise", labelKey: "wiz_style_surprise" },
    ]},
  { key: "extra", type: "text", promptKey: "wiz_q_extra", placeholderKey: "wiz_q_extra_placeholder", skippable: true },
];

const TOPIC_STEP = { key: "topic", type: "text", promptKey: "wiz_q_topic", placeholderKey: "wiz_q_topic_placeholder" };

const PRESENTATION_TRIGGER_RE = /\b(make|create|build|generate|design|turn this into)\b.{0,60}\b(presentation|slides?|slide ?deck|powerpoint|ppt)\b|\b(presentation|slides?|slide ?deck|powerpoint)\b.{0,40}\b(from|based on|using|out of|for|about)\b.{0,15}\b(this|it|file|attached|attachment)\b/i;

// ---------- shared: "make me a Word report" trigger (master + report chats) ----------
const REPORT_TRIGGER_RE = /\b(word (doc(ument)?|report)|generate (me )?(a |the )?report|make (me )?(a |the )?(word )?report|create (a |the )?(word )?report|build (me )?(a |the )?(word )?report|write (me )?(a |the )?(word )?report|put together (a |the )?(word )?report|export (this )?as (a |an )?(word )?(doc(ument)?|report)|download (a |the )?(word )?report|report (as|in) word)\b/i;

function extractTopicFromMessage(message){
  const m = (message || "").match(/\b(?:presentation|slides?|slide ?deck|powerpoint|ppt)\b\s*(?:on|about|regarding|covering)\s+(.+?)[\s.!?]*$/i);
  if(!m) return null;
  const candidate = m[1].trim();
  if(!candidate) return null;
  if(/^(this|it|that|the file|my file|the attached( file)?|attached|the attachment|this file|this data|that file)$/i.test(candidate)) return null;
  return candidate;
}

// ============================================================================
// createChatSurface — builds one fully independent chat (messages, attached
// file, wizard, voice, local history) scoped to everything inside panelEl.
// ============================================================================
function createChatSurface(panelEl, mode, opts){
  opts = Object.assign({
    enableWizard: false,       // presentation wizard (master + ppt)
    rawMessageIsTopic: false,  // ppt: any message with no file = the topic itself
    enableWebSearch: false,    // master + report
    enableWeather: false,      // master only
    enableReportGen: false,    // master + report — "make me a word report" as plain text
    uploadEndpoint: "/api/chat_upload",
  }, opts || {});

  const q = (sel) => panelEl.querySelector(sel);

  const chatWindow = q(".chat-window");
  const chatForm = q(".chat-input-row");
  const chatInput = q(".chat-input");
  const attachBtn = q(".attach-btn");
  const fileInput = q(".chat-file-input");
  const fileChip = q(".chat-file-chip");
  const chipName = q(".chip-name");
  const chipMeta = q(".chip-meta");
  const chipRemoveBtn = q(".chip-remove");
  const chipPptBtn = q(".chip-ppt-btn");
  const chipReportBtn = q(".chip-report-btn");
  const webSearchBtn = q(".web-search-btn");
  const micBtn = q(".mic-btn");
  const voiceModeBtn = q(".voice-mode-btn");
  const voiceModeBanner = q(".voice-mode-banner");
  const voiceModeStatus = q(".voice-mode-status");
  const voiceModeStopBtn = q(".voice-mode-stop");
  const voiceSelect = q(".voice-select");
  const historyNewBtn = q(".chat-history-new");
  const historyListEl = q(".chat-history-list");
  const introKey = q(".msg-bot span[data-i18n]") ? q(".msg-bot span[data-i18n]").getAttribute("data-i18n") : "chat_intro";

  if(voiceSelect) allVoiceSelects.push(voiceSelect);

  // ---- per-surface state ----
  let chatMessages = [];      // [{role, content, sources, chartUrl}]
  let attachedFile = null;    // {filename, meta}
  let currentChatId = null;
  let webSearchActive = false;
  let micRecognition = null, micListening = false;
  let voiceModeActive = false, voiceModeRecognition = null;
  function stopVoiceLocal(){
    stopVoiceModeInternal();
    if(micListening){ micRecognition && micRecognition.stop(); }
  }
  let ppWizard = null;        // { stepIndex, answers, steps }

  const historyKey = "saqr_history_" + mode;

  // ---------------- local per-browser chat history ----------------
  function loadHistoryStore(){
    try{ return JSON.parse(localStorage.getItem(historyKey) || "[]"); }catch(e){ return []; }
  }
  function saveHistoryStore(list){
    try{ localStorage.setItem(historyKey, JSON.stringify(list)); }catch(e){ /* storage full/unavailable — best effort */ }
  }
  function titleFromMessages(){
    const firstUser = chatMessages.find(m => m.role === "user");
    if(!firstUser || !firstUser.content) return saqrT("history_untitled");
    const text = firstUser.content.trim();
    return text.length > 42 ? text.slice(0, 42) + "…" : text;
  }
  function persistCurrentChat(){
    if(!chatMessages.length || !currentChatId) return;
    const list = loadHistoryStore();
    const idx = list.findIndex(c => c.id === currentChatId);
    const chatObj = {
      id: currentChatId,
      title: titleFromMessages(),
      updatedAt: Date.now(),
      messages: chatMessages,
      attachedFile: attachedFile,
    };
    if(idx >= 0) list[idx] = chatObj; else list.unshift(chatObj);
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    saveHistoryStore(list.slice(0, 50)); // cap so localStorage doesn't grow unbounded
    renderHistoryList();
  }
  function renderHistoryList(){
    if(!historyListEl) return;
    const list = loadHistoryStore();
    historyListEl.innerHTML = "";
    if(!list.length){
      const empty = document.createElement("div");
      empty.className = "chat-history-empty";
      empty.textContent = saqrT("history_empty");
      historyListEl.appendChild(empty);
      return;
    }
    list.forEach(c => {
      const item = document.createElement("div");
      item.className = "chat-history-item" + (c.id === currentChatId ? " active" : "");
      const title = document.createElement("span");
      title.className = "chi-title";
      title.textContent = c.title || saqrT("history_untitled");
      item.appendChild(title);
      const del = document.createElement("button");
      del.type = "button";
      del.className = "chi-delete";
      del.textContent = "×";
      del.addEventListener("click", (e) => { e.stopPropagation(); deleteChat(c.id); });
      item.appendChild(del);
      item.addEventListener("click", () => loadChat(c.id));
      historyListEl.appendChild(item);
    });
  }
  function deleteChat(id){
    saveHistoryStore(loadHistoryStore().filter(c => c.id !== id));
    if(id === currentChatId) startNewChat();
    else renderHistoryList();
  }
  function loadChat(id){
    const chatObj = loadHistoryStore().find(c => c.id === id);
    if(!chatObj) return;
    stopVoiceLocal();
    currentChatId = id;
    chatMessages = chatObj.messages || [];
    attachedFile = chatObj.attachedFile || null;
    ppWizard = null;
    updateFileChipUI();
    chatWindow.innerHTML = "";
    if(!chatMessages.length){
      addIntroMessage();
    } else {
      chatMessages.forEach(m => renderBubble(m.content, m.role, { sources: m.sources, chartUrl: m.chartUrl }));
    }
    renderHistoryList();
  }
  function startNewChat(){
    stopVoiceLocal();
    currentChatId = null;
    chatMessages = [];
    attachedFile = null;
    ppWizard = null;
    fetch("/api/chat_file_clear", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }),
    }).catch(() => {});
    updateFileChipUI();
    chatWindow.innerHTML = "";
    addIntroMessage();
    renderHistoryList();
  }

  historyNewBtn && historyNewBtn.addEventListener("click", () => { if(!ppWizard) startNewChat(); });

  // ---------------- rendering ----------------
  function addIntroMessage(){
    renderBubble(saqrT(introKey), "bot", { record: false });
  }

  function renderBubble(text, who, opts2){
    opts2 = opts2 || {};
    const div = document.createElement("div");
    div.className = "msg " + (who === "user" ? "msg-user" : "msg-bot");
    const tag = document.createElement("span");
    tag.className = "msg-tag";
    tag.textContent = who === "user" ? t("you_tag") : "SAQR";
    div.appendChild(tag);

    const body = document.createElement("div");
    body.className = "msg-body";
    if(who === "user"){
      body.textContent = text;
    } else if(text){
      body.innerHTML = renderMarkdown(text);
    }

    if(opts2.chartUrl){
      const img = document.createElement("img");
      img.src = opts2.chartUrl;
      img.className = "msg-chart";
      img.alt = "chart";
      body.appendChild(img);
    }

    if(opts2.sources && opts2.sources.length){
      const srcWrap = document.createElement("div");
      srcWrap.className = "msg-sources";
      opts2.sources.slice(0, 5).forEach((s, i) => {
        const a = document.createElement("a");
        a.href = s.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        let host = s.url;
        try{ host = new URL(s.url).hostname.replace(/^www\./, ""); }catch(e){}
        a.textContent = `[${i + 1}] ${host}`;
        srcWrap.appendChild(a);
      });
      body.appendChild(srcWrap);
    }

    div.appendChild(body);
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function addMsg(text, who, opts2){
    opts2 = opts2 || {};
    renderBubble(text, who, opts2);
    // Single source of truth for "speak the reply, then resume listening" —
    // every bot message goes through here (wizard steps are the one
    // exception, handled separately in addWizardStepMsg), so voice mode
    // keeps going through wizard/report/file-upload replies too, not just
    // the plain chat path. Without this, voice mode would go silent and
    // stop listening the moment a reply took any of those other paths,
    // forcing the user to re-click the mic to continue.
    if(who !== "user" && voiceModeActive && text && opts2.speak !== false) speakText(text);
    if(opts2.record === false) return;
    if(!currentChatId) currentChatId = "c" + Date.now() + Math.random().toString(36).slice(2, 8);
    chatMessages.push({
      role: who === "user" ? "user" : "assistant",
      content: text,
      sources: opts2.sources || null,
      chartUrl: opts2.chartUrl || null,
    });
    persistCurrentChat();
  }

  function appendDownloadCard(url, label){
    const div = document.createElement("div");
    div.className = "msg msg-bot";
    const tag = document.createElement("span");
    tag.className = "msg-tag"; tag.textContent = "SAQR";
    div.appendChild(tag);
    const body = document.createElement("div");
    body.className = "msg-body";
    const card = document.createElement("div");
    card.className = "ppt-result-card";
    const link = document.createElement("a");
    link.className = "ppt-download-btn";
    link.href = url;
    link.setAttribute("download", "");
    link.textContent = "⬇ " + label;
    card.appendChild(link);
    body.appendChild(card);
    div.appendChild(body);
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    if(!currentChatId) currentChatId = "c" + Date.now() + Math.random().toString(36).slice(2, 8);
    chatMessages.push({ role: "assistant", content: `⬇ ${label}: ${url}` });
    persistCurrentChat();
  }

  // ---------------- sending a message ----------------
  async function submitChatMessage(message){
    message = (message || "").trim();
    if(!message) return;

    if(opts.enableWizard){
      if(ppWizard){
        if(/^(cancel|stop|nevermind|never mind)$/i.test(message)){
          addMsg(message, "user");
          cancelWizard();
          return;
        }
        const step = ppWizard.steps[ppWizard.stepIndex];
        if(step.type === "choice"){
          const matched = step.choices.find(c =>
            c.value.toLowerCase() === message.toLowerCase() ||
            saqrT(c.labelKey).toLowerCase() === message.toLowerCase()
          );
          if(matched){
            handleWizardAnswer(matched.value, saqrT(matched.labelKey));
          } else {
            addMsg(message, "user");
            addMsg(saqrT("wiz_pick_option"), "bot");
          }
          return;
        }
        handleWizardAnswer(message, message);
        return;
      }

      if(mode === "ppt"){
        // Every message here is presentation intent — no trigger phrase needed.
        addMsg(message, "user");
        startWizard(message);
        return;
      }
      if(PRESENTATION_TRIGGER_RE.test(message)){
        addMsg(message, "user");
        startWizard(message);
        return;
      }
    }

    if(opts.enableReportGen && REPORT_TRIGGER_RE.test(message)){
      addMsg(message, "user");
      await requestReportGeneration();
      return;
    }

    addMsg(message, "user");

    const thinking = document.createElement("div");
    thinking.className = "msg msg-bot";
    thinking.innerHTML = '<span class="msg-tag">SAQR</span><div class="msg-body"><span class="typing-dots"><span></span><span></span><span></span></span></div>';
    chatWindow.appendChild(thinking);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    let webResults = null;
    if(opts.enableWebSearch){
      // The manual toggle (master chat only) always forces a search; beyond
      // that, auto-detect from the message itself so live-data questions get
      // searched even without the toggle, and in chats with no toggle button
      // at all (Report & Analysis, PowerPoint).
      const shouldSearch = webSearchActive || messageWantsLiveData(message);
      if(shouldSearch){
        if(webSearchActive){ webSearchActive = false; webSearchBtn && webSearchBtn.classList.remove("is-active"); }
        thinking.querySelector(".msg-body").innerHTML =
          saqrT("thinking_searching") + ' <span class="typing-dots"><span></span><span></span><span></span></span>';
        try{
          const sres = await fetch("/api/web_search", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: message }),
          });
          const sdata = await sres.json();
          if(sdata.ok && sdata.results && sdata.results.length) webResults = sdata.results;
        }catch(e){ /* best effort */ }
      }
    }

    let weather = null;
    if(opts.enableWeather && WEATHER_TRIGGER_RE.test(message)){
      thinking.querySelector(".msg-body").innerHTML =
        saqrT("thinking_weather") + ' <span class="typing-dots"><span></span><span></span><span></span></span>';
      weather = await fetchWeather();
    }

    const historyForApi = chatMessages.slice(-10).map(m => ({ role: m.role, content: m.content }));

    try{
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: historyForApi, web_results: webResults, weather, mode }),
      });
      const data = await res.json();
      thinking.remove();
      addMsg(data.reply, "bot", { sources: webResults, chartUrl: data.chart_url });
    }catch(err){
      thinking.remove();
      addMsg("⚠️ Couldn't reach the server.", "bot");
    }
  }

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    chatInput.value = "";
    submitChatMessage(message);
  });

  // ---------------- file attach ----------------
  function updateFileChipUI(){
    if(!fileChip) return;
    if(attachedFile){
      if(chipName) chipName.textContent = attachedFile.filename;
      if(chipMeta) chipMeta.textContent = attachedFile.meta;
      fileChip.classList.remove("hidden");
      if(attachBtn) attachBtn.classList.add("has-file");
    } else {
      fileChip.classList.add("hidden");
      if(attachBtn) attachBtn.classList.remove("has-file");
      if(chipReportBtn) chipReportBtn.classList.add("hidden");
    }
  }

  attachBtn && fileInput && attachBtn.addEventListener("click", () => fileInput.click());

  fileInput && fileInput.addEventListener("change", async () => {
    if(!fileInput.files.length) return;
    const file = fileInput.files[0];
    if(ppWizard) cancelWizard();

    const thinking = document.createElement("div");
    thinking.className = "msg msg-bot msg-file";
    thinking.innerHTML = '<span class="msg-tag">SAQR</span><div class="msg-body"></div>';
    thinking.querySelector(".msg-body").textContent = saqrFormat("uploading_file", { filename: file.name });
    chatWindow.appendChild(thinking);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    const formData = new FormData();
    formData.append("file", file);
    if(opts.uploadEndpoint === "/api/chat_upload") formData.append("mode", mode);

    try{
      const res = await fetch(opts.uploadEndpoint, { method: "POST", body: formData });
      const data = await res.json();
      thinking.remove();

      if(!data.ok){
        addMsg(saqrFormat("file_attach_error", { error: data.error }), "bot");
        return;
      }

      attachedFile = { filename: data.filename, meta: data.meta };
      updateFileChipUI();
      addMsg(saqrFormat("file_attached_msg", { filename: data.filename, meta: data.meta }), "bot");

      if(mode === "report" || mode === "master"){
        // spreadsheets uploaded here get the full analysis pipeline too now
        // (see _process_chat_upload server-side) — show the auto-charts and,
        // in the Report chat, reveal the dedicated Generate Report button.
        if(chipReportBtn) chipReportBtn.classList.toggle("hidden", !data.trends);
        if(data.chart_urls && data.chart_urls.length){
          data.chart_urls.forEach(url => addMsg("", "bot", { chartUrl: url }));
        }
      }

      if(mode === "ppt"){
        // the whole point of this chat is decks — kick the wizard off right away
        startWizard();
      }
    }catch(err){
      thinking.remove();
      addMsg(saqrFormat("file_attach_error", { error: String(err) }), "bot");
    }

    fileInput.value = "";
  });

  chipRemoveBtn && chipRemoveBtn.addEventListener("click", async () => {
    if(!attachedFile) return;
    const removedName = attachedFile.filename;
    try{
      await fetch("/api/chat_file_clear", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }),
      });
    }catch(err){ /* best effort */ }
    attachedFile = null;
    updateFileChipUI();
    addMsg(saqrFormat("file_removed_msg", { filename: removedName }), "bot");
    ppWizard = null;
  });

  function lastAssistantMessage(){
    for(let i = chatMessages.length - 1; i >= 0; i--){
      if(chatMessages[i].role === "assistant" && chatMessages[i].content) return chatMessages[i].content;
    }
    return "";
  }

  // ---------------- generate Word report (button click OR typed request) ----------------
  // Shared by the Report & Analysis chip button and by just typing "make me
  // a word report" in either the Report or master Chat — no button needed
  // there, the request itself is enough. If there's a spreadsheet loaded in
  // this chat the server builds the full data report; otherwise it exports
  // SAQR's last reply itself as a Word doc (see lastAssistantMessage below).
  async function requestReportGeneration(){
    if(chipReportBtn) chipReportBtn.disabled = true;
    const thinking = document.createElement("div");
    thinking.className = "msg msg-bot";
    thinking.innerHTML = '<span class="msg-tag">SAQR</span><div class="msg-body">'
      + saqrT("report_generating")
      + ' <span class="typing-dots"><span></span><span></span><span></span></span></div>';
    chatWindow.appendChild(thinking);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    try{
      const res = await fetch("/api/report_generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        // No spreadsheet loaded here? The server falls back to exporting
        // the conversation's own last reply as a Word doc — send it along
        // so that path has something to work with.
        body: JSON.stringify({ mode, content: lastAssistantMessage() }),
      });
      const data = await res.json();
      thinking.remove();
      if(!data.ok){
        addMsg(saqrFormat("report_error", { error: data.error }), "bot");
      } else {
        addMsg(saqrT(data.source === "chat" ? "chat_export_ready_msg" : "report_ready_msg"), "bot");
        appendDownloadCard(data.download_url, saqrT("report_download_btn"));
      }
    }catch(err){
      thinking.remove();
      addMsg(saqrFormat("report_error", { error: String(err) }), "bot");
    }
    if(chipReportBtn) chipReportBtn.disabled = false;
  }

  chipReportBtn && chipReportBtn.addEventListener("click", requestReportGeneration);

  // ---------------- presentation wizard (master + ppt) ----------------
  function addWizardStepMsg(step){
    const div = document.createElement("div");
    div.className = "msg msg-bot";
    const tag = document.createElement("span");
    tag.className = "msg-tag";
    tag.textContent = "SAQR";
    div.appendChild(tag);

    const body = document.createElement("div");
    body.className = "msg-body";
    body.innerHTML = renderMarkdown(saqrT(step.promptKey));
    div.appendChild(body);

    if(step.type === "choice"){
      const choicesWrap = document.createElement("div");
      choicesWrap.className = "wizard-choices";
      step.choices.forEach(choice => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wizard-choice-btn";
        btn.textContent = saqrT(choice.labelKey);
        btn.addEventListener("click", () => {
          Array.from(choicesWrap.children).forEach(c => c.disabled = true);
          handleWizardAnswer(choice.value, saqrT(choice.labelKey));
        });
        choicesWrap.appendChild(btn);
      });
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "wizard-choice-btn is-cancel";
      cancelBtn.textContent = saqrT("wiz_cancel");
      cancelBtn.addEventListener("click", () => {
        Array.from(choicesWrap.children).forEach(c => c.disabled = true);
        cancelWizard();
      });
      choicesWrap.appendChild(cancelBtn);
      body.appendChild(choicesWrap);
    } else if(step.skippable){
      const choicesWrap = document.createElement("div");
      choicesWrap.className = "wizard-choices";
      const skipBtn = document.createElement("button");
      skipBtn.type = "button";
      skipBtn.className = "wizard-choice-btn is-skip";
      skipBtn.textContent = saqrT("wiz_skip");
      skipBtn.addEventListener("click", () => {
        Array.from(choicesWrap.children).forEach(c => c.disabled = true);
        handleWizardAnswer("", saqrT("wiz_skip"));
      });
      choicesWrap.appendChild(skipBtn);
      body.appendChild(choicesWrap);
      chatInput.placeholder = saqrT(step.placeholderKey);
    } else if(step.placeholderKey){
      chatInput.placeholder = saqrT(step.placeholderKey);
    }

    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    // This bypasses addMsg (wizard steps have their own buttons/DOM, not
    // recorded into chat history the same way), so it needs its own
    // speak-then-resume-listening call — same reason as the addMsg hook.
    if(voiceModeActive) speakText(saqrT(step.promptKey));
  }

  function startWizard(triggerMessage){
    if(attachedFile){
      ppWizard = { stepIndex: 0, answers: {}, steps: WIZARD_STEPS };
      addWizardStepMsg(WIZARD_STEPS[0]);
      return;
    }

    let extractedTopic = extractTopicFromMessage(triggerMessage);
    if(!extractedTopic && opts.rawMessageIsTopic && triggerMessage && triggerMessage.trim()){
      extractedTopic = triggerMessage.trim();
    }
    if(extractedTopic){
      ppWizard = { stepIndex: 0, answers: { topic: extractedTopic }, steps: WIZARD_STEPS };
      // speak:false — addWizardStepMsg right below speaks the actual next
      // question; without this the two would race and cut each other off
      addMsg(saqrFormat("wiz_topic_confirmed", { topic: extractedTopic }), "bot", { speak: false });
      addWizardStepMsg(WIZARD_STEPS[0]);
      return;
    }

    const steps = [TOPIC_STEP, ...WIZARD_STEPS];
    ppWizard = { stepIndex: 0, answers: {}, steps };
    addWizardStepMsg(steps[0]);
  }

  function cancelWizard(){
    ppWizard = null;
    chatInput.placeholder = saqrT("chat_placeholder");
    addMsg(saqrT("wiz_cancelled_msg"), "bot");
  }

  function handleWizardAnswer(value, displayLabel){
    if(!ppWizard) return;
    addMsg(displayLabel, "user");

    const step = ppWizard.steps[ppWizard.stepIndex];
    ppWizard.answers[step.key] = value;
    ppWizard.stepIndex++;
    chatInput.placeholder = saqrT("chat_placeholder");

    const nextStep = ppWizard.steps[ppWizard.stepIndex];
    if(nextStep){
      addWizardStepMsg(nextStep);
    } else {
      runPresentationGeneration();
    }
  }

  async function runPresentationGeneration(){
    const answers = ppWizard.answers;
    ppWizard = null;

    const thinking = document.createElement("div");
    thinking.className = "msg msg-bot";
    thinking.innerHTML = '<span class="msg-tag">SAQR</span><div class="msg-body">'
      + saqrT("wiz_generating")
      + ' <span class="typing-dots"><span></span><span></span><span></span></span></div>';
    chatWindow.appendChild(thinking);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try{
      const res = await fetch("/api/chat_generate_presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, mode }),
      });
      const data = await res.json();
      thinking.remove();

      if(!data.ok){
        addMsg(saqrFormat("wiz_error", { error: data.error }), "bot");
        return;
      }

      addMsg(data.rationale || saqrT("wiz_download_ready"), "bot");

      const div = document.createElement("div");
      div.className = "msg msg-bot";
      const tag = document.createElement("span");
      tag.className = "msg-tag";
      tag.textContent = "SAQR";
      div.appendChild(tag);

      const body = document.createElement("div");
      body.className = "msg-body";
      const card = document.createElement("div");
      card.className = "ppt-result-card";
      card.innerHTML = `
        <div class="ppt-meta" dir="ltr">
          <span>${saqrT("wiz_theme_label")}: <b></b></span>
          <span>${saqrT("wiz_slides_label")}: <b></b></span>
        </div>
      `;
      card.querySelectorAll("b")[0].textContent = data.theme_label || "";
      card.querySelectorAll("b")[1].textContent = data.slide_count || "";
      const link = document.createElement("a");
      link.className = "ppt-download-btn";
      link.href = data.download_url;
      link.setAttribute("download", "");
      link.textContent = "⬇ " + saqrT("wiz_download_btn");
      card.appendChild(link);

      if(data.sources && data.sources.length){
        const srcWrap = document.createElement("div");
        srcWrap.className = "msg-sources";
        data.sources.slice(0, 5).forEach((url, i) => {
          const a = document.createElement("a");
          a.href = url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          let host = url;
          try{ host = new URL(url).hostname.replace(/^www\./, ""); }catch(e){}
          a.textContent = `[${i + 1}] ${host}`;
          srcWrap.appendChild(a);
        });
        card.appendChild(srcWrap);
      }

      body.appendChild(card);
      div.appendChild(body);
      chatWindow.appendChild(div);
      chatWindow.scrollTop = chatWindow.scrollHeight;

      if(!currentChatId) currentChatId = "c" + Date.now() + Math.random().toString(36).slice(2, 8);
      chatMessages.push({ role: "assistant", content: `⬇ ${saqrT("wiz_download_btn")}: ${data.download_url}` });
      persistCurrentChat();
    }catch(err){
      thinking.remove();
      addMsg(saqrFormat("wiz_error", { error: String(err) }), "bot");
    }
  }

  chipPptBtn && chipPptBtn.addEventListener("click", () => {
    if(ppWizard) return;
    startWizard();
  });

  // ---------------- voice: mic button (speech-to-text into the input) ----------------
  if(micBtn && SpeechRecognitionCtor){
    micBtn.addEventListener("click", () => {
      if(micListening){ micRecognition && micRecognition.stop(); return; }
      micRecognition = new SpeechRecognitionCtor();
      micRecognition.lang = speechLangCode();
      micRecognition.interimResults = false;
      micRecognition.maxAlternatives = 1;

      micRecognition.addEventListener("result", (e) => {
        const transcript = e.results[0][0].transcript;
        chatInput.value = chatInput.value ? chatInput.value + " " + transcript : transcript;
        chatInput.focus();
      });
      micRecognition.addEventListener("end", () => {
        micListening = false;
        micBtn.classList.remove("is-recording");
      });
      micRecognition.addEventListener("error", () => {
        micListening = false;
        micBtn.classList.remove("is-recording");
      });

      try{
        micRecognition.start();
        micListening = true;
        micBtn.classList.add("is-recording");
      }catch(e){ /* already running */ }
    });
  } else if(micBtn){
    micBtn.addEventListener("click", () => addMsg(saqrT("voice_unsupported"), "bot"));
  }

  // ---------------- voice mode: live back-and-forth conversation ----------------
  function speakText(text){
    if(!("speechSynthesis" in window)){
      if(voiceModeActive) startVoiceModeListening();
      return;
    }
    const clean = stripMarkdownForSpeech(text);
    if(!clean){
      if(voiceModeActive) startVoiceModeListening();
      return;
    }
    // Speech synthesis can throw for reasons entirely outside our control —
    // a stale/invalid voice reference, a browser-specific quirk, whatever.
    // If that happens uncaught, it used to kill voice mode's listen loop
    // right there (this function is called from inside addMsg, before the
    // message even finishes recording) and the user would have to re-click
    // the mic to get anything working again. Never let that happen — worst
    // case, skip the narration and just keep listening.
    try{
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(clean);
      const voice = pickBestVoice();
      if(voice) utter.voice = voice;
      utter.lang = voice ? voice.lang : speechLangCode();
      utter.onend = () => { if(voiceModeActive) startVoiceModeListening(); };
      utter.onerror = () => { if(voiceModeActive) startVoiceModeListening(); };
      window.speechSynthesis.speak(utter);
    }catch(e){
      if(voiceModeActive) startVoiceModeListening();
    }
  }

  function startVoiceModeListening(){
    if(!voiceModeActive || !SpeechRecognitionCtor) return;
    if(voiceModeStatus) voiceModeStatus.textContent = saqrT("voice_mode_listening");
    let gotResult = false;

    voiceModeRecognition = new SpeechRecognitionCtor();
    voiceModeRecognition.lang = speechLangCode();
    voiceModeRecognition.interimResults = false;
    voiceModeRecognition.maxAlternatives = 1;

    voiceModeRecognition.addEventListener("result", (e) => {
      const transcript = e.results[0][0].transcript;
      if(transcript && transcript.trim()){
        gotResult = true;
        if(voiceModeStatus) voiceModeStatus.textContent = saqrT("voice_mode_thinking");
        submitChatMessage(transcript);
      }
    });
    voiceModeRecognition.addEventListener("end", () => {
      if(voiceModeActive && !gotResult){
        setTimeout(() => { if(voiceModeActive) startVoiceModeListening(); }, 400);
      }
    });
    voiceModeRecognition.addEventListener("error", (e) => {
      if(!voiceModeActive) return;
      if(e.error === "not-allowed" || e.error === "service-not-allowed"){
        addMsg(saqrT("voice_mic_denied"), "bot");
        stopVoiceModeInternal();
      }
    });

    try{ voiceModeRecognition.start(); }catch(e){ /* already running */ }
  }

  function stopVoiceModeInternal(){
    voiceModeActive = false;
    if(voiceModeBanner) voiceModeBanner.classList.add("hidden");
    if(voiceModeBtn) voiceModeBtn.classList.remove("is-active");
    if(voiceModeRecognition){ try{ voiceModeRecognition.stop(); }catch(e){} }
    if("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function startVoiceModeInternal(){
    if(!SpeechRecognitionCtor || !("speechSynthesis" in window)){
      addMsg(saqrT("voice_unsupported"), "bot");
      return;
    }
    if(micListening){ micRecognition && micRecognition.stop(); }
    voiceModeActive = true;
    if(voiceModeBanner) voiceModeBanner.classList.remove("hidden");
    if(voiceModeBtn) voiceModeBtn.classList.add("is-active");
    startVoiceModeListening();
  }

  voiceModeBtn && voiceModeBtn.addEventListener("click", () => {
    if(voiceModeActive){ stopVoiceModeInternal(); } else { startVoiceModeInternal(); }
  });
  voiceModeStopBtn && voiceModeStopBtn.addEventListener("click", stopVoiceModeInternal);

  webSearchBtn && webSearchBtn.addEventListener("click", () => {
    webSearchActive = !webSearchActive;
    webSearchBtn.classList.toggle("is-active", webSearchActive);
  });

  // ---------------- init ----------------
  renderHistoryList();

  return {
    stopVoice: stopVoiceLocal,
  };
}

// ============================================================================
// Instantiate the three surfaces
// ============================================================================
chatSurfaceInstances = [
  createChatSurface(document.getElementById("panel-chat"), "master", {
    enableWizard: true, enableWebSearch: true, enableWeather: true, enableReportGen: true,
    uploadEndpoint: "/api/chat_upload",
  }),
  createChatSurface(document.getElementById("panel-report"), "report", {
    enableWizard: false, enableWebSearch: true, enableReportGen: true, uploadEndpoint: "/api/report_upload",
  }),
  createChatSurface(document.getElementById("panel-ppt"), "ppt", {
    enableWizard: true, rawMessageIsTopic: true, enableWebSearch: true, uploadEndpoint: "/api/chat_upload",
  }),
];
