const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  getStatus: () => ipcRenderer.invoke('app:get-status'),
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  openFolder: (folderPath) => ipcRenderer.invoke('fs:open-folder', folderPath),
  saveMp4: (payload) => ipcRenderer.invoke('fs:save-mp4', payload),
  saveCsv: (payload) => ipcRenderer.invoke('fs:save-csv', payload),
  generateLoop: (payload) => ipcRenderer.invoke('gemini:generate-loop', payload),
});
