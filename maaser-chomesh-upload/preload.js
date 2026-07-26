const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  writeAutoBackup: (json) => ipcRenderer.invoke("backup-write", json),
  openBackupFolder: () => ipcRenderer.invoke("backup-open-folder")
});
