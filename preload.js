
const { contextBridge, ipcRenderer } = require('electron');

// ==========================================
// AdobeStock 4K 30fps Studio
// Secure Renderer API
// ==========================================

const desktopAPI = {

  // Application status
  getStatus: async () => {
    return await ipcRenderer.invoke('app:get-status');
  },

  // Select output folder
  selectFolder: async () => {
    return await ipcRenderer.invoke('dialog:select-folder');
  },

  // Open output folder
  openFolder: async (folderPath) => {
    return await ipcRenderer.invoke(
      'fs:open-folder',
      folderPath
    );
  },

  // Save MP4 video
  saveMp4: async (payload) => {

    if (!payload || !payload.fileName || !payload.buffer) {
      throw new Error('Invalid MP4 save payload.');
    }

    return await ipcRenderer.invoke(
      'fs:save-mp4',
      payload
    );
  },

  // Save CSV metadata
  saveCsv: async (payload) => {

    if (!payload || !payload.fileName || typeof payload.content !== 'string') {
      throw new Error('Invalid CSV save payload.');
    }

    return await ipcRenderer.invoke(
      'fs:save-csv',
      payload
    );
  },

  // Generate video code using Gemini AI
  generateLoop: async (payload) => {

    if (!payload || !payload.prompt) {
      throw new Error('Video prompt is required.');
    }

    return await ipcRenderer.invoke(
      'gemini:generate-loop',
      payload
    );
  }

};

// ==========================================
// Expose API to Renderer
// ==========================================

contextBridge.exposeInMainWorld(
  'desktopAPI',
  Object.freeze(desktopAPI)
);

console.log('AdobeStock Studio Preload API Ready.');
