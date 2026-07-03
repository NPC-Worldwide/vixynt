import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export interface IElectronAPI {
  readDirectory: (dirPath: string) => Promise<any>;
  readDirectoryImages: (dirPath: string) => Promise<any>;
  ensureDir: (dirPath: string) => Promise<any>;
  getHomeDir: () => Promise<string>;
  showOpenDialog: (options: any) => Promise<any>;
  showSaveDialog: (options: any) => Promise<any>;
  readFileContent: (filePath: string) => Promise<any>;
  writeFileContent: (filePath: string, content: string) => Promise<any>;
  readFileBuffer: (filePath: string) => Promise<any>;
  writeFileBuffer: (filePath: string, uint8: number[]) => Promise<any>;
  getFileStats: (filePath: string) => Promise<any>;
  fileExists: (filePath: string) => Promise<boolean>;
  deleteFile: (filePath: string) => Promise<any>;
  copyFile: (src: string, dest: string) => Promise<any>;
  renameFile: (oldPath: string, newPath: string) => Promise<any>;
  openInNativeExplorer: (filePath: string) => Promise<any>;
  generateImages: (prompt: string, n: number, model: string, provider: string, attachments: any[], baseFilename: string, currentPath: string, opts?: { workspacePath?: string; width?: number; height?: number; customModelPath?: string }) => Promise<any>;
  saveGeneratedImage: (blob: any, folderPath: string, filename: string) => Promise<any>;
  generativeFill: (params: any) => Promise<any>;
  fineTuneDiffusers: (params: any) => Promise<any>;
  getFineTuneStatus: (jobId: string) => Promise<any>;
  getAvailableImageModels: (currentPath: string) => Promise<any>;
  windowControls: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
  windowState: {
    isMaximized: () => Promise<boolean>;
  };
  onWindowStateChange: (callback: (state: { isMaximized: boolean }) => void) => () => void;
}

const windowStateCallbacks: Array<(state: { isMaximized: boolean }) => void> = [];

ipcRenderer.on('window-state-changed', (_event: IpcRendererEvent, state: { isMaximized: boolean }) => {
  windowStateCallbacks.forEach(cb => cb(state));
});

contextBridge.exposeInMainWorld('api', {
  readDirectory: (dirPath: string) => ipcRenderer.invoke('readDirectory', dirPath),
  readDirectoryImages: (dirPath: string) => ipcRenderer.invoke('readDirectoryImages', dirPath),
  ensureDir: (dirPath: string) => ipcRenderer.invoke('ensureDirectory', dirPath),
  getHomeDir: () => ipcRenderer.invoke('getHomeDir'),
  showOpenDialog: (options: any) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options: any) => ipcRenderer.invoke('show-save-dialog', options),
  readFileContent: (filePath: string) => ipcRenderer.invoke('read-file-content', filePath),
  writeFileContent: (filePath: string, content: string) => ipcRenderer.invoke('write-file-content', filePath, content),
  readFileBuffer: (filePath: string) => ipcRenderer.invoke('read-file-buffer', filePath),
  writeFileBuffer: (filePath: string, uint8: number[]) => ipcRenderer.invoke('write-file-buffer', filePath, uint8),
  getFileStats: (filePath: string) => ipcRenderer.invoke('getFileStats', filePath),
  fileExists: (filePath: string) => ipcRenderer.invoke('file-exists', filePath),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  copyFile: (src: string, dest: string) => ipcRenderer.invoke('copy-file', src, dest),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('renameFile', oldPath, newPath),
  openInNativeExplorer: (filePath: string) => ipcRenderer.invoke('open-in-native-explorer', filePath),
  generateImages: (prompt: string, n: number, model: string, provider: string, attachments: any[], baseFilename: string, currentPath: string, opts = {}) =>
    ipcRenderer.invoke('generate_images', { prompt, n, model, provider, attachments, baseFilename, currentPath, workspacePath: opts.workspacePath, width: opts.width, height: opts.height, customModelPath: opts.customModelPath }),
  saveGeneratedImage: (blob: any, folderPath: string, filename: string) => ipcRenderer.invoke('save-generated-image', blob, folderPath, filename),
  generativeFill: (params: any) => ipcRenderer.invoke('generative-fill', params),
  fineTuneDiffusers: (params: any) => ipcRenderer.invoke('finetune-diffusers', params),
  getFineTuneStatus: (jobId: string) => ipcRenderer.invoke('get-finetune-status', jobId),
  getAvailableImageModels: (currentPath: string) => ipcRenderer.invoke('getAvailableImageModels', currentPath),
  windowControls: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
  },
  windowState: {
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  },
  onWindowStateChange: (callback: (state: { isMaximized: boolean }) => void) => {
    windowStateCallbacks.push(callback);
    return () => {
      const idx = windowStateCallbacks.indexOf(callback);
      if (idx !== -1) windowStateCallbacks.splice(idx, 1);
    };
  },
} as IElectronAPI);

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
