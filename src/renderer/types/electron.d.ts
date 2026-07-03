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
  generateImages: (args: any) => Promise<any>;
  saveGeneratedImage: (blob: any, folderPath: string, filename: string) => Promise<any>;
  generativeFill: (params: any) => Promise<any>;
  fineTuneDiffusers: (params: any) => Promise<any>;
  getFineTuneStatus: (jobId: string) => Promise<any>;
  windowControls: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
  windowState: {
    isMaximized: () => Promise<boolean>;
  };
  onWindowStateChange: (callback: (state: { isMaximized: boolean }) => void) => (() => void);
}
declare global {
  interface Window {
    api: IElectronAPI;
  }
}
export {};
