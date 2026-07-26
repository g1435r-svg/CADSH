const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  saveAutoBackup: (data) => ipcRenderer.invoke("save-auto-backup", data),
  getAutoBackupFolder: () => ipcRenderer.invoke("get-auto-backup-folder"),
  isElectron: true
});
