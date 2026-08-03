/* ═══════════════════════════════════════════════════════════
   מחשבון מעשרות וחומש — v5.0
   ═══════════════════════════════════════════════════════════ */

const STORAGE_KEY      = "maaser-chomesh-data-v2";
const PROFILES_KEY     = "maaser-chomesh-import-profiles-v1";
const PROF_SETTINGS_KEY= "maaser-chomesh-import-profile-settings-v1";
const THEME_KEY        = "maaser-chomesh-theme-v1";
const AUTO_BACKUP_KEY  = "maaser-chomesh-auto-backup-v1";
const LEGACY_STORAGE_KEY = "maaser-chomesh-data-v1";

// ── State ────────────────────────────────────────────────
let state = { entries: [], version: "5.0", date: new Date().toISOString() };
let undoStack = [], redoStack = [];
const MAX_HISTORY = 100;

let activeSection = "dashboard";
let activeTab     = "all";
let sortField     = "date";
let sortDir       = "desc";

let excelRows = [], excelWorkbook = null, excelFileName = "";
let manualSelectedRows = new Set();
let importProfiles = {};
let profileSettings = { defaultProfile: "", autoProfileMode: "on" };

let reportChart   = null;
let categoryChart = null;
let toastTimer    = null;
let modalCb       = null;

// ── Auto-backup state ─────────────────────────────────────
let autoBackupEnabled         = false;
let autoBackupIntervalMinutes = 10;
let autoBackupTimer           = null;
let autoBackupInFlight        = false;

// ── Element Cache ─────────────────────────────────────────
const el = id => document.getElementById(id);
const els = {
  // nav
  navItems      : Array.from(document.querySelectorAll(".nav-item[data-section]")),
  themeToggle   : el("theme-toggle"),
  themeIcon     : el("theme-icon"),
  themeLabel    : el("theme-label"),
  undoBtn       : el("undo-btn"),
  redoBtn       : el("redo-btn"),
  exportBtn     : el("export-btn"),
  importInput   : el("import-input"),
  exportCsvBtn  : el("export-csv-btn"),
  exportXlsxBtn : el("export-xlsx-btn"),
  // toast / modal
  toast         : el("toast"),
  modalOverlay  : el("modal-overlay"),
  modalTitle    : el("modal-title"),
  modalMsg      : el("modal-msg"),
  modalOk       : el("modal-ok"),
  modalCancel   : el("modal-cancel"),
  // dashboard
  dashboardDate    : el("dashboard-date"),
  totalIncome      : el("total-income"),
  totalDonations   : el("total-donations"),
  maaserStatusCard : el("maaser-status-card"),
  maaserTarget     : el("maaser-target"),
  maaserProgress   : el("maaser-progress"),
  maaserStatusNote : el("maaser-status-note"),
  chomeshStatusCard: el("chomesh-status-card"),
  chomeshTarget    : el("chomesh-target"),
  chomeshProgress  : el("chomesh-progress"),
  chomeshStatusNote: el("chomesh-status-note"),
  remainingMaaser  : el("remaining-maaser"),
  remainingChomesh : el("remaining-chomesh"),
  recentList       : el("recent-list"),
  viewAllBtn       : el("view-all-btn"),
  // form
  form          : el("entry-form"),
  editingId     : el("editing-id"),
  typeEl        : el("type"),
  dateEl        : el("date"),
  hebrewDate    : el("hebrew-date"),
  description   : el("description"),
  amount        : el("amount"),
  recipientWrap : el("recipient-wrap"),
  recipient     : el("recipient"),
  categoryWrap  : el("category-wrap"),
  category      : el("category"),
  notes         : el("notes"),
  saveBtn       : el("save-btn"),
  cancelEditBtn : el("cancel-edit-btn"),
  clearBtn      : el("clear-btn"),
  // transactions
  tabBtns       : Array.from(document.querySelectorAll(".tab-btn")),
  search        : el("search"),
  filterYear    : el("filter-year"),
  fromDate      : el("from-date"),
  toDate        : el("to-date"),
  filterCategory: el("filter-category"),
  filterSummary : el("filter-summary"),
  entriesBody   : el("entries-body"),
  tableFooter   : el("table-footer"),
  printBtn      : el("print-btn"),
  tableHeaders  : Array.from(document.querySelectorAll("#main-table th[data-sort]")),
  rowTemplate   : el("row-template"),
  // reports
  reportYear    : el("report-year"),
  reportMode    : el("report-mode"),
  reportChartEl : el("report-chart"),
  statsList     : el("stats-list"),
  categoryChartEl: el("category-chart"),
  categoryLegend : el("category-legend"),
  yearlySummary  : el("yearly-summary"),
  // import
  uploadZone    : el("upload-zone"),
  excelInput    : el("excel-input"),
  excelMapper   : el("excel-mapper"),
  importSteps   : Array.from(document.querySelectorAll("#import-steps .import-step")),
  excelSheet    : el("excel-sheet"),
  excelType     : el("excel-type"),
  excelAmountMode: el("excel-amount-mode"),
  excelHasHeader : el("excel-has-header"),
  excelFixedDate : el("excel-fixed-date"),
  excelStartRow  : el("excel-start-row"),
  profileName    : el("profile-name"),
  saveProfileBtn : el("save-profile-btn"),
  profileSelect  : el("profile-select"),
  loadProfileBtn : el("load-profile-btn"),
  deleteProfileBtn: el("delete-profile-btn"),
  setDefaultProfileBtn  : el("set-default-profile-btn"),
  clearDefaultProfileBtn: el("clear-default-profile-btn"),
  autoProfileMode: el("auto-profile-mode"),
  exportProfilesBtn : el("export-profiles-btn"),
  importProfilesInput: el("import-profiles-input"),
  mapDescription : el("map-description"),
  mapAmount      : el("map-amount"),
  mapDate        : el("map-date"),
  mapNotes       : el("map-notes"),
  mapRecipient   : el("map-recipient"),
  excelRowMode   : el("excel-row-mode"),
  autoMapBtn     : el("auto-map-btn"),
  excelImportSearch: el("excel-import-search"),
  selectAllRowsBtn: el("select-all-rows-btn"),
  clearAllRowsBtn : el("clear-all-rows-btn"),
  selectedRowsCounter: el("selected-rows-counter"),
  excelRawPreview: el("excel-raw-preview"),
  excelParsedPreview: el("excel-parsed-preview"),
  quickImportBtn : el("quick-import-btn"),
  importExcelBtn : el("import-excel-btn"),
  // auto-backup
  autoBackupToggle     : el("auto-backup-toggle"),
  autoBackupIntervalSel: el("auto-backup-interval"),
};

// ══════════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════════
function formatCurrency(num) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(num || 0);
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toIsoDate(value) {
  if (!value) return "";
  if (typeof value === "number") {
    const p = XLSX.SSF.parse_date_code(value);
    if (!p) return "";
    return `${p.y}-${String(p.m).padStart(2,"0")}-${String(p.d).padStart(2,"0")}`;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    const parts = trimmed.match(/^(\d{1,4})[\/.\- ](\d{1,2})[\/.\- ](\d{1,4})$/);
    if (parts) {
      let [,a,b,c] = parts.map(Number);
      let d, mo, y;
      if (String(parts[1]).length === 4) {
        y = a; mo = b; d = c;
      } else if (String(parts[3]).length === 4) {
        d = a; mo = b; y = c;
      } else if (a > 31) {
        y = a; mo = b; d = c;
      } else {
        d = a; mo = b; y = c;
      }
      if (y < 100) y += y >= 70 ? 1900 : 2000;
      if (d>=1&&d<=31&&mo>=1&&mo<=12&&y>=1900&&y<=2200)
        return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    }
    const m = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
    if (m) {
      let [,d,mo,y] = m.map(Number);
      if (y < 100) y += y >= 70 ? 1900 : 2000;
      if (d>=1&&d<=31&&mo>=1&&mo<=12&&y>=1900&&y<=2200)
        return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    }
  }
  const d = new Date(value);
  return isNaN(d) ? "" : d.toISOString().slice(0,10);
}

function toHebrewLetters(n) {
  const ones   = ["","א","ב","ג","ד","ה","ו","ז","ח","ט"];
  const tens   = ["","י","כ","ל","מ","נ","ס","ע","פ","צ"];
  const hunds  = ["","ק","ר","ש","ת","תק","תר","תש","תת","תתק"];
  n = Number(n);
  if (!Number.isInteger(n)||n<=0) return "";
  let r = "";
  const h = Math.floor(n/100);
  if (h>0) r += hunds[h]||"";
  n %= 100;
  if (n===15) return r+"טו";
  if (n===16) return r+"טז";
  r += tens[Math.floor(n/10)]||"";
  r += ones[n%10]||"";
  return r;
}

function addGeresh(t) {
  if (!t) return "";
  if (t.length===1) return t+"׳";
  return t.slice(0,-1)+"״"+t.slice(-1);
}


function looksLikeHeaderRow(row) {
  const cells = Array.isArray(row) ? row : [];
  if (!cells.length) return false;
  const filled = cells.filter(v => String(v == null ? "" : v).trim() !== "");
  if (!filled.length) return false;
  const textish = filled.filter(v => {
    if (v instanceof Date) return false;
    if (typeof v === "number") return false;
    const s = String(v).trim();
    if (!s) return false;
    return !toIsoDate(s);
  });
  return textish.length >= Math.max(1, Math.ceil(filled.length / 2));
}

function toHebrewDate(greg) {
  if (!greg) return "";
  const d = new Date(greg);
  if (isNaN(d)) return "";
  try {
    const parts = new Intl.DateTimeFormat("he-IL-u-ca-hebrew",{day:"numeric",month:"long",year:"numeric"}).formatToParts(d);
    const get = type => parts.find(p=>p.type===type);
    const dayPart=get("day"), monPart=get("month"), yrPart=get("year");
    if (!dayPart||!monPart||!yrPart) return "";
    const dH = addGeresh(toHebrewLetters(Number(dayPart.value)));
    const yH = addGeresh(toHebrewLetters(Number(yrPart.value)%1000));
    return `${dH} ${monPart.value.trim()} ${yH}`;
  } catch { return ""; }
}

function todayIso() { return new Date().toISOString().slice(0,10); }
function nowIso()   { return new Date().toISOString(); }

// ══════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════
function showToast(msg, type="info", ms=3000) {
  const t = els.toast;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.classList.remove("show"); }, ms);
}

// ══════════════════════════════════════════════════════════
//  MODAL
// ══════════════════════════════════════════════════════════
function showModal(title, msg, onConfirm) {
  els.modalTitle.textContent = title;
  els.modalMsg.textContent = msg;
  els.modalOverlay.hidden = false;
  modalCb = onConfirm;
}

function closeModal() {
  els.modalOverlay.hidden = true;
  modalCb = null;
}

// ══════════════════════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════════════════════
function applyTheme(dark) {
  document.documentElement.dataset.theme = dark ? "dark" : "";
  els.themeIcon.textContent  = dark ? "☀️" : "🌙";
  els.themeLabel.textContent = dark ? "מצב יום" : "מצב לילה";
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  if (reportChart)   renderReportChart();
  if (categoryChart) renderCategoryChart();
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    applyTheme(true);
  }
}

// ══════════════════════════════════════════════════════════
//  SECTION NAVIGATION
// ══════════════════════════════════════════════════════════
function switchSection(name) {
  activeSection = name;
  els.navItems.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.section === name);
  });
  document.querySelectorAll(".section").forEach(s => {
    s.classList.toggle("hidden", s.id !== `section-${name}`);
    s.classList.toggle("active", s.id === `section-${name}`);
  });
  if (name === "reports") {
    renderReportChart();
    renderCategoryChart();
    renderStats();
    renderYearlySummary();
  }
}

// ══════════════════════════════════════════════════════════
//  STATE PERSISTENCE
// ══════════════════════════════════════════════════════════
function normalizeEntry(e) {
  return {
    id         : e.id || `${Date.now()}-${Math.random()}`,
    type       : e.type === "donation" ? "donation" : "income",
    date       : toIsoDate(e.date) || todayIso(),
    description: String(e.description || ""),
    amount     : toNumber(e.amount),
    recipient  : String(e.recipient || ""),
    category   : String(e.category || ""),
    notes      : String(e.notes || ""),
    hebrewDate : String(e.hebrewDate || toHebrewDate(toIsoDate(e.date)))
  };
}

function saveState() {
  state.date = nowIso();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries)) return;
    state = {
      entries: parsed.entries.map(normalizeEntry),
      version: parsed.version || "5.0",
      date   : parsed.date || nowIso()
    };
    saveState();
  } catch { console.warn("Failed to parse state"); }
}

// ══════════════════════════════════════════════════════════
//  UNDO / REDO
// ══════════════════════════════════════════════════════════
function cloneEntries(arr) { return arr.map(e => ({...e})); }

function pushHistory() {
  undoStack.push(cloneEntries(state.entries));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  updateUndoRedo();
}

function updateUndoRedo() {
  if (els.undoBtn) els.undoBtn.disabled = undoStack.length === 0;
  if (els.redoBtn) els.redoBtn.disabled = redoStack.length === 0;
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(cloneEntries(state.entries));
  state.entries = undoStack.pop();
  saveState(); rerender(); updateUndoRedo();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(cloneEntries(state.entries));
  state.entries = redoStack.pop();
  saveState(); rerender(); updateUndoRedo();
}

// ══════════════════════════════════════════════════════════
//  SUMMARY CALCULATIONS
// ══════════════════════════════════════════════════════════
function calcSummary(entries) {
  const income    = entries.filter(e=>e.type==="income").reduce((s,e)=>s+toNumber(e.amount),0);
  const donations = entries.filter(e=>e.type==="donation").reduce((s,e)=>s+Math.max(0,toNumber(e.amount)),0);
  const maaser    = Math.max(0, income * 0.1);
  const chomesh   = Math.max(0, income * 0.2);
  const remMaaser = Math.max(0, maaser - donations);
  const remChomesh= Math.max(0, chomesh - donations);
  const surpMaaser = Math.max(0, donations - maaser);
  const surpChomesh= Math.max(0, donations - chomesh);
  return {
    income, donations, maaser, chomesh,
    remMaaser, remChomesh, surpMaaser, surpChomesh,
    maaserPct : maaser > 0 ? Math.min(100, (donations / maaser) * 100) : 0,
    chomeshPct: chomesh > 0 ? Math.min(100, (donations / chomesh) * 100) : 0,
    isMaaserDone : maaser > 0 && remMaaser === 0,
    isChomeshDone: chomesh > 0 && remChomesh === 0
  };
}

// ══════════════════════════════════════════════════════════
//  RENDER SUMMARY
// ══════════════════════════════════════════════════════════
function renderSummary() {
  const s = calcSummary(state.entries);
  els.totalIncome.textContent   = formatCurrency(s.income);
  els.totalDonations.textContent= formatCurrency(s.donations);
  els.maaserTarget.textContent  = formatCurrency(s.maaser);
  els.chomeshTarget.textContent = formatCurrency(s.chomesh);
  els.remainingMaaser.textContent  = formatCurrency(s.remMaaser);
  els.remainingChomesh.textContent = formatCurrency(s.remChomesh);

  // Progress bars
  els.maaserProgress.style.width  = `${s.maaserPct}%`;
  els.chomeshProgress.style.width = `${s.chomeshPct}%`;

  // Status notes
  if (s.isMaaserDone) {
    els.maaserStatusNote.textContent = s.surpMaaser > 0
      ? `✅ הושלם! עודף: ${formatCurrency(s.surpMaaser)}`
      : "✅ הושלם!";
    els.maaserStatusCard.classList.add("done");
  } else if (s.maaser > 0) {
    els.maaserStatusNote.textContent = `יתרה: ${formatCurrency(s.remMaaser)} (${(s.maaserPct).toFixed(0)}%)`;
    els.maaserStatusCard.classList.remove("done");
  } else {
    els.maaserStatusNote.textContent = "אין חובת מעשר";
    els.maaserStatusCard.classList.remove("done");
  }

  if (s.isChomeshDone) {
    els.chomeshStatusNote.textContent = s.surpChomesh > 0
      ? `✅ הושלם! עודף: ${formatCurrency(s.surpChomesh)}`
      : "✅ הושלם!";
    els.chomeshStatusCard.classList.add("done");
  } else if (s.chomesh > 0) {
    els.chomeshStatusNote.textContent = `יתרה: ${formatCurrency(s.remChomesh)} (${(s.chomeshPct).toFixed(0)}%)`;
    els.chomeshStatusCard.classList.remove("done");
  } else {
    els.chomeshStatusNote.textContent = "אין חובת חומש";
    els.chomeshStatusCard.classList.remove("done");
  }

  // Dashboard date
  if (els.dashboardDate) {
    const today = new Date();
    els.dashboardDate.textContent = today.toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  }
}

// ══════════════════════════════════════════════════════════
//  RENDER RECENT LIST
// ══════════════════════════════════════════════════════════
function renderRecent() {
  const sorted = state.entries.slice().sort((a,b) => a.date < b.date ? 1 : -1).slice(0, 8);
  if (!sorted.length) {
    els.recentList.innerHTML = `<li class="recent-empty">אין רשומות עדיין. הוסף הכנסה או תרומה למעלה.</li>`;
    return;
  }
  els.recentList.innerHTML = sorted.map(e => {
    const cls = e.type === "income" ? "income" : "donation";
    const sign = e.type === "donation" ? "-" : "+";
    const desc = escapeHtml(e.description);
    const date = escapeHtml(e.date);
    return `<li class="recent-item">
      <span class="recent-badge ${cls}"></span>
      <span class="recent-desc" title="${desc}">${desc}</span>
      <span class="recent-amount ${cls}">${sign}${formatCurrency(Math.abs(toNumber(e.amount)))}</span>
      <span class="recent-date">${date}</span>
    </li>`;
  }).join("");
}

// ══════════════════════════════════════════════════════════
//  FILTER & SORT
// ══════════════════════════════════════════════════════════
function getFilteredEntries() {
  const q    = (els.search.value||"").trim().toLowerCase();
  const year = (els.filterYear.value||"");
  const from = els.fromDate.value;
  const to   = els.toDate.value;
  const cat  = els.filterCategory.value;

  return state.entries.filter(e => {
    if (activeTab !== "all" && e.type !== activeTab) return false;
    if (year && !String(e.date||"").startsWith(`${year}-`)) return false;
    if (from && e.date < from) return false;
    if (to   && e.date > to)   return false;
    if (cat  && e.category !== cat) return false;
    if (!q) return true;
    const hay = [e.description, e.notes, e.recipient, e.category].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });
}

function sortEntries(list) {
  return list.slice().sort((a,b) => {
    let av = a[sortField], bv = b[sortField];
    if (sortField === "amount") { av = Math.abs(toNumber(av)); bv = Math.abs(toNumber(bv)); }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ?  1 : -1;
    return 0;
  });
}

// ══════════════════════════════════════════════════════════
//  RENDER TABLE
// ══════════════════════════════════════════════════════════
function renderFilterYearOptions() {
  const prev  = els.filterYear.value;
  const years = Array.from(new Set(state.entries.map(e=>Number(String(e.date||"").slice(0,4))).filter(n=>n>1900))).sort((a,b)=>b-a);
  els.filterYear.innerHTML = '<option value="">כל השנים</option>' + years.map(y=>`<option value="${y}">${y}</option>`).join("");
  if (prev && years.includes(Number(prev))) els.filterYear.value = prev;
}

function renderTable() {
  const filtered = getFilteredEntries();
  const sorted   = sortEntries(filtered);

  els.entriesBody.innerHTML = "";
  for (const item of sorted) {
    const frag = els.rowTemplate.content.cloneNode(true);
    const row  = frag.querySelector("tr");
    const typeCls = item.type === "donation" ? "donation" : "income";
    const typeLabel = item.type === "donation" ? "🤲 תרומה" : "💰 הכנסה";
    row.querySelector('[data-k="type"]').innerHTML =
      `<span class="type-badge ${typeCls}">${typeLabel}</span>`;
    row.querySelector('[data-k="date"]').textContent       = item.date;
    row.querySelector('[data-k="hebrewDate"]').textContent = toHebrewDate(item.date)||item.hebrewDate||"-";
    row.querySelector('[data-k="description"]').textContent= item.description||"";
    const amtCell = row.querySelector('[data-k="amount"]');
    amtCell.textContent = formatCurrency(toNumber(item.amount));
    amtCell.classList.add(typeCls+"-amount");
    row.querySelector('[data-k="category"]').innerHTML =
      item.category ? `<span class="cat-badge">${item.category}</span>` : '<span style="color:var(--muted)">—</span>';
    row.querySelector('[data-k="recipient"]').textContent  = item.recipient||"-";
    row.querySelector('[data-k="notes"]').textContent      = item.notes||"-";
    row.querySelector('[data-action="edit"]').dataset.id   = String(item.id);
    row.querySelector('[data-action="delete"]').dataset.id = String(item.id);
    els.entriesBody.appendChild(frag);
  }

  // Summary footer
  const incomeSum    = filtered.filter(e=>e.type==="income").reduce((s,e)=>s+toNumber(e.amount),0);
  const donationSum  = filtered.filter(e=>e.type==="donation").reduce((s,e)=>s+Math.max(0,toNumber(e.amount)),0);
  els.filterSummary.textContent = `${filtered.length} רשומות`;
  els.tableFooter.innerHTML = filtered.length
    ? `<span>הכנסות: <strong>${formatCurrency(incomeSum)}</strong></span><span>תרומות: <strong>${formatCurrency(donationSum)}</strong></span><span>סה"כ תוצאות: ${filtered.length}</span>`
    : `<span style="color:var(--muted)">לא נמצאו רשומות</span>`;

  // Update sort indicators
  els.tableHeaders.forEach(th => {
    th.classList.remove("sorted-asc","sorted-desc");
    if (th.dataset.sort === sortField) {
      th.classList.add(sortDir === "asc" ? "sorted-asc" : "sorted-desc");
    }
  });
}

// ══════════════════════════════════════════════════════════
//  FORM
// ══════════════════════════════════════════════════════════
function toggleRecipient() {
  const isDonation = els.typeEl.value === "donation";
  els.recipientWrap.style.display = isDonation ? "" : "none";
  els.categoryWrap.style.display  = isDonation ? "" : "none";
}

function updateHebrewDatePreview() {
  els.hebrewDate.value = toHebrewDate(els.dateEl.value);
}

function resetForm() {
  els.editingId.value  = "";
  els.saveBtn.textContent = "💾 שמור פעולה";
  els.cancelEditBtn.classList.add("hidden");
  els.form.reset();
  els.dateEl.value = todayIso();
  updateHebrewDatePreview();
  els.typeEl.value = "income";
  toggleRecipient();
}

function enterEditMode(id) {
  const item = state.entries.find(x => String(x.id) === String(id));
  if (!item) return;
  els.editingId.value    = String(item.id);
  els.typeEl.value       = item.type;
  els.dateEl.value       = item.date;
  els.hebrewDate.value   = toHebrewDate(item.date)||item.hebrewDate||"";
  els.description.value  = item.description;
  els.amount.value       = String(item.amount);
  els.recipient.value    = item.recipient||"";
  els.category.value     = item.category||"";
  els.notes.value        = item.notes||"";
  toggleRecipient();
  els.saveBtn.textContent = "✏️ עדכן פעולה";
  els.cancelEditBtn.classList.remove("hidden");
  // Scroll to form on mobile
  document.getElementById("section-dashboard").scrollIntoView({behavior:"smooth"});
  if (activeSection !== "dashboard") switchSection("dashboard");
}

function onSubmit(e) {
  e.preventDefault();
  const type   = els.typeEl.value;
  const amount = toNumber(els.amount.value);
  if (!els.dateEl.value || !els.description.value.trim()) { showToast("נא למלא תאריך ותיאור","error"); return; }
  if (type === "donation" && amount <= 0) { showToast("תרומה חייבת להיות סכום חיובי","error"); return; }
  if (type === "income"   && amount === 0) { showToast("הכנסה לא יכולה להיות אפס","error"); return; }

  const existingId = els.editingId.value;
  const entry = {
    id         : existingId || `${Date.now()}-${Math.random()}`,
    type,
    date       : els.dateEl.value,
    description: els.description.value.trim(),
    amount,
    recipient  : type === "donation" ? (els.recipient.value||"").trim() : "",
    category   : type === "donation" ? (els.category.value||"") : "",
    notes      : (els.notes.value||"").trim(),
    hebrewDate : toHebrewDate(els.dateEl.value)
  };

  pushHistory();
  const idx = state.entries.findIndex(x => String(x.id) === String(entry.id));
  if (idx === -1) state.entries.push(entry);
  else state.entries[idx] = entry;

  saveState();
  resetForm();
  rerender();
  showToast(existingId ? "✏️ הרשומה עודכנה" : "✅ הרשומה נשמרה","success");
}

function onRowAction(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (!action || !id) return;

  if (action === "delete") {
    showModal("מחיקת רשומה","האם למחוק את הרשומה? לא ניתן לשחזר (אלא דרך בטל פעולה).", () => {
      pushHistory();
      state.entries = state.entries.filter(x => String(x.id) !== String(id));
      saveState(); rerender();
      showToast("🗑️ הרשומה נמחקה","info");
    });
    return;
  }
  if (action === "edit") enterEditMode(id);
}

// ══════════════════════════════════════════════════════════
//  REPORT CHART
// ══════════════════════════════════════════════════════════
function renderReportYearOptions() {
  const years = Array.from(new Set(state.entries.map(e=>Number((e.date||"").slice(0,4))).filter(n=>n>1900))).sort((a,b)=>b-a);
  if (!years.length) years.push(new Date().getFullYear());
  const cur = els.reportYear.value;
  els.reportYear.innerHTML = years.map(y=>`<option value="${y}">${y}</option>`).join("");
  els.reportYear.value = cur && years.includes(Number(cur)) ? cur : String(years[0]);
}

function getReportData() {
  const mode = els.reportMode.value;
  const year = Number(els.reportYear.value);

  if (mode === "yearly") {
    const byYear = new Map();
    for (const e of state.entries) {
      const y = Number((e.date||"").slice(0,4));
      if (!y) continue;
      const b = byYear.get(y)||{income:0,donation:0};
      if (e.type==="income")   b.income   += toNumber(e.amount);
      if (e.type==="donation") b.donation += Math.max(0,toNumber(e.amount));
      byYear.set(y,b);
    }
    const labels = Array.from(byYear.keys()).sort((a,b)=>a-b).map(String);
    return { labels, income: labels.map(y=>byYear.get(Number(y)).income), donation: labels.map(y=>byYear.get(Number(y)).donation) };
  }

  const labels   = ["ינו","פבר","מרץ","אפר","מאי","יונ","יול","אוג","ספט","אוק","נוב","דצמ"];
  const income   = new Array(12).fill(0);
  const donation = new Array(12).fill(0);
  for (const e of state.entries) {
    const y = Number((e.date||"").slice(0,4));
    const m = Number((e.date||"").slice(5,7)) - 1;
    if (y!==year || m<0 || m>11) continue;
    if (e.type==="income")   income[m]   += toNumber(e.amount);
    if (e.type==="donation") donation[m] += Math.max(0,toNumber(e.amount));
  }
  return { labels, income, donation };
}

function isDark() { return document.documentElement.dataset.theme === "dark"; }

function renderReportChart() {
  if (!els.reportChartEl) return;
  const data = getReportData();
  const gridColor = isDark() ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
  const tickColor = isDark() ? "#8899b4" : "#6b7280";

  if (reportChart) reportChart.destroy();
  reportChart = new Chart(els.reportChartEl, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [
        { label:"הכנסות",  data:data.income,   backgroundColor:"rgba(9,132,227,0.75)",  borderRadius:5 },
        { label:"תרומות",  data:data.donation, backgroundColor:"rgba(0,184,148,0.75)",  borderRadius:5 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend:{ position:"top", labels:{ color: tickColor } } },
      scales: {
        y: { beginAtZero:true, grid:{color:gridColor}, ticks:{color:tickColor,callback:v=>formatCurrency(v)} },
        x: { grid:{display:false}, ticks:{color:tickColor} }
      }
    }
  });
}

// ══════════════════════════════════════════════════════════
//  CATEGORY CHART
// ══════════════════════════════════════════════════════════
const CAT_COLORS = ["#6c5ce7","#00b894","#0984e3","#fdcb6e","#e17055","#a29bfe","#fd79a8","#55efc4"];

function renderCategoryChart() {
  if (!els.categoryChartEl) return;
  const donations = state.entries.filter(e=>e.type==="donation");
  const byCategory = {};
  for (const e of donations) {
    const cat = e.category || "ללא קטגוריה";
    byCategory[cat] = (byCategory[cat]||0) + Math.max(0,toNumber(e.amount));
  }
  const cats   = Object.keys(byCategory).sort((a,b)=>byCategory[b]-byCategory[a]);
  const values = cats.map(c=>byCategory[c]);
  const colors = cats.map((_,i)=>CAT_COLORS[i%CAT_COLORS.length]);
  const tickColor = isDark() ? "#8899b4" : "#6b7280";

  if (categoryChart) categoryChart.destroy();
  if (!cats.length) {
    els.categoryChartEl.getContext("2d").clearRect(0,0,els.categoryChartEl.width,els.categoryChartEl.height);
    els.categoryLegend.innerHTML = '<span style="color:var(--muted);font-size:.85rem">אין נתוני תרומות</span>';
    return;
  }
  categoryChart = new Chart(els.categoryChartEl, {
    type:"doughnut",
    data:{ labels:cats, datasets:[{ data:values, backgroundColor:colors, borderWidth:2, borderColor: isDark()?"#1a1f2e":"#fff" }] },
    options:{
      responsive:true,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${formatCurrency(ctx.raw)}`}}
      }
    }
  });

  els.categoryLegend.innerHTML = cats.map((c,i)=>
    `<div class="legend-item"><span class="legend-dot" style="background:${colors[i]}"></span><span>${c}: ${formatCurrency(values[i])}</span></div>`
  ).join("");
}

// ══════════════════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════════════════
function renderStats() {
  const incomes   = state.entries.filter(e=>e.type==="income");
  const donations = state.entries.filter(e=>e.type==="donation");
  const totalInc  = incomes.reduce((s,e)=>s+toNumber(e.amount),0);
  const totalDon  = donations.reduce((s,e)=>s+Math.max(0,toNumber(e.amount)),0);
  const avgInc    = incomes.length  ? totalInc/incomes.length : 0;
  const avgDon    = donations.length ? totalDon/donations.length : 0;
  const s         = calcSummary(state.entries);
  const donPct    = totalInc > 0 ? (totalDon/totalInc*100).toFixed(1) : 0;

  const rows = [
    ["סה\"כ הכנסות",       formatCurrency(totalInc)],
    ["סה\"כ תרומות",       formatCurrency(totalDon)],
    ["ממוצע הכנסה",        formatCurrency(avgInc)],
    ["ממוצע תרומה",        formatCurrency(avgDon)],
    ["% תרומות מהכנסות",  `${donPct}%`],
    ["מספר רשומות",        String(state.entries.length)],
    ["חובת מעשר (10%)",    formatCurrency(s.maaser)],
    ["נותר למעשר",         formatCurrency(s.remMaaser)],
    ["חובת חומש (20%)",    formatCurrency(s.chomesh)],
    ["נותר לחומש",         formatCurrency(s.remChomesh)],
  ];

  els.statsList.innerHTML = rows.map(([label,val])=>
    `<div class="stats-row"><span class="stats-label">${label}</span><span class="stats-val">${val}</span></div>`
  ).join("");
}

// ══════════════════════════════════════════════════════════
//  YEARLY SUMMARY
// ══════════════════════════════════════════════════════════
function renderYearlySummary() {
  const byYear = new Map();
  for (const e of state.entries) {
    const y = Number((e.date||"").slice(0,4));
    if (!y) continue;
    const b = byYear.get(y)||{income:0,donation:0};
    if (e.type==="income")   b.income   += toNumber(e.amount);
    if (e.type==="donation") b.donation += Math.max(0,toNumber(e.amount));
    byYear.set(y,b);
  }
  if (!byYear.size) { els.yearlySummary.innerHTML = '<p style="color:var(--muted);font-size:.85rem">אין נתונים</p>'; return; }

  const years = Array.from(byYear.keys()).sort((a,b)=>b-a);
  els.yearlySummary.innerHTML = `
    <table>
      <thead><tr><th>שנה</th><th>הכנסות</th><th>תרומות</th><th>מעשר חובה</th><th>יתרה</th></tr></thead>
      <tbody>${years.map(y=>{
        const b=byYear.get(y);
        const maaser = b.income*0.1;
        const rem    = Math.max(0,maaser-b.donation);
        return `<tr>
          <td><strong>${y}</strong></td>
          <td>${formatCurrency(b.income)}</td>
          <td>${formatCurrency(b.donation)}</td>
          <td>${formatCurrency(maaser)}</td>
          <td style="color:${rem>0?'var(--red)':'var(--green)'}">${rem>0?formatCurrency(rem):'✅ הושלם'}</td>
        </tr>`;
      }).join("")}</tbody>
    </table>`;
}

// ══════════════════════════════════════════════════════════
//  EXPORT / IMPORT
// ══════════════════════════════════════════════════════════
function exportBackup() {
  const blob = new Blob([JSON.stringify(buildBackupPayload(),null,2)], {type:"application/json"});
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"),{href:url,download:`backup_${todayIso()}.json`});
  a.click(); URL.revokeObjectURL(url);
  showToast("💾 גיבוי הורד","success");
}

function exportBackupBeforeClear() {
  const blob = new Blob([JSON.stringify(buildBackupPayload(),null,2)],{type:"application/json"});
  const url  = URL.createObjectURL(blob);
  const stamp= new Date().toISOString().replace(/[:]/g,"-").slice(0,19);
  const a    = Object.assign(document.createElement("a"),{href:url,download:`backup_before_clear_${stamp}.json`});
  a.click(); URL.revokeObjectURL(url);
}

function buildBackupPayload() {
  return {
    kind: "maaser-chomesh-backup",
    exportedAt: nowIso(),
    state: { ...state, entries: state.entries.map(normalizeEntry) },
    profiles: importProfiles,
    profileSettings,
    theme: localStorage.getItem(THEME_KEY) || "light",
    autoBackup: {
      enabled: autoBackupEnabled,
      intervalMinutes: autoBackupIntervalMinutes
    }
  };
}

function exportCsv() {
  const header = ["type","date","hebrewDate","description","amount","category","recipient","notes"];
  const lines  = [header.join(",")];
  for (const e of state.entries) {
    const row = [e.type,e.date,toHebrewDate(e.date)||e.hebrewDate||"",e.description,e.amount,e.category||"",e.recipient||"",e.notes||""]
      .map(v=>'"'+String(v).replaceAll('"','""')+'"');
    lines.push(row.join(","));
  }
  const blob = new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"),{href:url,download:`entries_${todayIso()}.csv`});
  a.click(); URL.revokeObjectURL(url);
  showToast("📄 CSV הורד","success");
}

function exportXlsx() {
  const rows = state.entries.map(e=>({
    type:e.type, date:e.date, hebrewDate:toHebrewDate(e.date)||e.hebrewDate||"",
    description:e.description, amount:e.amount, category:e.category||"",
    recipient:e.recipient||"", notes:e.notes||""
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"entries");
  XLSX.writeFile(wb,`entries_${todayIso()}.xlsx`);
  showToast("📊 XLSX הורד","success");
}

async function importBackup(file) {
  const text   = await file.text();
  const parsed = JSON.parse(text);

  if (parsed && parsed.kind === "maaser-chomesh-backup" && parsed.state && Array.isArray(parsed.state.entries)) {
   pushHistory();
   state = {
     entries: parsed.state.entries.map(normalizeEntry),
     version: parsed.state.version || "5.0",
     date   : parsed.state.date || nowIso()
   };
   importProfiles = parsed.profiles && typeof parsed.profiles === "object" ? parsed.profiles : {};
   profileSettings = {
     defaultProfile: parsed.profileSettings?.defaultProfile || "",
     autoProfileMode: parsed.profileSettings?.autoProfileMode === "off" ? "off" : "on"
   };
   autoBackupEnabled = !!parsed.autoBackup?.enabled;
   autoBackupIntervalMinutes = Number(parsed.autoBackup?.intervalMinutes) || 10;
   saveState();
   saveProfiles();
   saveProfileSettings();
   saveAutoBackupSettings();
   renderProfileOptions();
   applyAutoBackupUi();
   startAutoBackupTimer();
   applyTheme(parsed.theme === "dark");
   rerender();
   showToast("📂 שוחזרו כל הנתונים, התבניות וההגדרות","success",5000);
   return;
  }

  if (!parsed||!Array.isArray(parsed.entries)) throw new Error("קובץ לא תקין");
  const normalized = {
   entries: parsed.entries.map(normalizeEntry),
   version: parsed.version||"5.0",
   date   : parsed.date||nowIso()
  };
  const byId = new Map(state.entries.map(e=>[String(e.id),e]));
  pushHistory();
  normalized.entries.forEach(item=>byId.set(String(item.id),item));
  state.entries = Array.from(byId.values());
  state.version = normalized.version;
  state.date    = nowIso();
  saveState(); rerender();
  showToast(`📂 יובאו ${normalized.entries.length} רשומות`,"success");
}

// ══════════════════════════════════════════════════════════
//  PROFILES
// ══════════════════════════════════════════════════════════
function loadProfiles() {
  try { importProfiles = JSON.parse(localStorage.getItem(PROFILES_KEY)||"{}") || {}; } catch { importProfiles={}; }
}
function loadProfileSettings() {
  try {
    const p = JSON.parse(localStorage.getItem(PROF_SETTINGS_KEY)||"{}");
    profileSettings.defaultProfile  = p.defaultProfile||"";
    profileSettings.autoProfileMode = p.autoProfileMode==="off"?"off":"on";
  } catch {}
}
function saveProfiles()        { localStorage.setItem(PROFILES_KEY,JSON.stringify(importProfiles)); }
function saveProfileSettings() { localStorage.setItem(PROF_SETTINGS_KEY,JSON.stringify(profileSettings)); }

function clearAllAppData() {
  stopAutoBackupTimer();
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  localStorage.removeItem(PROFILES_KEY);
  localStorage.removeItem(PROF_SETTINGS_KEY);
  localStorage.removeItem(THEME_KEY);
  localStorage.removeItem(AUTO_BACKUP_KEY);

  state = { entries: [], version: "5.0", date: nowIso() };
  undoStack = [];
  redoStack = [];
  importProfiles = {};
  profileSettings = { defaultProfile: "", autoProfileMode: "on" };
  excelRows = [];
  excelWorkbook = null;
  excelFileName = "";
  manualSelectedRows = new Set();
  autoBackupEnabled = false;
  autoBackupIntervalMinutes = 10;

  document.documentElement.dataset.theme = "";
  if (els.themeIcon)  els.themeIcon.textContent = "🌙";
  if (els.themeLabel) els.themeLabel.textContent = "מצב לילה";
  applyAutoBackupUi();
  renderProfileOptions();
  resetForm();
  rerender();
  updateUndoRedo();
}

function renderProfileOptions() {
  const names = Object.keys(importProfiles).sort((a,b)=>a.localeCompare(b,"he"));
  els.profileSelect.innerHTML = ['<option value="">בחר תבנית...</option>'].concat(names.map(n=>`<option value="${n}">${n}</option>`)).join("");
  els.autoProfileMode.value = profileSettings.autoProfileMode;
}

function getCurrentMappingModel() {
  return {
    excelType:els.excelType.value, excelAmountMode:els.excelAmountMode.value,
    excelHasHeader:els.excelHasHeader.value,
    mapDescription:els.mapDescription.value, mapAmount:els.mapAmount.value,
    mapDate:els.mapDate.value, mapNotes:els.mapNotes.value, mapRecipient:els.mapRecipient.value
  };
}

function applyMappingModel(model) {
  if (!model) return;
  els.excelType.value       = model.excelType       || els.excelType.value;
  els.excelAmountMode.value = model.excelAmountMode || els.excelAmountMode.value;
  els.excelHasHeader.value  = model.excelHasHeader  || els.excelHasHeader.value;
  els.mapDescription.value  = model.mapDescription  ?? els.mapDescription.value;
  els.mapAmount.value       = model.mapAmount        ?? els.mapAmount.value;
  els.mapDate.value         = model.mapDate          ?? els.mapDate.value;
  els.mapNotes.value        = model.mapNotes         ?? els.mapNotes.value;
  els.mapRecipient.value    = model.mapRecipient     ?? els.mapRecipient.value;
  renderExcelPreview(); renderParsedExcelPreview();
}

function findProfileByFileName(fileName) {
  const lower = (fileName||"").toLowerCase();
  for (const name of Object.keys(importProfiles)) {
    const tokens = name.toLowerCase().split(/[\s\-_]+/).filter(t=>t.length>=3);
    if (tokens.some(t=>lower.includes(t))) return name;
  }
  return "";
}

function applyBestProfileForCurrentFile() {
  if (profileSettings.autoProfileMode==="off") return;
  let name = findProfileByFileName(excelFileName);
  if (!name && profileSettings.defaultProfile && importProfiles[profileSettings.defaultProfile])
    name = profileSettings.defaultProfile;
  if (!name) return;
  applyMappingModel(importProfiles[name]);
  els.profileSelect.value = name;
  els.profileName.value   = name;
}

function saveCurrentProfile() {
  const name = (els.profileName.value||"").trim();
  if (!name) { showToast("יש להזין שם תבנית","error"); return; }
  importProfiles[name] = getCurrentMappingModel();
  saveProfiles(); renderProfileOptions();
  els.profileSelect.value = name;
  showToast(`💾 תבנית "${name}" נשמרה`,"success");
}

function loadSelectedProfile() {
  const name = els.profileSelect.value;
  if (!name||!importProfiles[name]) { showToast("לא נבחרה תבנית","error"); return; }
  applyMappingModel(importProfiles[name]);
  els.profileName.value = name;
  showToast(`תבנית "${name}" נטענה`,"success");
}

function deleteSelectedProfile() {
  const name = els.profileSelect.value;
  if (!name||!importProfiles[name]) { showToast("לא נבחרה תבנית למחיקה","error"); return; }
  delete importProfiles[name];
  if (profileSettings.defaultProfile===name) { profileSettings.defaultProfile=""; saveProfileSettings(); }
  saveProfiles(); renderProfileOptions();
  els.profileName.value="";
  showToast("תבנית נמחקה","info");
}

function setDefaultProfile() {
  const name = els.profileSelect.value;
  if (!name||!importProfiles[name]) { showToast("בחר תבנית קודם","error"); return; }
  profileSettings.defaultProfile = name;
  saveProfileSettings();
  showToast(`⭐ "${name}" הוגדרה כברירת מחדל`,"success");
}

function clearDefaultProfile() {
  profileSettings.defaultProfile="";
  saveProfileSettings();
  showToast("ברירת המחדל נוקתה","info");
}

function exportProfilesJson() {
  const payload = { version:"1.0", exportedAt:nowIso(), settings:profileSettings, profiles:importProfiles };
  const blob = new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"),{href:url,download:`import_profiles_${todayIso()}.json`});
  a.click(); URL.revokeObjectURL(url);
  showToast("תבניות יוצאו","success");
}

async function importProfilesJson(file) {
  const text   = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed||typeof parsed.profiles!=="object") throw new Error("קובץ תבניות לא תקין");
  importProfiles = {...importProfiles,...parsed.profiles};
  if (parsed.settings) {
    profileSettings.defaultProfile  = parsed.settings.defaultProfile||profileSettings.defaultProfile;
    profileSettings.autoProfileMode = parsed.settings.autoProfileMode==="off"?"off":profileSettings.autoProfileMode;
  }
  saveProfiles(); saveProfileSettings(); renderProfileOptions();
  showToast("תבניות יובאו","success");
}

// ══════════════════════════════════════════════════════════
//  IMPORT STEPS UI
// ══════════════════════════════════════════════════════════
function setImportStep(step) {
  const s = Math.max(1,Math.min(4,Number(step)||1));
  els.importSteps.forEach(el => { el.classList.toggle("active", Number(el.dataset.step)===s); });
}

// ══════════════════════════════════════════════════════════
//  EXCEL IMPORT
// ══════════════════════════════════════════════════════════
function detectColumnsByHeaders(headers) {
  const patterns = {
    date:       ["תאריך שעה","תאריך","date","יום","תאריך עסקה","ממועד","ערך"],
    description:["תיאור הרשומה","תיאור","description","פרטים","פירוט","מהות הפעולה","שם פעולה","שם בית עסק"],
    amount:     ["סכום","amount","זכות","חובה","חיוב","זיכוי","יתרה פעולה","סכום פעולה","value"],
    notes:      ["הערות","notes","הוספות","הערה","אסמכתא","פרטי עסקה"],
    recipient:  ["שם התאגיד","מקבל","recipient","beneficiary","למי","שם","מוטב"]
  };
  const result = { date:null, description:null, amount:null, notes:null, recipient:null };
  headers.forEach((h,i) => {
    if (!h) return;
    const n = String(h).trim().toLowerCase();
    for (const [field,kws] of Object.entries(patterns)) {
      if (result[field]!==null) continue;
      if (kws.some(k=>n.includes(k.toLowerCase()))) result[field]=i;
    }
  });
  return result;
}

function detectBestHeaderRow(maxScan=30) {
  if (!excelRows.length) return 0;
  let bestRow=0, bestScore=-1;
  const limit = Math.min(maxScan,excelRows.length);
  for (let i=0;i<limit;i++) {
    const row = excelRows[i]||[];
    const headers = row.map((h,j)=>h==null||h===""?`טור ${j+1}`:String(h));
    const d = detectColumnsByHeaders(headers);
    let score = 0;
    if (d.date!==null)        score+=2;
    if (d.amount!==null)      score+=3;
    if (d.description!==null) score+=3;
    if (d.notes!==null)       score+=1;
    if (d.recipient!==null)   score+=1;
    if (score>bestScore) { bestScore=score; bestRow=i; }
  }
  return bestScore>=5 ? bestRow : 0;
}

function autoMapColumns() {
  if (!excelRows.length||els.excelHasHeader.value!=="yes") return;
  const startRow = Math.max(0,Number(els.excelStartRow.value)-1)||0;
  const headers  = (excelRows[startRow]||[]).map((h,i)=>h||`טור ${i+1}`);
  const d = detectColumnsByHeaders(headers);
  if (d.description!==null) els.mapDescription.value = d.description;
  if (d.amount!==null)      els.mapAmount.value      = d.amount;
  if (d.date!==null)        els.mapDate.value        = d.date;
  if (d.notes!==null)       els.mapNotes.value       = d.notes;
  if (d.recipient!==null)   els.mapRecipient.value   = d.recipient;
  renderParsedExcelPreview();
}

function getAmountByMode(raw, type, mode) {
  const n = toNumber(raw);
  if (mode==="as-is") return n;
  if (mode==="abs")   return Math.abs(n);
  if (mode==="flip")  return n*-1;
  return type==="donation" ? Math.abs(n) : n;
}

function getExcelHeaders() {
  if (!excelRows.length) return [];
  const startRow = Math.max(0,Number(els.excelStartRow.value)-1)||0;
  const row = excelRows[startRow]||[];
  return els.excelHasHeader.value==="yes"
    ? row.map((h,i)=>h||`טור ${i+1}`)
    : row.map((_,i)=>`טור ${i+1}`);
}

function updateMappingOptions() {
  if (!excelRows.length) return;
  const startRow = Math.max(0,Number(els.excelStartRow.value)-1)||0;
  const row = excelRows[startRow]||[];
  const options = ['<option value="">לא נבחר</option>']
    .concat(row.map((c,i)=>{
      const t = String(c==null?"":c).trim();
      return `<option value="${i}">${escapeHtml(t||`(ריק) טור ${i+1}`)}</option>`;
    })).join("");
  [els.mapDescription,els.mapAmount,els.mapDate,els.mapNotes,els.mapRecipient].forEach(s=>{
    const prev = s.value;
    s.innerHTML = options;
    if (prev!==""&&row[Number(prev)]!==undefined) s.value=prev;
  });
}

async function onExcelFileChosen(file) {
  excelFileName = file.name||"";
  const buf = await file.arrayBuffer();
  excelWorkbook = XLSX.read(buf,{type:"array", cellDates:true});
  els.excelSheet.innerHTML = excelWorkbook.SheetNames.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  setImportStep(2);
  loadSelectedSheetRows();
  applyBestProfileForCurrentFile();
  showToast(`📂 נטען: ${excelFileName}`,"success");
  els.uploadZone.querySelector(".upload-text").textContent = `✅ ${excelFileName}`;
}

function loadSelectedSheetRows() {
  if (!excelWorkbook) return;
  const name = els.excelSheet.value||excelWorkbook.SheetNames[0];
  const ws   = excelWorkbook.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:""});
  if (!rows.length) throw new Error("empty");
  excelRows = rows;
  const bestHeaderRow = detectBestHeaderRow(40);
  const hasDetectedHeader = bestHeaderRow > 0 || looksLikeHeaderRow(excelRows[bestHeaderRow] || []);
  els.excelHasHeader.value = hasDetectedHeader ? "yes" : "no";
  els.excelStartRow.value  = String(bestHeaderRow+1);
  const bodyStart = hasDetectedHeader ? bestHeaderRow+1 : bestHeaderRow;
  manualSelectedRows = new Set(excelRows.slice(bodyStart).map((_,i)=>i+1));
  updateMappingOptions();
  autoMapColumns();
  renderExcelPreview();
  renderParsedExcelPreview();
  updateSelectedRowsCounter();
  els.excelMapper.classList.remove("hidden");
  setImportStep(3);
}

function getCurrentFilteredBodyIndexSet() {
  const hasHeader = els.excelHasHeader.value==="yes";
  const startRow  = Math.max(0,Number(els.excelStartRow.value)-1)||0;
  const bodyStart = hasHeader ? startRow+1 : startRow;
  const bodyRows  = excelRows.slice(bodyStart);
  const q = (els.excelImportSearch.value||"").trim().toLowerCase();
  const indexed = bodyRows.map((row,idx)=>({row,index1:idx+1}));
  const filtered = q ? indexed.filter(({row})=>row.some(c=>String(c==null?"":c).toLowerCase().includes(q))) : indexed;
  return new Set(filtered.map(x=>x.index1));
}

function collectRowsForImport() {
  const mode      = els.excelRowMode.value;
  const hasHeader = els.excelHasHeader.value==="yes";
  const startRow  = Math.max(0,Number(els.excelStartRow.value)-1)||0;
  const bodyStart = hasHeader ? startRow+1 : startRow;
  const allRows   = excelRows.slice(bodyStart);
  const visible   = getCurrentFilteredBodyIndexSet();
  if (mode==="all") return allRows.filter((_,i)=>visible.has(i+1));
  return allRows.filter((_,i)=>visible.has(i+1)&&manualSelectedRows.has(i+1));
}

function setAllRowChecks(checked) {
  getCurrentFilteredBodyIndexSet().forEach(i=>{ if(checked) manualSelectedRows.add(i); else manualSelectedRows.delete(i); });
  renderExcelPreview(); renderParsedExcelPreview();
}

function updateSelectedRowsCounter() {
  const hasHeader = els.excelHasHeader.value==="yes";
  const startRow  = Math.max(0,Number(els.excelStartRow.value)-1)||0;
  const bodyStart = hasHeader ? startRow+1 : startRow;
  const total     = Math.max(0,excelRows.slice(bodyStart).length);
  const visible   = getCurrentFilteredBodyIndexSet();
  const selected  = els.excelRowMode.value==="all" ? visible.size
    : Array.from(visible).filter(i=>manualSelectedRows.has(i)).length;
  els.selectedRowsCounter.textContent = `נבחרו ${selected} מתוך ${total} שורות`;
}

function renderExcelPreview() {
  if (!excelRows.length) { els.excelRawPreview.style.display="none"; return; }
  const hasHeader = els.excelHasHeader.value==="yes";
  const startRow  = Math.max(0,Number(els.excelStartRow.value)-1)||0;
  const headerRow = hasHeader ? excelRows[startRow] : excelRows[startRow].map((_,i)=>`טור ${i+1}`);
  const headers   = headerRow.map((h,i)=>h||`טור ${i+1}`);
  const bodyStart = hasHeader ? startRow+1 : startRow;
  const bodyRows  = excelRows.slice(bodyStart);
  const q         = (els.excelImportSearch.value||"").trim().toLowerCase();
  const indexed   = bodyRows.map((row,i)=>({row,index1:i+1}));
  const filtered  = q ? indexed.filter(({row})=>row.some(c=>String(c==null?"":c).toLowerCase().includes(q))) : indexed;
  const showChk   = els.excelRowMode.value==="selected";

  const allVisSel = filtered.length>0 && filtered.every(({index1})=>manualSelectedRows.has(index1));
  const hdrChk    = showChk ? `<th><input id="row-check-all" type="checkbox" ${allVisSel?"checked":""}/></th>` : "";

  const rowsHtml = filtered.slice(0,100).map(({row,index1})=>{
    const chk   = showChk ? `<td><input class="row-check" type="checkbox" data-row="${index1}" ${manualSelectedRows.has(index1)?"checked":""}/></td>` : "";
    const tds   = row.map(c=>`<td>${escapeHtml(c==null?"":String(c))}</td>`).join("");
    return `<tr>${chk}<td style="text-align:center;color:var(--muted)">${startRow+1+index1}</td>${tds}</tr>`;
  }).join("");

  els.excelRawPreview.innerHTML = `
    <h4>תצוגה גולמית${q?" (מסונן)":""} — עד 100 שורות</h4>
    <div style="overflow-x:auto;"><table>
      <thead><tr>${hdrChk}<th>#</th>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table></div>`;
  els.excelRawPreview.style.display="block";

  if (showChk) {
    els.excelRawPreview.querySelectorAll(".row-check").forEach(chk=>{
      chk.addEventListener("change",()=>{
        const r = Number(chk.dataset.row);
        if (chk.checked) manualSelectedRows.add(r); else manualSelectedRows.delete(r);
        renderExcelPreview(); renderParsedExcelPreview();
      });
    });
    const master = els.excelRawPreview.querySelector("#row-check-all");
    if (master) {
      master.addEventListener("change",()=>{
        filtered.forEach(({index1})=>{ if(master.checked) manualSelectedRows.add(index1); else manualSelectedRows.delete(index1); });
        renderExcelPreview(); renderParsedExcelPreview();
      });
    }
  }
}

function parseImportedEntries() {
  const rows  = collectRowsForImport();
  const type  = els.excelType.value;
  const fixed = els.excelFixedDate.value;
  const mode  = els.excelAmountMode.value;
  const idx   = {
    description: Number(els.mapDescription.value),
    amount     : Number(els.mapAmount.value),
    date       : els.mapDate.value===""   ? null : Number(els.mapDate.value),
    notes      : els.mapNotes.value===""  ? null : Number(els.mapNotes.value),
    recipient  : els.mapRecipient.value==="" ? null : Number(els.mapRecipient.value)
  };
  if (!Number.isFinite(idx.description)||!Number.isFinite(idx.amount))
    throw new Error("יש לבחור טור תיאור וטור סכום");

  const imported = [];
  for (const row of rows) {
    const amount = getAmountByMode(row[idx.amount], type, mode);
    const description = String(row[idx.description]||"").trim();
    if (!description) continue;
    if (type==="donation"&&amount<=0) continue;
    if (type==="income"  &&amount===0) continue;
    const resolvedDate = fixed || toIsoDate(idx.date==null?"":row[idx.date]) || todayIso();
    imported.push({
      id: `${Date.now()}-${Math.random()}`, type, date:resolvedDate, description, amount,
      recipient  : type==="donation" ? String(idx.recipient==null?"":row[idx.recipient]||"").trim() : "",
      category   : "",
      notes      : String(idx.notes==null?"":row[idx.notes]||"").trim(),
      hebrewDate : toHebrewDate(resolvedDate)
    });
  }
  return imported;
}

function renderParsedExcelPreview() {
  if (!excelRows.length) { els.excelParsedPreview.innerHTML=""; return; }
  try {
    const imported = parseImportedEntries();
    if (!imported.length) {
      els.excelParsedPreview.innerHTML="<p style='color:var(--red);padding:.8rem'>לא נמצאו שורות מתאימות — בדוק את הבחירה והמיפוי</p>";
      return;
    }
    setImportStep(4);
    const rowsHtml = imported.slice(0,50).map(e=>`<tr>
      <td>${e.type==="donation"?"🤲 תרומה":"💰 הכנסה"}</td>
      <td>${escapeHtml(e.date)}</td>
      <td>${escapeHtml(e.hebrewDate)}</td>
      <td>${escapeHtml(e.description)}</td>
      <td>${formatCurrency(e.amount)}</td>
      <td>${escapeHtml(e.recipient||"-")}</td>
      <td>${escapeHtml(e.notes||"-")}</td>
    </tr>`).join("");
    els.excelParsedPreview.innerHTML = `
      <h4>תצוגה מקדימה — ${escapeHtml(imported.length)} שורות לייבוא${imported.length>50?" (מוצגות 50 ראשונות)":""}</h4>
      <div style="overflow-x:auto;"><table>
        <thead><tr><th>סוג</th><th>תאריך</th><th>תאריך עברי</th><th>תיאור</th><th>סכום</th><th>מקבל</th><th>הערות</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table></div>`;
  } catch (err) {
    els.excelParsedPreview.innerHTML = `<p style='color:var(--red);padding:.8rem'>שגיאה: ${escapeHtml(err.message)}</p>`;
  }
}

function onImportExcel() {
  try {
    const imported = parseImportedEntries();
    if (!imported.length) { showToast("לא נמצאו שורות לייבוא","error"); return; }
    pushHistory();
    state.entries.push(...imported);
    saveState(); rerender();
    showToast(`✅ יובאו ${imported.length} שורות`,"success");
  } catch (err) {
    showToast(`שגיאה: ${err.message||"לא ידועה"}`,"error");
  }
}

function onQuickImport() {
  if (!excelRows.length) { showToast("בחר קובץ Excel קודם","error"); return; }
  const name = (profileSettings.autoProfileMode==="on" ? findProfileByFileName(excelFileName) : "") || profileSettings.defaultProfile;
  if (!name||!importProfiles[name]) { showToast("אין תבנית מזוהה לייבוא מהיר","error"); return; }
  applyMappingModel(importProfiles[name]);
  onImportExcel();
}

// ══════════════════════════════════════════════════════════
//  DRAG & DROP UPLOAD ZONE
// ══════════════════════════════════════════════════════════
function setupDragDrop() {
  const zone = els.uploadZone;
  if (!zone) return;
  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave",()=> zone.classList.remove("drag-over"));
  zone.addEventListener("drop", async e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    try { await onExcelFileChosen(file); }
    catch(err) { showToast(`שגיאת קובץ: ${err.message}`,"error"); }
  });
}

// ══════════════════════════════════════════════════════════
//  RERENDER
// ══════════════════════════════════════════════════════════
function rerender() {
  renderSummary();
  renderRecent();
  renderTable();
  renderFilterYearOptions();
  renderReportYearOptions();
  updateUndoRedo();
  if (activeSection==="reports") {
    renderReportChart();
    renderCategoryChart();
    renderStats();
    renderYearlySummary();
  }
}

// ══════════════════════════════════════════════════════════
//  EVENT BINDING
// ══════════════════════════════════════════════════════════
function bindEvents() {
  // Navigation
  els.navItems.forEach(btn => btn.addEventListener("click",()=>switchSection(btn.dataset.section)));

  if (els.viewAllBtn) {
    els.viewAllBtn.addEventListener("click",()=>switchSection("transactions"));
  }

  // Theme
  els.themeToggle.addEventListener("click",()=>{
    applyTheme(document.documentElement.dataset.theme!=="dark");
  });

  // Undo / Redo
  els.undoBtn.addEventListener("click",undo);
  els.redoBtn.addEventListener("click",redo);

  // Keyboard shortcuts
  document.addEventListener("keydown",e=>{
    if (e.ctrlKey||e.metaKey) {
      if (e.key==="z"&&!e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key==="y"||(e.key==="z"&&e.shiftKey)) { e.preventDefault(); redo(); }
      if (e.key==="s") { e.preventDefault(); if(activeSection==="dashboard") els.form.requestSubmit(); }
    }
  });

  // Export / Import
  els.exportBtn.addEventListener("click",exportBackup);
  els.importInput.addEventListener("change",async e=>{
    const file=e.target.files&&e.target.files[0];
    if(!file) return;
    try { await importBackup(file); }
    catch(err) { showToast(`ייבוא נכשל: ${err.message}`,"error"); }
    finally { e.target.value=""; }
  });
  els.exportCsvBtn.addEventListener("click",exportCsv);
  els.exportXlsxBtn.addEventListener("click",exportXlsx);

  // Form
  els.form.addEventListener("submit",onSubmit);
  els.typeEl.addEventListener("change",toggleRecipient);
  els.dateEl.addEventListener("change",updateHebrewDatePreview);
  els.dateEl.addEventListener("input", updateHebrewDatePreview);
  els.cancelEditBtn.addEventListener("click",resetForm);

  // Clear data
  els.clearBtn.addEventListener("click",()=>{
    showModal("מחיקת כל הנתונים","כל הרשומות, התבניות וההגדרות המקומיות יימחקו. יירד קודם גיבוי מלא לשחזור. להמשיך?",()=>{
      exportBackupBeforeClear();
      clearAllAppData();
      showToast("כל הנתונים המקומיים נמחקו ונשמר גיבוי מלא לשחזור","info",5000);
    });
  });

  // Table row actions
  els.entriesBody.addEventListener("click",onRowAction);

  // Tab buttons
  els.tabBtns.forEach(btn=>btn.addEventListener("click",()=>{
    activeTab=btn.dataset.tab||"all";
    els.tabBtns.forEach(b=>b.classList.toggle("active",b===btn));
    renderTable();
  }));

  // Filters
  [els.search,els.filterYear,els.fromDate,els.toDate,els.filterCategory].forEach(el=>{
    if (!el) return;
    el.addEventListener("input",renderTable);
    el.addEventListener("change",renderTable);
  });

  // Column sort
  els.tableHeaders.forEach(th=>th.addEventListener("click",()=>{
    const field=th.dataset.sort;
    if (sortField===field) sortDir=sortDir==="asc"?"desc":"asc";
    else { sortField=field; sortDir="asc"; }
    renderTable();
  }));

  // Print
  if (els.printBtn) els.printBtn.addEventListener("click",()=>window.print());

  // Reports
  els.reportYear.addEventListener("change",renderReportChart);
  els.reportMode.addEventListener("change",renderReportChart);

  // Modal
  els.modalOk.addEventListener("click",()=>{ try { if(modalCb) modalCb(); } finally { closeModal(); } });
  els.modalCancel.addEventListener("click",closeModal);
  els.modalOverlay.addEventListener("click",e=>{ if(e.target===els.modalOverlay) closeModal(); });

  // Excel file
  els.excelInput.addEventListener("change",async e=>{
    const file=e.target.files&&e.target.files[0];
    if (!file) return;
    try { await onExcelFileChosen(file); }
    catch(err) { showToast(`שגיאת קובץ: ${err.message}`,"error"); }
    finally { e.target.value=""; }
  });

  els.excelSheet.addEventListener("change",()=>{
    try { loadSelectedSheetRows(); renderParsedExcelPreview(); }
    catch { showToast("טעינת גיליון נכשלה","error"); }
  });

  els.excelHasHeader.addEventListener("change",()=>{
    if (!excelRows.length) return;
    updateMappingOptions(); renderExcelPreview(); renderParsedExcelPreview(); updateSelectedRowsCounter();
  });

  els.excelStartRow.addEventListener("change",()=>{
    if (!excelRows.length) return;
    updateMappingOptions(); renderExcelPreview(); renderParsedExcelPreview(); updateSelectedRowsCounter();
  });

  [els.excelType,els.excelAmountMode,els.excelFixedDate].forEach(el=>{
    if(el) el.addEventListener("change",()=>renderParsedExcelPreview());
  });

  els.excelImportSearch.addEventListener("input",()=>{
    renderExcelPreview(); renderParsedExcelPreview(); updateSelectedRowsCounter();
  });

  [els.mapDescription,els.mapAmount,els.mapDate,els.mapNotes,els.mapRecipient].forEach(sel=>{
    sel.addEventListener("change",()=>renderParsedExcelPreview());
  });

  els.excelRowMode.addEventListener("change",()=>{
    renderExcelPreview(); renderParsedExcelPreview(); updateSelectedRowsCounter();
  });

  els.selectAllRowsBtn.addEventListener("click",()=>{
    if(els.excelRowMode.value!=="selected"){ els.excelRowMode.value="selected"; renderExcelPreview(); }
    setAllRowChecks(true); updateSelectedRowsCounter();
  });
  els.clearAllRowsBtn.addEventListener("click",()=>{
    if(els.excelRowMode.value!=="selected"){ els.excelRowMode.value="selected"; renderExcelPreview(); }
    setAllRowChecks(false); updateSelectedRowsCounter();
  });

  els.autoMapBtn.addEventListener("click",autoMapColumns);

  // Profiles
  els.saveProfileBtn.addEventListener("click",saveCurrentProfile);
  els.loadProfileBtn.addEventListener("click",loadSelectedProfile);
  els.deleteProfileBtn.addEventListener("click",deleteSelectedProfile);
  els.setDefaultProfileBtn.addEventListener("click",setDefaultProfile);
  els.clearDefaultProfileBtn.addEventListener("click",clearDefaultProfile);
  els.autoProfileMode.addEventListener("change",()=>{
    profileSettings.autoProfileMode=els.autoProfileMode.value==="off"?"off":"on";
    saveProfileSettings();
  });
  els.exportProfilesBtn.addEventListener("click",exportProfilesJson);
  els.importProfilesInput.addEventListener("change",async e=>{
    const file=e.target.files&&e.target.files[0];
    if(!file) return;
    try { await importProfilesJson(file); }
    catch(err) { showToast(`ייבוא תבניות נכשל: ${err.message}`,"error"); }
    finally { e.target.value=""; }
  });

  els.importExcelBtn.addEventListener("click",onImportExcel);
  els.quickImportBtn.addEventListener("click",onQuickImport);

  // Auto-backup
  if (els.autoBackupToggle) {
    els.autoBackupToggle.addEventListener("change", () => {
      autoBackupEnabled = els.autoBackupToggle.checked;
      saveAutoBackupSettings();
      applyAutoBackupUi();
      if (autoBackupEnabled) startAutoBackupTimer();
      else stopAutoBackupTimer();
    });
  }
  if (els.autoBackupIntervalSel) {
    els.autoBackupIntervalSel.addEventListener("change", () => {
      autoBackupIntervalMinutes = Number(els.autoBackupIntervalSel.value) || 10;
      saveAutoBackupSettings();
      if (autoBackupEnabled) startAutoBackupTimer();
    });
  }

  setupDragDrop();
}

// ══════════════════════════════════════════════════════════
//  AUTO-BACKUP
// ══════════════════════════════════════════════════════════
function loadAutoBackupSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTO_BACKUP_KEY) || "{}");
    autoBackupEnabled         = !!saved.enabled;
    autoBackupIntervalMinutes = Number(saved.intervalMinutes) || 10;
  } catch {
    autoBackupEnabled         = false;
    autoBackupIntervalMinutes = 10;
  }
}

function saveAutoBackupSettings() {
  localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify({
    enabled: autoBackupEnabled,
    intervalMinutes: autoBackupIntervalMinutes
  }));
}

function applyAutoBackupUi() {
  if (els.autoBackupToggle)      els.autoBackupToggle.checked = autoBackupEnabled;
  if (els.autoBackupIntervalSel) {
    els.autoBackupIntervalSel.value    = String(autoBackupIntervalMinutes);
    els.autoBackupIntervalSel.disabled = !autoBackupEnabled;
  }
}

async function runAutoBackup() {
  if (autoBackupInFlight)    return;
  if (!state.entries.length) return;
  autoBackupInFlight = true;
  try {
    const data = JSON.stringify(state, null, 2);
    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.isElectron) {
      const result = await window.electronAPI.saveAutoBackup(data);
      if (result && result.ok) showToast("💾 גיבוי אוטומטי נשמר", "success");
      else                     showToast("⚠️ גיבוי אוטומטי נכשל",  "error");
    } else {
      // Browser fallback: trigger download
      const stamp = new Date().toISOString().replace("T","_").replace(/[:.]/g,"-").slice(0,19);
      const blob  = new Blob([data], { type: "application/json" });
      const url   = URL.createObjectURL(blob);
      const a     = Object.assign(document.createElement("a"), { href: url, download: `auto_backup_${stamp}.json` });
      a.click(); URL.revokeObjectURL(url);
      showToast("💾 גיבוי אוטומטי הורד", "success");
    }
  } finally {
    autoBackupInFlight = false;
  }
}

function startAutoBackupTimer() {
  stopAutoBackupTimer();
  if (!autoBackupEnabled) return;
  runAutoBackup(); // immediate backup when first enabled
  autoBackupTimer = setInterval(runAutoBackup, autoBackupIntervalMinutes * 60 * 1000);
}

function stopAutoBackupTimer() {
  if (autoBackupTimer !== null) { clearInterval(autoBackupTimer); autoBackupTimer = null; }
}

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════
function init() {
  loadTheme();
  loadState();
  // Re-compute hebrewDate for all entries
  state.entries = state.entries.map(e=>({...e, hebrewDate:toHebrewDate(e.date)||e.hebrewDate||""}));
  loadProfiles();
  loadProfileSettings();
  bindEvents();
  renderProfileOptions();
  resetForm();
  setImportStep(1);
  renderFilterYearOptions();
  renderReportYearOptions();
  rerender();
  updateUndoRedo();
  loadAutoBackupSettings();
  applyAutoBackupUi();
  startAutoBackupTimer();
}

init();
