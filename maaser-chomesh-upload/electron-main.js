const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs   = require("fs");

// ── Auto-backup IPC (async fs to avoid blocking the main process) ──────────
async function getAutoBackupDir() {
  const dir = path.join(app.getPath("userData"), "auto-backups");
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

ipcMain.handle("save-auto-backup", async (_event, data) => {
  try {
    const dir      = await getAutoBackupDir();
    const stamp    = new Date().toISOString().replace("T", "_").replace(/[:.]/g, "-").slice(0, 19);
    const filePath = path.join(dir, `auto_backup_${stamp}.json`);
    await fs.promises.writeFile(filePath, data, "utf8");
    // Keep only the last 30 auto-backup files
    const files = (await fs.promises.readdir(dir))
      .filter(f => f.startsWith("auto_backup_") && f.endsWith(".json"))
      .sort();
    if (files.length > 30) {
      for (const old of files.slice(0, files.length - 30)) {
        try { await fs.promises.unlink(path.join(dir, old)); }
        catch (e) { console.warn(`[auto-backup] Could not delete "${old}":`, e.message); }
      }
    }
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle("get-auto-backup-folder", async () => getAutoBackupDir());

ipcMain.handle("open-auto-backup-folder", async () => {
  const dir = await getAutoBackupDir();
  shell.openPath(dir);
});

ipcMain.handle("list-auto-backups", async () => {
  try {
    const dir   = await getAutoBackupDir();
    const files = (await fs.promises.readdir(dir))
      .filter(f => f.startsWith("auto_backup_") && f.endsWith(".json"))
      .sort()
      .reverse(); // newest first
    return { ok: true, files };
  } catch (err) {
    return { ok: false, files: [], error: String(err) };
  }
});

ipcMain.handle("read-auto-backup", async (_event, filename) => {
  try {
    // Validate filename to prevent path traversal
    if (!/^auto_backup_[\w-]+\.json$/.test(filename)) throw new Error("שם קובץ לא תקין");
    const dir      = await getAutoBackupDir();
    const filePath = path.join(dir, filename);
    const data     = await fs.promises.readFile(filePath, "utf8");
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// ── Window ─────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    autoHideMenuBar: true,
    title: "ניהול מעשרות וחומש",
    backgroundColor: "#f0f2f8",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));

  // Open external links in browser (http/https only)
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        shell.openExternal(url);
      }
    } catch {}
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
