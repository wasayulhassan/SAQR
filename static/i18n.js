// ---------- SAQR i18n ----------
// Translates UI chrome (nav, headings, buttons, labels, placeholders) across
// English, Arabic, Urdu, and Hindi. This does NOT translate live data output
// (chat replies, analysis results, math syntax hints) — those come from the
// backend/model and are language-agnostic by design.

const SAQR_TRANSLATIONS = {
  en: {
    engine_free: "engine: hosted (free)",
    nav_main: "Main", nav_dashboard: "Dashboard", nav_chat: "Chat",
    nav_analyze: "Analyze Data", nav_solve: "Problem Solver",
    nav_output: "Output", nav_export: "Reports & Decks",
    dash_title: "Welcome to SAQR",
    dash_subtitle: "Your local, free data analysis and problem-solving console.",
    stat_engine: "Chat Engine", stat_engine_val: "Local (free)",
    stat_privacy: "Data Privacy", stat_privacy_val: "Stays on device",
    stat_formats: "File Formats", stat_exports: "Export Formats",
    qa1_t: "Ask a Question", qa1_d: "General reasoning, chat with SAQR",
    qa2_t: "Analyze Data", qa2_d: "Upload a CSV or Excel file",
    qa3_t: "Solve a Problem", qa3_d: "Math, stats, or optimization",
    qa4_t: "Export a Report", qa4_d: "Turn your analysis into DOCX/PPTX",
    about_title: "About this console",
    about_body: "SAQR runs entirely on your own machine — data analysis, report generation, presentation building, and math/logic solving, with no data leaving this device. The chat feature uses a lightweight local model to stay free.",
    chat_h1: "General reasoning", chat_p: "Ask anything. Backed by a local model — no data leaves this machine.",
    chat_intro: "Console online. Upload a dataset in Analyze, run a calculation in Solve, or just ask me something here.",
    chat_placeholder: "Ask SAQR…", send_btn: "Send",
    analyze_h1: "Data analysis", analyze_p: "Upload a CSV or Excel file for stats, trend detection, and anomaly flags.",
    drop_file: "Drop a file", or_click: "or click to browse",
    overview_h2: "Overview", trends_h2: "Trends", anomalies_h2: "Anomalies", charts_h2: "Charts",
    build_chart_h2: "Build your own chart",
    build_chart_hint: "Pick columns and a chart type — like inserting a custom chart in Excel.",
    chart_type_lbl: "Chart type", x_axis_lbl: "X axis / labels", y_col_lbl: "Y column(s)",
    title_optional_lbl: "Title (optional)", title_ph: "e.g. Revenue by Month", color_lbl: "Color",
    generate_chart_btn: "Generate chart",
    solve_h1: "Problem solving", solve_p: "Equations, calculus, and linear optimization — computed exactly, not guessed.",
    tab_equation: "Solve equation", tab_simplify: "Simplify", tab_derivative: "Derivative",
    tab_integral: "Integral", tab_optimize: "Optimize (LP)",
    expression_lbl: "Expression", variable_lbl: "Variable", compute_btn: "Compute",
    obj_coef_lbl: "Objective coefficients (comma-sep, e.g. maximize 3x + 5y → 3,5)",
    constraint_lbl: "Inequality constraint matrix rows, one per line (A·x ≤ b) — format: a,b | rhs",
    solve_lp_btn: "Solve LP",
    export_h1: "Report & deck export", export_p: "Turn your last analysis into a Word report or PowerPoint deck.",
    word_report_h2: "Word report", word_report_p: "Overview, statistics table, trends, anomalies, and charts.",
    report_title_ph: "Report title", gen_docx_btn: "Generate .docx",
    ppt_deck_h2: "PowerPoint deck", ppt_deck_p: "Title slide, overview, trends, anomalies, and chart slides.",
    deck_title_ph: "Deck title", gen_pptx_btn: "Generate .pptx",
    export_note: "Run an analysis in the Analyze panel first — exports are built from your last uploaded dataset.",
    llm_checking: "LLM: checking…", llm_online: "LLM: online", llm_offline: "LLM: offline", llm_unknown: "LLM: unknown",
    you_tag: "YOU"
  },
  ar: {
    engine_free: "المحرك: مستضاف (مجاني)",
    nav_main: "الرئيسية", nav_dashboard: "لوحة التحكم", nav_chat: "محادثة",
    nav_analyze: "تحليل البيانات", nav_solve: "حل المسائل",
    nav_output: "المخرجات", nav_export: "التقارير والعروض",
    dash_title: "مرحبًا بك في صقر",
    dash_subtitle: "وحدة تحكم محلية ومجانية لتحليل البيانات وحل المسائل.",
    stat_engine: "محرك المحادثة", stat_engine_val: "محلي (مجاني)",
    stat_privacy: "خصوصية البيانات", stat_privacy_val: "تبقى على جهازك",
    stat_formats: "صيغ الملفات", stat_exports: "صيغ التصدير",
    qa1_t: "اطرح سؤالاً", qa1_d: "استدلال عام، تحدث مع صقر",
    qa2_t: "تحليل البيانات", qa2_d: "ارفع ملف CSV أو Excel",
    qa3_t: "حل مسألة", qa3_d: "رياضيات، إحصاء، أو تحسين",
    qa4_t: "تصدير تقرير", qa4_d: "حوّل تحليلك إلى DOCX/PPTX",
    about_title: "عن هذه الوحدة",
    about_body: "يعمل صقر بالكامل على جهازك الخاص — تحليل البيانات، إنشاء التقارير، بناء العروض التقديمية، وحل المسائل الرياضية والمنطقية، دون خروج أي بيانات من هذا الجهاز. تستخدم ميزة المحادثة نموذجًا محليًا خفيفًا لتبقى مجانية.",
    chat_h1: "استدلال عام", chat_p: "اسأل أي شيء. مدعوم بنموذج محلي — لا تغادر بياناتك هذا الجهاز.",
    chat_intro: "الوحدة متصلة. ارفع مجموعة بيانات في تحليل البيانات، أجرِ عملية حسابية في حل المسائل، أو اسألني هنا مباشرة.",
    chat_placeholder: "اسأل صقر…", send_btn: "إرسال",
    analyze_h1: "تحليل البيانات", analyze_p: "ارفع ملف CSV أو Excel للحصول على إحصاءات واكتشاف الاتجاهات وعلامات الشذوذ.",
    drop_file: "أسقط ملفًا هنا", or_click: "أو اضغط للتصفح",
    overview_h2: "نظرة عامة", trends_h2: "الاتجاهات", anomalies_h2: "الشذوذ", charts_h2: "الرسوم البيانية",
    build_chart_h2: "أنشئ رسمًا بيانيًا خاصًا بك",
    build_chart_hint: "اختر الأعمدة ونوع الرسم البياني — تمامًا كإدراج رسم بياني مخصص في Excel.",
    chart_type_lbl: "نوع الرسم البياني", x_axis_lbl: "المحور السيني / التسميات", y_col_lbl: "عمود (أعمدة) Y",
    title_optional_lbl: "العنوان (اختياري)", title_ph: "مثال: الإيرادات حسب الشهر", color_lbl: "اللون",
    generate_chart_btn: "إنشاء الرسم البياني",
    solve_h1: "حل المسائل", solve_p: "معادلات، تفاضل وتكامل، وتحسين خطي — محسوبة بدقة، لا تخمين.",
    tab_equation: "حل معادلة", tab_simplify: "تبسيط", tab_derivative: "المشتقة",
    tab_integral: "التكامل", tab_optimize: "تحسين (LP)",
    expression_lbl: "التعبير", variable_lbl: "المتغير", compute_btn: "احسب",
    obj_coef_lbl: "معاملات الهدف (مفصولة بفاصلة، مثال: لتعظيم 3x + 5y ← 3,5)",
    constraint_lbl: "صفوف مصفوفة القيود، سطر لكل قيد (A·x ≤ b) — الصيغة: a,b | rhs",
    solve_lp_btn: "حل البرمجة الخطية",
    export_h1: "تصدير التقارير والعروض", export_p: "حوّل آخر تحليل إلى تقرير Word أو عرض PowerPoint.",
    word_report_h2: "تقرير Word", word_report_p: "نظرة عامة، جدول إحصائي، اتجاهات، شذوذ، ورسوم بيانية.",
    report_title_ph: "عنوان التقرير", gen_docx_btn: "إنشاء .docx",
    ppt_deck_h2: "عرض PowerPoint", ppt_deck_p: "شريحة العنوان، نظرة عامة، اتجاهات، شذوذ، وشرائح الرسوم البيانية.",
    deck_title_ph: "عنوان العرض", gen_pptx_btn: "إنشاء .pptx",
    export_note: "شغّل تحليلاً في لوحة تحليل البيانات أولاً — يتم بناء الملفات المصدَّرة من آخر مجموعة بيانات رفعتها.",
    llm_checking: "النموذج: جارٍ التحقق…", llm_online: "النموذج: متصل", llm_offline: "النموذج: غير متصل", llm_unknown: "النموذج: غير معروف",
    you_tag: "أنت"
  },
  ur: {
    engine_free: "انجن: میزبان (مفت)",
    nav_main: "مرکزی", nav_dashboard: "ڈیش بورڈ", nav_chat: "چیٹ",
    nav_analyze: "ڈیٹا کا تجزیہ", nav_solve: "مسئلہ حل کریں",
    nav_output: "آؤٹ پٹ", nav_export: "رپورٹس اور پریزنٹیشنز",
    dash_title: "صقر میں خوش آمدید",
    dash_subtitle: "آپ کا مقامی، مفت ڈیٹا تجزیہ اور مسئلہ حل کرنے والا کنسول۔",
    stat_engine: "چیٹ انجن", stat_engine_val: "مقامی (مفت)",
    stat_privacy: "ڈیٹا کی رازداری", stat_privacy_val: "آپ کے ڈیوائس پر رہتا ہے",
    stat_formats: "فائل فارمیٹس", stat_exports: "ایکسپورٹ فارمیٹس",
    qa1_t: "سوال پوچھیں", qa1_d: "عمومی استدلال، صقر سے بات کریں",
    qa2_t: "ڈیٹا کا تجزیہ کریں", qa2_d: "ایک CSV یا Excel فائل اپ لوڈ کریں",
    qa3_t: "مسئلہ حل کریں", qa3_d: "ریاضی، شماریات، یا اصلاح",
    qa4_t: "رپورٹ ایکسپورٹ کریں", qa4_d: "اپنے تجزیے کو DOCX/PPTX میں بدلیں",
    about_title: "اس کنسول کے بارے میں",
    about_body: "صقر مکمل طور پر آپ کی اپنی مشین پر چلتا ہے — ڈیٹا کا تجزیہ، رپورٹ کی تیاری، پریزنٹیشن بنانا، اور ریاضی/منطقی مسائل کا حل، اور کوئی بھی ڈیٹا اس ڈیوائس سے باہر نہیں جاتا۔ چیٹ فیچر مفت رکھنے کے لیے ایک ہلکا مقامی ماڈل استعمال کرتا ہے۔",
    chat_h1: "عمومی استدلال", chat_p: "کچھ بھی پوچھیں۔ ایک مقامی ماڈل کی بنیاد پر — آپ کا ڈیٹا اس مشین سے باہر نہیں جاتا۔",
    chat_intro: "کنسول آن لائن ہے۔ تجزیہ کریں میں ایک ڈیٹاسیٹ اپ لوڈ کریں، حل کریں میں کوئی حساب کریں، یا یہاں مجھ سے کچھ بھی پوچھیں۔",
    chat_placeholder: "صقر سے پوچھیں…", send_btn: "بھیجیں",
    analyze_h1: "ڈیٹا کا تجزیہ", analyze_p: "اعداد و شمار، رجحانات کی نشاندہی، اور بے قاعدگی کی علامات کے لیے CSV یا Excel فائل اپ لوڈ کریں۔",
    drop_file: "ایک فائل ڈراپ کریں", or_click: "یا براؤز کرنے کے لیے کلک کریں",
    overview_h2: "جائزہ", trends_h2: "رجحانات", anomalies_h2: "بے قاعدگیاں", charts_h2: "چارٹس",
    build_chart_h2: "اپنا چارٹ بنائیں",
    build_chart_hint: "کالمز اور چارٹ کی قسم منتخب کریں — بالکل ایسے جیسے Excel میں کسٹم چارٹ داخل کرنا۔",
    chart_type_lbl: "چارٹ کی قسم", x_axis_lbl: "X محور / لیبلز", y_col_lbl: "Y کالم(ز)",
    title_optional_lbl: "عنوان (اختیاری)", title_ph: "مثلاً: ماہانہ آمدنی", color_lbl: "رنگ",
    generate_chart_btn: "چارٹ بنائیں",
    solve_h1: "مسئلہ حل کرنا", solve_p: "مساوات، کیلکولس، اور لکیری اصلاح — درست طریقے سے شمار شدہ، اندازہ نہیں۔",
    tab_equation: "مساوات حل کریں", tab_simplify: "آسان بنائیں", tab_derivative: "مشتق",
    tab_integral: "انٹیگرل", tab_optimize: "اصلاح (LP)",
    expression_lbl: "اظہار", variable_lbl: "متغیر", compute_btn: "شمار کریں",
    obj_coef_lbl: "مقصدی گتانک (کاما سے الگ، مثلاً 3x + 5y زیادہ سے زیادہ کرنے کے لیے ← 3,5)",
    constraint_lbl: "عدم مساوات کی قید میٹرکس کی قطاریں، ہر سطر ایک (A·x ≤ b) — فارمیٹ: a,b | rhs",
    solve_lp_btn: "LP حل کریں",
    export_h1: "رپورٹ اور پریزنٹیشن ایکسپورٹ", export_p: "اپنے آخری تجزیے کو Word رپورٹ یا PowerPoint پریزنٹیشن میں بدلیں۔",
    word_report_h2: "Word رپورٹ", word_report_p: "جائزہ، شماریاتی جدول، رجحانات، بے قاعدگیاں، اور چارٹس۔",
    report_title_ph: "رپورٹ کا عنوان", gen_docx_btn: ".docx بنائیں",
    ppt_deck_h2: "PowerPoint پریزنٹیشن", ppt_deck_p: "عنوان کی سلائیڈ، جائزہ، رجحانات، بے قاعدگیاں، اور چارٹ سلائیڈز۔",
    deck_title_ph: "پریزنٹیشن کا عنوان", gen_pptx_btn: ".pptx بنائیں",
    export_note: "پہلے تجزیہ کریں پینل میں ایک تجزیہ چلائیں — ایکسپورٹس آپ کے آخری اپ لوڈ شدہ ڈیٹاسیٹ سے بنائی جاتی ہیں۔",
    llm_checking: "LLM: جانچ ہو رہی ہے…", llm_online: "LLM: آن لائن", llm_offline: "LLM: آف لائن", llm_unknown: "LLM: نامعلوم",
    you_tag: "آپ"
  },
  hi: {
    engine_free: "इंजन: होस्टेड (मुफ़्त)",
    nav_main: "मुख्य", nav_dashboard: "डैशबोर्ड", nav_chat: "चैट",
    nav_analyze: "डेटा विश्लेषण", nav_solve: "समस्या समाधान",
    nav_output: "आउटपुट", nav_export: "रिपोर्ट्स और प्रस्तुतियाँ",
    dash_title: "SAQR में आपका स्वागत है",
    dash_subtitle: "आपका लोकल, मुफ़्त डेटा विश्लेषण और समस्या-समाधान कंसोल।",
    stat_engine: "चैट इंजन", stat_engine_val: "लोकल (मुफ़्त)",
    stat_privacy: "डेटा प्राइवेसी", stat_privacy_val: "आपके डिवाइस पर ही रहता है",
    stat_formats: "फ़ाइल फॉर्मेट", stat_exports: "एक्सपोर्ट फॉर्मेट",
    qa1_t: "सवाल पूछें", qa1_d: "सामान्य तर्क, SAQR से बात करें",
    qa2_t: "डेटा का विश्लेषण करें", qa2_d: "एक CSV या Excel फ़ाइल अपलोड करें",
    qa3_t: "समस्या हल करें", qa3_d: "गणित, सांख्यिकी, या ऑप्टिमाइज़ेशन",
    qa4_t: "रिपोर्ट एक्सपोर्ट करें", qa4_d: "अपने विश्लेषण को DOCX/PPTX में बदलें",
    about_title: "इस कंसोल के बारे में",
    about_body: "SAQR पूरी तरह आपकी अपनी मशीन पर चलता है — डेटा विश्लेषण, रिपोर्ट बनाना, प्रस्तुति तैयार करना, और गणित/तर्क की समस्याएँ हल करना, और कोई भी डेटा इस डिवाइस से बाहर नहीं जाता। चैट फीचर मुफ़्त रखने के लिए एक हल्का लोकल मॉडल इस्तेमाल करता है।",
    chat_h1: "सामान्य तर्क", chat_p: "कुछ भी पूछें। एक लोकल मॉडल पर आधारित — आपका डेटा इस मशीन से बाहर नहीं जाता।",
    chat_intro: "कंसोल ऑनलाइन है। विश्लेषण में एक डेटासेट अपलोड करें, समाधान में कोई गणना करें, या यहीं मुझसे कुछ भी पूछें।",
    chat_placeholder: "SAQR से पूछें…", send_btn: "भेजें",
    analyze_h1: "डेटा विश्लेषण", analyze_p: "आँकड़े, रुझान, और असामान्यताओं के लिए एक CSV या Excel फ़ाइल अपलोड करें।",
    drop_file: "एक फ़ाइल ड्रॉप करें", or_click: "या ब्राउज़ करने के लिए क्लिक करें",
    overview_h2: "अवलोकन", trends_h2: "रुझान", anomalies_h2: "असामान्यताएँ", charts_h2: "चार्ट्स",
    build_chart_h2: "अपना खुद का चार्ट बनाएं",
    build_chart_hint: "कॉलम और चार्ट प्रकार चुनें — जैसे Excel में कस्टम चार्ट डालना।",
    chart_type_lbl: "चार्ट प्रकार", x_axis_lbl: "X अक्ष / लेबल", y_col_lbl: "Y कॉलम",
    title_optional_lbl: "शीर्षक (वैकल्पिक)", title_ph: "जैसे: मासिक राजस्व", color_lbl: "रंग",
    generate_chart_btn: "चार्ट बनाएं",
    solve_h1: "समस्या समाधान", solve_p: "समीकरण, कैलकुलस, और रैखिक अनुकूलन — सटीक रूप से गणना की गई, अनुमानित नहीं।",
    tab_equation: "समीकरण हल करें", tab_simplify: "सरल करें", tab_derivative: "अवकलज",
    tab_integral: "समाकलन", tab_optimize: "अनुकूलन (LP)",
    expression_lbl: "व्यंजक", variable_lbl: "चर", compute_btn: "गणना करें",
    obj_coef_lbl: "उद्देश्य गुणांक (अल्पविराम से अलग, जैसे 3x + 5y को अधिकतम करने हेतु ← 3,5)",
    constraint_lbl: "असमानता बाधा मैट्रिक्स की पंक्तियाँ, प्रति पंक्ति एक (A·x ≤ b) — फॉर्मेट: a,b | rhs",
    solve_lp_btn: "LP हल करें",
    export_h1: "रिपोर्ट और प्रस्तुति एक्सपोर्ट", export_p: "अपने अंतिम विश्लेषण को Word रिपोर्ट या PowerPoint प्रस्तुति में बदलें।",
    word_report_h2: "Word रिपोर्ट", word_report_p: "अवलोकन, सांख्यिकी तालिका, रुझान, असामान्यताएँ, और चार्ट्स।",
    report_title_ph: "रिपोर्ट शीर्षक", gen_docx_btn: ".docx बनाएं",
    ppt_deck_h2: "PowerPoint प्रस्तुति", ppt_deck_p: "शीर्षक स्लाइड, अवलोकन, रुझान, असामान्यताएँ, और चार्ट स्लाइड्स।",
    deck_title_ph: "प्रस्तुति शीर्षक", gen_pptx_btn: ".pptx बनाएं",
    export_note: "पहले विश्लेषण पैनल में एक विश्लेषण चलाएं — एक्सपोर्ट आपके अंतिम अपलोड किए गए डेटासेट से बनाए जाते हैं।",
    llm_checking: "LLM: जाँच हो रही है…", llm_online: "LLM: ऑनलाइन", llm_offline: "LLM: ऑफ़लाइन", llm_unknown: "LLM: अज्ञात",
    you_tag: "आप"
  }
};

const SAQR_RTL_LANGS = ["ar", "ur"];
let SAQR_CURRENT_LANG = localStorage.getItem("saqr_lang") || "en";

function saqrT(key){
  const dict = SAQR_TRANSLATIONS[SAQR_CURRENT_LANG] || SAQR_TRANSLATIONS.en;
  return dict[key] || SAQR_TRANSLATIONS.en[key] || key;
}

function saqrApplyLang(lang){
  if(!SAQR_TRANSLATIONS[lang]) lang = "en";
  SAQR_CURRENT_LANG = lang;
  localStorage.setItem("saqr_lang", lang);

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    el.textContent = saqrT(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    el.setAttribute("placeholder", saqrT(key));
  });

  document.body.classList.remove("rtl", "lang-ar", "lang-ur", "lang-hi");
  if(SAQR_RTL_LANGS.includes(lang)) document.body.classList.add("rtl");
  if(lang === "ar") document.body.classList.add("lang-ar");
  if(lang === "ur") document.body.classList.add("lang-ur");
  if(lang === "hi") document.body.classList.add("lang-hi");
  document.documentElement.setAttribute("lang", lang);

  document.querySelectorAll("#langSwitch button").forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-lang") === lang);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#langSwitch button").forEach(btn => {
    btn.addEventListener("click", () => saqrApplyLang(btn.getAttribute("data-lang")));
  });
  saqrApplyLang(SAQR_CURRENT_LANG);
});
