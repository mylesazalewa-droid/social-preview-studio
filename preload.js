const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  savePngs: (files) => ipcRenderer.invoke('save-pngs', files),
  saveFile: (payload) => ipcRenderer.invoke('save-file', payload),
  saveText: (payload) => ipcRenderer.invoke('save-text', payload),
  saveBundle: (payload) => ipcRenderer.invoke('save-bundle', payload),
  openText: (payload) => ipcRenderer.invoke('open-text', payload),
  openLink: (name) => ipcRenderer.invoke('open-link', { name }),
  openUrl: (url) => ipcRenderer.invoke('open-url', { url }),
  revealFile: (path) => ipcRenderer.invoke('reveal-file', { path }),
  publishPost: (payload) => ipcRenderer.invoke('publish-post', payload),
  fetchComments: (id) => ipcRenderer.invoke('fetch-comments', { id }),
  ai: {
    keyStatus: () => ipcRenderer.invoke('ai-key-status'),
    keyTest: (key) => ipcRenderer.invoke('ai-key-test', { key }),
    keySet: (key) => ipcRenderer.invoke('ai-key-set', { key }),
    keyClear: () => ipcRenderer.invoke('ai-key-clear'),
    gemini: (payload) => ipcRenderer.invoke('ai-gemini', payload),
  },
  video: {
    pick: () => ipcRenderer.invoke('video-pick'),
    extractAudio: (path) => ipcRenderer.invoke('video-extract-audio', { path }),
    extractFrame: (path, atSec) => ipcRenderer.invoke('video-extract-frame', { path, atSec }),
    renderClip: (path, segments) => ipcRenderer.invoke('video-render-clip', { path, segments }),
  },
});
