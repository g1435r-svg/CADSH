const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

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
      devTools: false
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
