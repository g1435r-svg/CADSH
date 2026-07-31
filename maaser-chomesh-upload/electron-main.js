const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

async function getAutoBackupDir() {
  const dir = path.join(app.getPath("userData"), "auto-backups");
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

ipcMain.handle("save-auto-backup", async (_event, data) => {
  try {
    const dir = await getAutoBackupDir();
    const stamp = new Date().toISOString().replace("T", "_").replace(/[:.]/g, "-").slice(0, 19);
    const filePath = path.join(dir, `auto_backup_${stamp}.json`);
    await fs.promises.writeFile(filePath, data, "utf8");
    // Keep only the last 30 auto-backup files
    const files = (await fs.promises.readdir(dir))
      .filter((f) => f.startsWith("auto_backup_") && f.endsWith(".json"))
      .sort();
    if (files.length > 30) {
      for (const old of files.slice(0, files.length - 30)) {
        try {
          await fs.promises.unlink(path.join(dir, old));
        } catch (delErr) {
          console.warn(`[auto-backup] Could not delete old backup "${old}":`, delErr.message);
        }
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
