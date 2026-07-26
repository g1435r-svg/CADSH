const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");

function getBackupDir() {
  return app.getPath("userData");
}

function getBackupPath() {
  return path.join(getBackupDir(), "auto-backup.json");
}

ipcMain.handle("backup-write", async (_event, json) => {
  const dest = getBackupPath();
  await fs.promises.mkdir(getBackupDir(), { recursive: true });
  await fs.promises.writeFile(dest, json, "utf8");
  return dest;
});

ipcMain.handle("backup-open-folder", async () => {
  shell.openPath(getBackupDir());
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
