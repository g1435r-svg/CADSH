const STORAGE_KEY = "maaser-chomesh-data-v2";

let state = {
  entries: [],
  version: "5.0",
  date: new Date().toISOString()
};

const els = {
  form: document.getElementById("entry-form"),
  formTitle: document.getElementById("form-title"),
  editingId: document.getElementById("editing-id"),
  type: document.getElementById("type"),
  date: document.getElementById("date"),
  description: document.getElementById("description"),
  amount: document.getElementById("amount"),
  notes: document.getElementById("notes"),
  cancelEditBtn: document.getElementById("cancel-edit-btn"),
  saveBtn: document.getElementById("save-btn"),
  search: document.getElementById("search"),
  entriesBody: document.getElementById("entries-body"),
  totalIn: document.getElementById("total-in"),
  totalOut: document.getElementById("total-out"),
  balance: document.getElementById("balance"),
  entriesCount: document.getElementById("entries-count"),
  exportBtn: document.getElementById("export-btn"),
  importInput: document.getElementById("import-input"),
  clearBtn: document.getElementById("clear-btn")
};

function formatCurrency(value) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(Number(value) || 0);
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeDate(raw) {
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount)) return null;

  const rawType = String(raw.type || "").toLowerCase();
  const type = rawType === "income" ? "income" : rawType === "expense" || rawType === "donation" ? "expense" : "income";

  return {
    id: raw.id ? String(raw.id) : uid(),
    type,
    date: normalizeDate(raw.date),
    description: String(raw.description || "ללא תיאור").trim() || "ללא תיאור",
    amount: Math.abs(amount),
    notes: String(raw.notes || "").trim(),
    recipient: raw.recipient ? String(raw.recipient) : ""
  };
}

function normalizeState(raw) {
  const fallback = {
    entries: [],
    version: "5.0",
    date: new Date().toISOString()
  };

  if (!raw || typeof raw !== "object") return fallback;
  const sourceEntries = Array.isArray(raw.entries) ? raw.entries : Array.isArray(raw) ? raw : [];
  const entries = sourceEntries.map(normalizeEntry).filter(Boolean);

  return {
    entries,
    version: "5.0",
    date: new Date().toISOString()
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    state = normalizeState(parsed);
  } catch {
    state = normalizeState(null);
  }
}

function saveState() {
  state.date = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getFilteredEntries() {
  const q = (els.search.value || "").trim().toLowerCase();
  const sorted = [...state.entries].sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!q) return sorted;

  return sorted.filter((entry) => {
    return [entry.description, entry.notes, entry.date].join(" ").toLowerCase().includes(q);
  });
}

function renderSummary() {
  const totalIn = state.entries.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
  const totalOut = state.entries.filter((e) => e.type === "expense").reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIn - totalOut;

  els.totalIn.textContent = formatCurrency(totalIn);
  els.totalOut.textContent = formatCurrency(totalOut);
  els.balance.textContent = formatCurrency(balance);
  els.entriesCount.textContent = String(state.entries.length);

  els.balance.classList.remove("positive", "negative");
  if (balance > 0) els.balance.classList.add("positive");
  if (balance < 0) els.balance.classList.add("negative");
}

function renderTable() {
  const rows = getFilteredEntries();
  els.entriesBody.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="empty" colspan="6">אין נתונים להצגה</td>';
    els.entriesBody.appendChild(tr);
    return;
  }

  for (const entry of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${entry.type === "income" ? "יבא" : "יצא"}</td>
      <td>${entry.date}</td>
      <td>${escapeHtml(entry.description)}</td>
      <td>${formatCurrency(entry.amount)}</td>
      <td>${escapeHtml(entry.notes)}</td>
      <td>
        <div class="actions">
          <button class="btn" type="button" data-action="edit" data-id="${entry.id}">ערוך</button>
          <button class="btn danger" type="button" data-action="delete" data-id="${entry.id}">מחק</button>
        </div>
      </td>
    `;
    els.entriesBody.appendChild(tr);
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderAll() {
  renderSummary();
  renderTable();
}

function resetForm() {
  els.form.reset();
  els.editingId.value = "";
  els.formTitle.textContent = "רישום חדש";
  els.saveBtn.textContent = "שמור";
  els.type.value = "income";
  els.date.value = new Date().toISOString().slice(0, 10);
}

function addEntry(payload) {
  const normalized = normalizeEntry(payload);
  if (!normalized) return;
  state.entries.push(normalized);
  saveState();
  renderAll();
}

function updateEntry(id, payload) {
  const i = state.entries.findIndex((entry) => entry.id === id);
  if (i === -1) return;

  const normalized = normalizeEntry({ ...state.entries[i], ...payload, id });
  if (!normalized) return;

  state.entries[i] = normalized;
  saveState();
  renderAll();
}

function deleteEntry(id) {
  const next = state.entries.filter((entry) => entry.id !== id);
  if (next.length === state.entries.length) return;
  state.entries = next;
  saveState();
  renderAll();
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `yavo-yatza-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importBackup(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  state = normalizeState(parsed);
  saveState();
  renderAll();
}

function onSubmit(event) {
  event.preventDefault();

  const payload = {
    type: els.type.value,
    date: els.date.value,
    description: els.description.value,
    amount: Number(els.amount.value),
    notes: els.notes.value
  };

  if (!payload.description.trim()) {
    alert("יש למלא תיאור.");
    return;
  }

  if (!(payload.amount > 0)) {
    alert("יש להזין סכום חיובי גדול מ-0.");
    return;
  }

  const editingId = els.editingId.value;
  if (editingId) {
    updateEntry(editingId, payload);
  } else {
    addEntry(payload);
  }

  resetForm();
}

function onTableClick(event) {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.getAttribute("data-action");
  const id = btn.getAttribute("data-id") || "";
  const entry = state.entries.find((item) => item.id === id);

  if (action === "delete") {
    if (!confirm("למחוק את הרשומה?")) return;
    deleteEntry(id);
    if (els.editingId.value === id) resetForm();
    return;
  }

  if (!entry) return;
  if (action === "edit") {
    els.editingId.value = entry.id;
    els.type.value = entry.type;
    els.date.value = entry.date;
    els.description.value = entry.description;
    els.amount.value = String(entry.amount);
    els.notes.value = entry.notes;
    els.formTitle.textContent = "עריכת רשומה";
    els.saveBtn.textContent = "עדכן";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function wireEvents() {
  els.form.addEventListener("submit", onSubmit);
  els.cancelEditBtn.addEventListener("click", resetForm);
  els.search.addEventListener("input", renderTable);
  els.entriesBody.addEventListener("click", onTableClick);
  els.exportBtn.addEventListener("click", exportBackup);
  els.importInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importBackup(file);
      resetForm();
    } catch {
      alert("קובץ הגיבוי לא תקין.");
    } finally {
      els.importInput.value = "";
    }
  });

  els.clearBtn.addEventListener("click", () => {
    if (!confirm("למחוק את כל הנתונים?")) return;
    state.entries = [];
    saveState();
    renderAll();
    resetForm();
  });
}

function init() {
  loadState();
  wireEvents();
  resetForm();
  renderAll();
}

init();
