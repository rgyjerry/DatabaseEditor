const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("f1DbDesktop", {
  isDesktop: true,
  platform: process.platform,
  openSaveFile: () => ipcRenderer.invoke("desktop:open-save-file"),
  readRecentFile: (filePath) => ipcRenderer.invoke("desktop:read-recent-file", filePath),
  saveFile: (payload) => ipcRenderer.invoke("desktop:save-file", payload),
  listRecents: () => ipcRenderer.invoke("desktop:list-recents"),
  rememberRecent: (filePath) => ipcRenderer.invoke("desktop:remember-recent", filePath),
  forgetRecent: (filePath) => ipcRenderer.invoke("desktop:forget-recent", filePath),
});
