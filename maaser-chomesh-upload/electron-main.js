const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

function getAutoBackupDir() {
  const dir = path.join(app.getPath("userData"), "auto-backups");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

ipcMain.handle("save-auto-backup", async (_event, data) => {
  try {
    const dir = getAutoBackupDir();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filePath = path.join(dir, `auto_backup_${stamp}.json`);
    fs.writeFileSync(filePath, data, "utf8");
    // Keep only the last 30 auto-backup files
    const files = fs.readdirSync(dir)
      .filter((f) => f.startsWith("auto_backup_") && f.endsWith(".json"))
      .sort();
    if (files.length > 30) {
      for (const old of files.slice(0, files.length - 30)) {
        try { fs.unlinkSync(path.join(dir, old)); } catch (_) {}
      }
    }
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle("get-auto-backup-folder", async () => {
  return getAutoBackupDir();
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 980,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));
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
