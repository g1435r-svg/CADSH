const STORAGE_KEY = "maaser-chomesh-data-v3";
const MAPPING_KEY = "maaser-chomesh-excel-mappings-v1";
const MAX_HISTORY = 200;

let state = {
  entries: [],
  version: "6.0",
  updatedAt: new Date().toISOString()
};

const historyState = {
  past: [],
  future: []
};

const importState = {
  rows: [],
  columns: []
};

const els = {
  totalIncome: document.getElementById("total-income"),
  totalDonation: document.getElementById("total-donation"),
  maaserTarget: document.getElementById("maaser-target"),
  chomeshTarget: document.getElementById("chomesh-target"),
  maaserLeft: document.getElementById("maaser-left"),
  chomeshLeft: document.getElementById("chomesh-left"),
  undoBtn: document.getElementById("undo-btn"),
  redoBtn: document.getElementById("redo-btn"),
  exportBtn: document.getElementById("export-btn"),
  importJsonInput: document.getElementById("import-json-input"),
  resetBtn: document.getElementById("reset-btn"),
  tabButtons: Array.from(document.querySelectorAll(".tab-btn")),
  tabPanels: Array.from(document.querySelectorAll(".tab-panel")),

  incomeForm: document.getElementById("income-form"),
  incomeEditingId: document.getElementById("income-editing-id"),
  incomeDate: document.getElementById("income-date"),
  incomeDescription: document.getElementById("income-description"),
  incomeAmount: document.getElementById("income-amount"),
  incomeNotes: document.getElementById("income-notes"),
  incomeSaveBtn: document.getElementById("income-save-btn"),
  incomeCancelBtn: document.getElementById("income-cancel-btn"),
  incomeRows: document.getElementById("income-rows"),

  donationForm: document.getElementById("donation-form"),
  donationEditingId: document.getElementById("donation-editing-id"),
  donationDate: document.getElementById("donation-date"),
  donationDescription: document.getElementById("donation-description"),
  donationAmount: document.getElementById("donation-amount"),
  donationNotes: document.getElementById("donation-notes"),
  donationSaveBtn: document.getElementById("donation-save-btn"),
  donationCancelBtn: document.getElementById("donation-cancel-btn"),
  donationRows: document.getElementById("donation-rows"),

  searchText: document.getElementById("search-text"),
  searchType: document.getElementById("search-type"),
  searchYear: document.getElementById("search-year"),
  searchMonth: document.getElementById("search-month"),
  searchCount: document.getElementById("search-count"),
  searchRows: document.getElementById("search-rows"),

  importExcelInput: document.getElementById("import-excel-input"),
  importTarget: document.getElementById("import-target"),
  importFixedDate: document.getElementById("import-fixed-date"),
  importStartRow: document.getElementById("import-start-row"),
  importEndRow: document.getElementById("import-end-row"),
  mapDescription: document.getElementById("map-description"),
  mapDate: document.getElementById("map-date"),
  mapAmount: document.getElementById("map-amount"),
  mapNotes: document.getElementById("map-notes"),
  applyRangeBtn: document.getElementById("apply-range-btn"),
  selectAllRowsBtn: document.getElementById("select-all-rows-btn"),
  clearAllRowsBtn: document.getElementById("clear-all-rows-btn"),
  importExcelBtn: document.getElementById("import-excel-btn"),
  importStatus: document.getElementById("import-status"),
  importPreviewRows: document.getElementById("import-preview-rows")
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(Number(value) || 0);
}

function parseAmount(raw) {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? Math.abs(raw) : NaN;
  }

  const clean = String(raw || "")
    .replace(/[₪,\s]/g, "")
    .replace(/[־–—]/g, "-")
    .trim();

  if (!clean) return NaN;
  const value = Number(clean);
  return Number.isFinite(value) ? Math.abs(value) : NaN;
}

function excelSerialToDate(serial) {
  if (!Number.isFinite(serial)) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + serial * 86400000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeDate(raw) {
  if (!raw) return new Date().toISOString().slice(0, 10);

  if (typeof raw === "number") {
    return excelSerialToDate(raw) || new Date().toISOString().slice(0, 10);
  }

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return new Date().toISOString().slice(0, 10);
    return raw.toISOString().slice(0, 10);
  }

  const asText = String(raw).trim();
  if (!asText) return new Date().toISOString().slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(asText)) return asText;

  const parsed = new Date(asText);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  const ddmmyyyy = asText.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (ddmmyyyy) {
    const d = Number(ddmmyyyy[1]);
    const m = Number(ddmmyyyy[2]);
    const y = Number(ddmmyyyy[3]);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;

  const type = String(raw.type || "").toLowerCase() === "donation" ? "donation" : "income";
  const amount = parseAmount(raw.amount);
  if (!(amount > 0)) return null;

  return {
    id: raw.id ? String(raw.id) : uid(),
    type,
    date: normalizeDate(raw.date),
    description: String(raw.description || "ללא תיאור").trim() || "ללא תיאור",
    amount,
    notes: String(raw.notes || "").trim()
  };
}

function normalizeEntries(items) {
  const source = Array.isArray(items) ? items : [];
  return source.map(normalizeEntry).filter(Boolean);
}

function cloneEntries(items = state.entries) {
  return items.map((entry) => ({ ...entry }));
}

function serializeAndSave() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : Array.isArray(parsed) ? parsed : [];
    state.entries = normalizeEntries(entries);
    state.updatedAt = new Date().toISOString();
  } catch {
    state.entries = [];
  }
}

function pushHistory(previousEntries) {
  historyState.past.push(cloneEntries(previousEntries));
  if (historyState.past.length > MAX_HISTORY) historyState.past.shift();
  historyState.future = [];
}

function applyEntries(nextEntries, { trackHistory = true } = {}) {
  const prev = cloneEntries();
  state.entries = normalizeEntries(nextEntries);

  if (trackHistory) pushHistory(prev);

  serializeAndSave();
  renderAll();
}

function undo() {
  const previous = historyState.past.pop();
  if (!previous) return;
  historyState.future.push(cloneEntries());
  state.entries = normalizeEntries(previous);
  serializeAndSave();
  resetForms();
  renderAll();
}

function redo() {
  const next = historyState.future.pop();
  if (!next) return;
  historyState.past.push(cloneEntries());
  state.entries = normalizeEntries(next);
  serializeAndSave();
  resetForms();
  renderAll();
}

function sortedEntries(entries) {
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function renderSummary() {
  const totalIncome = state.entries.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount, 0);
  const totalDonation = state.entries.filter((entry) => entry.type === "donation").reduce((sum, entry) => sum + entry.amount, 0);
  const maaserTarget = totalIncome * 0.1;
  const chomeshTarget = totalIncome * 0.2;
  const maaserLeft = Math.max(maaserTarget - totalDonation, 0);
  const chomeshLeft = Math.max(chomeshTarget - totalDonation, 0);

  els.totalIncome.textContent = formatCurrency(totalIncome);
  els.totalDonation.textContent = formatCurrency(totalDonation);
  els.maaserTarget.textContent = formatCurrency(maaserTarget);
  els.chomeshTarget.textContent = formatCurrency(chomeshTarget);
  els.maaserLeft.textContent = formatCurrency(maaserLeft);
  els.chomeshLeft.textContent = formatCurrency(chomeshLeft);

  els.undoBtn.disabled = historyState.past.length === 0;
  els.redoBtn.disabled = historyState.future.length === 0;
}

function renderEntryRows(type, container) {
  const rows = sortedEntries(state.entries.filter((entry) => entry.type === type));
  container.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="empty" colspan="5">אין נתונים להצגה</td>';
    container.appendChild(tr);
    return;
  }

  for (const entry of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(entry.date)}</td>
      <td>${escapeHtml(entry.description)}</td>
      <td>${formatCurrency(entry.amount)}</td>
      <td>${escapeHtml(entry.notes)}</td>
      <td>
        <div class="actions">
          <button class="btn" type="button" data-action="edit" data-id="${entry.id}" data-type="${entry.type}">ערוך</button>
          <button class="btn danger" type="button" data-action="delete" data-id="${entry.id}" data-type="${entry.type}">מחק</button>
        </div>
      </td>
    `;
    container.appendChild(tr);
  }
}

function ensureSearchYearOptions() {
  const years = new Set(state.entries.map((entry) => entry.date.slice(0, 4)));
  const selected = els.searchYear.value;

  els.searchYear.innerHTML = '<option value="all">כל השנים</option>';
  Array.from(years)
    .sort((a, b) => (a > b ? -1 : 1))
    .forEach((year) => {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      els.searchYear.appendChild(option);
    });

  if (selected && Array.from(years).includes(selected)) {
    els.searchYear.value = selected;
  }
}

function getSearchResults() {
  const q = (els.searchText.value || "").trim().toLowerCase();
  const typeFilter = els.searchType.value;
  const yearFilter = els.searchYear.value;
  const monthFilter = els.searchMonth.value;

  return sortedEntries(state.entries).filter((entry) => {
    if (typeFilter !== "all" && entry.type !== typeFilter) return false;
    if (yearFilter !== "all" && !entry.date.startsWith(`${yearFilter}-`)) return false;
    if (monthFilter !== "all" && entry.date.slice(5, 7) !== monthFilter) return false;
    if (!q) return true;
    return [entry.description, entry.notes, entry.date].join(" ").toLowerCase().includes(q);
  });
}

function renderSearchRows() {
  const rows = getSearchResults();
  els.searchRows.innerHTML = "";
  els.searchCount.textContent = `${rows.length} תוצאות`;

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="empty" colspan="5">לא נמצאו תוצאות</td>';
    els.searchRows.appendChild(tr);
    return;
  }

  for (const entry of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${entry.type === "income" ? "הכנסה" : "תרומה"}</td>
      <td>${escapeHtml(entry.date)}</td>
      <td>${escapeHtml(entry.description)}</td>
      <td>${formatCurrency(entry.amount)}</td>
      <td>${escapeHtml(entry.notes)}</td>
    `;
    els.searchRows.appendChild(tr);
  }
}

function renderAll() {
  renderSummary();
  renderEntryRows("income", els.incomeRows);
  renderEntryRows("donation", els.donationRows);
  ensureSearchYearOptions();
  renderSearchRows();
}

function setTodayDefaults() {
  const today = new Date().toISOString().slice(0, 10);
  if (!els.incomeDate.value) els.incomeDate.value = today;
  if (!els.donationDate.value) els.donationDate.value = today;
}

function resetIncomeForm() {
  els.incomeForm.reset();
  els.incomeEditingId.value = "";
  els.incomeSaveBtn.textContent = "שמור הכנסה";
  els.incomeDate.value = new Date().toISOString().slice(0, 10);
}

function resetDonationForm() {
  els.donationForm.reset();
  els.donationEditingId.value = "";
  els.donationSaveBtn.textContent = "שמור תרומה";
  els.donationDate.value = new Date().toISOString().slice(0, 10);
}

function resetForms() {
  resetIncomeForm();
  resetDonationForm();
}

function validateEntryInput(payload) {
  if (!payload.description.trim()) {
    alert("יש למלא תיאור.");
    return false;
  }
  if (!(payload.amount > 0)) {
    alert("יש להזין סכום חיובי גדול מ-0.");
    return false;
  }
  return true;
}

function addEntry(payload) {
  const normalized = normalizeEntry(payload);
  if (!normalized) return;
  const next = cloneEntries();
  next.push(normalized);
  applyEntries(next, { trackHistory: true });
}

function updateEntry(id, payload) {
  const next = cloneEntries();
  const index = next.findIndex((entry) => entry.id === id);
  if (index === -1) return;

  const normalized = normalizeEntry({ ...next[index], ...payload, id });
  if (!normalized) return;

  next[index] = normalized;
  applyEntries(next, { trackHistory: true });
}

function deleteEntry(id) {
  const next = cloneEntries().filter((entry) => entry.id !== id);
  if (next.length === state.entries.length) return;
  applyEntries(next, { trackHistory: true });
}

function onIncomeSubmit(event) {
  event.preventDefault();
  const payload = {
    type: "income",
    date: els.incomeDate.value,
    description: els.incomeDescription.value,
    amount: Number(els.incomeAmount.value),
    notes: els.incomeNotes.value
  };

  if (!validateEntryInput(payload)) return;

  if (els.incomeEditingId.value) {
    updateEntry(els.incomeEditingId.value, payload);
  } else {
    addEntry(payload);
  }
  resetIncomeForm();
}

function onDonationSubmit(event) {
  event.preventDefault();
  const payload = {
    type: "donation",
    date: els.donationDate.value,
    description: els.donationDescription.value,
    amount: Number(els.donationAmount.value),
    notes: els.donationNotes.value
  };

  if (!validateEntryInput(payload)) return;

  if (els.donationEditingId.value) {
    updateEntry(els.donationEditingId.value, payload);
  } else {
    addEntry(payload);
  }
  resetDonationForm();
}

function startEditing(entry) {
  if (!entry) return;

  if (entry.type === "income") {
    els.incomeEditingId.value = entry.id;
    els.incomeDate.value = entry.date;
    els.incomeDescription.value = entry.description;
    els.incomeAmount.value = String(entry.amount);
    els.incomeNotes.value = entry.notes;
    els.incomeSaveBtn.textContent = "עדכן הכנסה";
    openTab("income");
  } else {
    els.donationEditingId.value = entry.id;
    els.donationDate.value = entry.date;
    els.donationDescription.value = entry.description;
    els.donationAmount.value = String(entry.amount);
    els.donationNotes.value = entry.notes;
    els.donationSaveBtn.textContent = "עדכן תרומה";
    openTab("donation");
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function onEntryTableClick(event) {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;

  const id = btn.getAttribute("data-id") || "";
  const action = btn.getAttribute("data-action");
  const entry = state.entries.find((item) => item.id === id);

  if (action === "delete") {
    if (!confirm("למחוק את הרשומה?")) return;
    deleteEntry(id);
    if (els.incomeEditingId.value === id) resetIncomeForm();
    if (els.donationEditingId.value === id) resetDonationForm();
    return;
  }

  if (action === "edit") startEditing(entry);
}

function exportJsonBackup() {
  const payload = {
    version: state.version,
    updatedAt: new Date().toISOString(),
    entries: cloneEntries()
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `maaser-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importJsonBackup(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);

  const sourceEntries = Array.isArray(parsed?.entries)
    ? parsed.entries
    : Array.isArray(parsed)
      ? parsed
      : null;

  if (!sourceEntries) {
    throw new Error("invalid-format");
  }

  const normalized = normalizeEntries(sourceEntries);
  applyEntries(normalized, { trackHistory: true });
  resetForms();
}

function openTab(name) {
  for (const btn of els.tabButtons) {
    btn.classList.toggle("active", btn.dataset.tab === name);
  }

  for (const panel of els.tabPanels) {
    panel.classList.toggle("active", panel.dataset.panel === name);
  }
}

function loadMappings() {
  try {
    const raw = localStorage.getItem(MAPPING_KEY);
    if (!raw) return { income: {}, donation: {} };
    const parsed = JSON.parse(raw);
    return {
      income: parsed?.income && typeof parsed.income === "object" ? parsed.income : {},
      donation: parsed?.donation && typeof parsed.donation === "object" ? parsed.donation : {}
    };
  } catch {
    return { income: {}, donation: {} };
  }
}

function saveMappings(allMappings) {
  localStorage.setItem(MAPPING_KEY, JSON.stringify(allMappings));
}

function getColumnLabel(index) {
  let n = index;
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function valueToText(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    if (value.text != null) return String(value.text);
    if (value.result != null) return String(value.result);
    if (value.richText && Array.isArray(value.richText)) return value.richText.map((item) => item.text || "").join("");
    return "";
  }
  return String(value).trim();
}

function buildColumnsFromRows(rows) {
  let maxCols = 0;
  for (const row of rows) {
    if (row.cells.length > maxCols) maxCols = row.cells.length;
  }

  const firstDataRow = rows.find((row) => row.cells.some((cell) => String(cell || "").trim() !== ""));

  const columns = [];
  for (let i = 1; i <= maxCols; i += 1) {
    const headerValue = firstDataRow ? String(firstDataRow.cells[i - 1] || "").trim() : "";
    const label = getColumnLabel(i);
    columns.push({
      index: i,
      title: headerValue ? `${label} (${headerValue.slice(0, 30)})` : label
    });
  }
  return columns;
}

function renderMappingSelectOptions() {
  const selects = [els.mapDescription, els.mapDate, els.mapAmount, els.mapNotes];

  for (const select of selects) {
    select.innerHTML = "";
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "לא ממופה";
    select.appendChild(none);

    for (const column of importState.columns) {
      const option = document.createElement("option");
      option.value = String(column.index);
      option.textContent = column.title;
      select.appendChild(option);
    }
  }
}

function applySavedMappingToForm() {
  const mappings = loadMappings();
  const selectedTarget = els.importTarget.value;
  const mapping = mappings[selectedTarget] || {};

  els.mapDescription.value = mapping.description || "";
  els.mapDate.value = mapping.date || "";
  els.mapAmount.value = mapping.amount || "";
  els.mapNotes.value = mapping.notes || "";
}

function saveCurrentMapping() {
  const selectedTarget = els.importTarget.value;
  const mappings = loadMappings();
  mappings[selectedTarget] = {
    description: els.mapDescription.value || "",
    date: els.mapDate.value || "",
    amount: els.mapAmount.value || "",
    notes: els.mapNotes.value || ""
  };
  saveMappings(mappings);
}

function renderImportRows() {
  els.importPreviewRows.innerHTML = "";

  if (!importState.rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="empty" colspan="3">אין נתונים לתצוגה</td>';
    els.importPreviewRows.appendChild(tr);
    return;
  }

  for (const row of importState.rows) {
    const tr = document.createElement("tr");
    const rowText = row.cells
      .map((cell, index) => {
        if (!String(cell || "").trim()) return "";
        return `${getColumnLabel(index + 1)}: ${String(cell).slice(0, 80)}`;
      })
      .filter(Boolean)
      .join(" | ");

    tr.innerHTML = `
      <td><input type="checkbox" data-row-id="${row.id}" ${row.selected ? "checked" : ""} /></td>
      <td>${row.rowNumber}</td>
      <td>${escapeHtml(rowText || "שורה ריקה")}</td>
    `;
    els.importPreviewRows.appendChild(tr);
  }
}

function setImportStatus(message) {
  els.importStatus.textContent = message;
}

async function parseExcelFile(file) {
  if (!window.ExcelJS?.Workbook) {
    throw new Error("excel-not-available");
  }

  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("worksheet-missing");
  }

  const rows = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells = [];
    const count = Math.max(row.cellCount, row.actualCellCount, 1);
    for (let i = 1; i <= count; i += 1) {
      const value = row.getCell(i).value;
      cells.push(valueToText(value));
    }

    rows.push({
      id: uid(),
      rowNumber,
      cells,
      selected: true
    });
  });

  importState.rows = rows;
  importState.columns = buildColumnsFromRows(rows);
  renderMappingSelectOptions();
  applySavedMappingToForm();
  renderImportRows();

  els.importStartRow.value = rows.length ? "1" : "";
  els.importEndRow.value = rows.length ? String(rows[rows.length - 1].rowNumber) : "";

  setImportStatus(`נטענו ${rows.length} שורות מהקובץ.`);
}

function setRowsSelection(predicate) {
  importState.rows = importState.rows.map((row) => ({ ...row, selected: predicate(row) }));
  renderImportRows();
}

function applyRangeSelection() {
  const start = Number(els.importStartRow.value);
  const end = Number(els.importEndRow.value);

  if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end <= 0 || start > end) {
    alert("טווח שורות לא תקין.");
    return;
  }

  setRowsSelection((row) => row.rowNumber >= start && row.rowNumber <= end);
  setImportStatus(`נבחרו שורות ${start}-${end}.`);
}

function readMappedCell(row, mappingValue) {
  const index = Number(mappingValue);
  if (!Number.isInteger(index) || index <= 0) return "";
  return row.cells[index - 1] ?? "";
}

function importFromExcelSelection() {
  if (!importState.rows.length) {
    alert("יש לבחור קובץ אקסל קודם.");
    return;
  }

  const target = els.importTarget.value === "donation" ? "donation" : "income";
  const fixedDate = els.importFixedDate.value;
  const selectedRows = importState.rows.filter((row) => row.selected);

  if (!selectedRows.length) {
    alert("לא נבחרו שורות לייבוא.");
    return;
  }

  const amountMapping = els.mapAmount.value;
  if (!amountMapping) {
    alert("יש למפות עמודת סכום.");
    return;
  }

  const next = cloneEntries();
  let importedCount = 0;
  let skippedCount = 0;

  for (const row of selectedRows) {
    const rawAmount = readMappedCell(row, amountMapping);
    const amount = parseAmount(rawAmount);
    if (!(amount > 0)) {
      skippedCount += 1;
      continue;
    }

    const rawDescription = readMappedCell(row, els.mapDescription.value);
    const rawDate = fixedDate || readMappedCell(row, els.mapDate.value);
    const rawNotes = readMappedCell(row, els.mapNotes.value);

    const normalized = normalizeEntry({
      type: target,
      date: rawDate,
      description: String(rawDescription || `ייבוא אקסל שורה ${row.rowNumber}`),
      amount,
      notes: String(rawNotes || "")
    });

    if (!normalized) {
      skippedCount += 1;
      continue;
    }

    next.push(normalized);
    importedCount += 1;
  }

  if (!importedCount) {
    alert("לא נמצאו שורות תקינות לייבוא.");
    return;
  }

  saveCurrentMapping();
  applyEntries(next, { trackHistory: true });
  setImportStatus(`הייבוא הושלם: נוספו ${importedCount} רשומות, דולגו ${skippedCount} שורות.`);
}

function wireEvents() {
  for (const btn of els.tabButtons) {
    btn.addEventListener("click", () => openTab(btn.dataset.tab || "income"));
  }

  els.incomeForm.addEventListener("submit", onIncomeSubmit);
  els.incomeCancelBtn.addEventListener("click", resetIncomeForm);
  els.donationForm.addEventListener("submit", onDonationSubmit);
  els.donationCancelBtn.addEventListener("click", resetDonationForm);

  els.incomeRows.addEventListener("click", onEntryTableClick);
  els.donationRows.addEventListener("click", onEntryTableClick);

  els.searchText.addEventListener("input", renderSearchRows);
  els.searchType.addEventListener("change", renderSearchRows);
  els.searchYear.addEventListener("change", renderSearchRows);
  els.searchMonth.addEventListener("change", renderSearchRows);

  els.undoBtn.addEventListener("click", undo);
  els.redoBtn.addEventListener("click", redo);

  els.exportBtn.addEventListener("click", exportJsonBackup);

  els.importJsonInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await importJsonBackup(file);
      alert("ייבוא JSON הושלם בהצלחה.");
    } catch {
      alert("קובץ JSON לא תקין.");
    } finally {
      els.importJsonInput.value = "";
    }
  });

  els.resetBtn.addEventListener("click", () => {
    if (!confirm("לאפס את כל הנתונים במערכת?")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MAPPING_KEY);
    historyState.past = [];
    historyState.future = [];
    importState.rows = [];
    importState.columns = [];
    applyEntries([], { trackHistory: true });
    resetForms();
  });

  els.importExcelInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await parseExcelFile(file);
    } catch {
      setImportStatus("קריאת קובץ האקסל נכשלה.");
      alert("לא ניתן לקרוא את קובץ האקסל.");
    }
  });

  els.importTarget.addEventListener("change", applySavedMappingToForm);
  els.applyRangeBtn.addEventListener("click", applyRangeSelection);
  els.selectAllRowsBtn.addEventListener("click", () => {
    setRowsSelection(() => true);
    setImportStatus("כל השורות סומנו.");
  });

  els.clearAllRowsBtn.addEventListener("click", () => {
    setRowsSelection(() => false);
    setImportStatus("בחירת השורות נוקתה.");
  });

  els.importExcelBtn.addEventListener("click", importFromExcelSelection);

  els.importPreviewRows.addEventListener("change", (event) => {
    const checkbox = event.target.closest("input[type='checkbox'][data-row-id]");
    if (!checkbox) return;

    const id = checkbox.getAttribute("data-row-id") || "";
    importState.rows = importState.rows.map((row) => (row.id === id ? { ...row, selected: checkbox.checked } : row));
  });
}

function initMonthOptions() {
  const months = [
    ["01", "ינואר"],
    ["02", "פברואר"],
    ["03", "מרץ"],
    ["04", "אפריל"],
    ["05", "מאי"],
    ["06", "יוני"],
    ["07", "יולי"],
    ["08", "אוגוסט"],
    ["09", "ספטמבר"],
    ["10", "אוקטובר"],
    ["11", "נובמבר"],
    ["12", "דצמבר"]
  ];

  els.searchMonth.innerHTML = '<option value="all">כל החודשים</option>';
  for (const [value, label] of months) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    els.searchMonth.appendChild(option);
  }
}

function init() {
  loadState();
  initMonthOptions();
  wireEvents();
  setTodayDefaults();
  applySavedMappingToForm();
  renderImportRows();
  renderAll();
}

init();
