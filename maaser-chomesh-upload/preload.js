const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  saveAutoBackup       : (data)     => ipcRenderer.invoke("save-auto-backup", data),
  getAutoBackupFolder  : ()         => ipcRenderer.invoke("get-auto-backup-folder"),
  openAutoBackupFolder : ()         => ipcRenderer.invoke("open-auto-backup-folder"),
  listAutoBackups      : ()         => ipcRenderer.invoke("list-auto-backups"),
  readAutoBackup       : (filename) => ipcRenderer.invoke("read-auto-backup", filename),
  isElectron           : true
});
