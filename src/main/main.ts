import { app, BrowserWindow, ipcMain, dialog, protocol, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { Readable } from 'node:stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const IS_DEV = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
const ICON_PATH = path.join(__dirname, '..', 'vixynt.png');
const BACKEND_PORT = IS_DEV ? '7140' : '5140';
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

protocol.registerSchemesAsPrivileged([{
  scheme: 'media',
  privileges: { standard: true, supportFetchAPI: true, stream: true, secure: true, corsEnabled: true }
}]);

let backendProcess: ReturnType<typeof spawn> | null = null;

function killBackendProcess() {
  if (!backendProcess) return;
  console.log('[Main] Killing backend process');
  if (process.platform === 'win32') {
    try { if (backendProcess.pid) require('child_process').execSync(`taskkill /F /T /PID ${backendProcess.pid}`, { stdio: 'ignore' }); } catch {}
  } else {
    try { if (backendProcess.pid) process.kill(-backendProcess.pid, 'SIGTERM'); } catch {}
  }
  backendProcess = null;
}

function spawnBackendProcess(pythonPath: string, args: string[], env: Record<string, string>) {
  console.log(`[Main] Spawning backend: ${pythonPath} ${args.join(' ')}`);
  const proc = spawn(pythonPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: process.platform !== 'win32',
    env,
  });
  proc.stdout.on('data', (d) => console.log('[Backend stdout]', d.toString().trim()));
  proc.stderr.on('data', (d) => console.error('[Backend stderr]', d.toString().trim()));
  proc.on('error', (err) => console.error('[Backend error]', err.message));
  proc.on('close', (code) => console.log(`[Backend] exited with code ${code}`));
  return proc;
}

async function waitForServer(maxAttempts = 60, delay = 1000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${BACKEND_URL}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) { console.log(`[Main] Backend ready (attempt ${i})`); return true; }
    } catch {}
    await new Promise(r => setTimeout(r, delay));
  }
  console.error('[Main] Backend failed to start');
  return false;
}

function getBackendPythonPath(): string | null {
  const rc = path.join(os.homedir(), '.npcshrc');
  try {
    if (fs.existsSync(rc)) {
      const content = fs.readFileSync(rc, 'utf8');
      const m = content.match(/BACKEND_PYTHON_PATH=["']?([^"'\n]+)["']?/);
      if (m?.[1]?.trim()) {
        const p = m[1].trim().replace(/^~/, os.homedir());
        if (fs.existsSync(p)) return p;
      }
    }
  } catch {}
  return getPythonPath();
}

function getBackendScriptPath(): string | null {
  // In packaged builds the script lives inside the app.asar archive. Node can
  // read files through it, but Python cannot execute a path inside an asar.
  // Extract the script to a real file in userData and run that instead.
  const archivedPath = path.join(__dirname, '..', 'resources', 'vixynt_serve.py');
  if (IS_DEV && fs.existsSync(archivedPath)) {
    return archivedPath;
  }

  try {
    const extractedDir = path.join(app.getPath('userData'), 'backend');
    fs.mkdirSync(extractedDir, { recursive: true });
    const extractedPath = path.join(extractedDir, 'vixynt_serve.py');
    if (!fs.existsSync(extractedPath)) {
      fs.writeFileSync(extractedPath, fs.readFileSync(archivedPath), { mode: 0o755 });
      console.log('[Main] Extracted backend script to', extractedPath);
    }
    return extractedPath;
  } catch (err) {
    console.error('[Main] Failed to extract backend script:', err);
    return null;
  }
}

async function startBackend() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${BACKEND_URL}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) { console.log('[Main] Backend already running'); return true; }
  } catch {}

  const python = getBackendPythonPath();
  if (!python) {
    console.error('[Main] No Python found for backend');
    return false;
  }

  const scriptPath = getBackendScriptPath();
  if (!scriptPath) {
    console.error('[Main] Backend script vixynt_serve.py not available');
    return false;
  }

  const backendEnv = {
    ...process.env,
    VIXYNT_PORT: BACKEND_PORT,
    FRONTEND_PORT: IS_DEV ? '7340' : '6340',
    FLASK_DEBUG: IS_DEV ? '1' : '0',
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
    HOME: os.homedir(),
    NPCSH_BASE: path.join(os.homedir(), '.npcsh'),
  };

  backendProcess = spawnBackendProcess(python, [scriptPath], backendEnv);
  return await waitForServer();
}

app.on('before-quit', () => killBackendProcess());

// Window control IPC handlers
let mainWindow: BrowserWindow | null = null;

ipcMain.on('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  mainWindow?.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

function createWindow() {
  const isMac = process.platform === 'darwin';
  const win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac ? { trafficLightPosition: { x: 12, y: 8 } } : {}),
    ...(fs.existsSync(ICON_PATH) ? { icon: ICON_PATH } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  });
  mainWindow = win;

  // Track maximize state changes
  win.on('maximize', () => {
    win.webContents.send('window-state-changed', { isMaximized: true });
  });
  win.on('unmaximize', () => {
    win.webContents.send('window-state-changed', { isMaximized: false });
  });

  if (IS_DEV) { win.loadURL('http://localhost:7340'); win.webContents.openDevTools(); }
  else { win.loadFile(path.join(__dirname, '../dist/index.html')); }
}

app.whenReady().then(async () => {
  protocol.registerFileProtocol('media', (request, callback) => {
    const url = request.url.replace('media://', '');
    try { callback(decodeURIComponent(url)); } catch (err) { console.error(err); }
  });
  await startBackend();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

function expandHomeDir(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1).replace(/^\//, ''));
  }
  return filePath;
}

function resolveHelperScript(scriptName: string): string | null {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'resources', scriptName),
    path.join(process.resourcesPath || '', scriptName),
    path.join(app.getAppPath(), 'resources', scriptName),
  ];
  return candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

function shellOutHelper(pythonPath: string, scriptName: string, payload: any): Promise<any> {
  return new Promise((resolve) => {
    const scriptPath = resolveHelperScript(scriptName);
    if (!scriptPath) {
      resolve({ success: false, error: `${scriptName} not found in resources` });
      return;
    }
    const proc = spawn(pythonPath, [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', (err) => resolve({ success: false, error: `Failed to spawn ${pythonPath}: ${err.message}` }));
    proc.on('close', (code) => {
      if (code !== 0 && !stdout) {
        resolve({ success: false, error: stderr || `${scriptName} exited with code ${code}` });
        return;
      }
      try {
        const last = stdout.trim().split('\n').pop() || '';
        resolve(JSON.parse(last));
      } catch (err) {
        resolve({ success: false, error: `Could not parse helper output: ${(err as Error).message}. stderr: ${stderr}` });
      }
    });
    try {
      proc.stdin.write(JSON.stringify(payload));
      proc.stdin.end();
    } catch (err) {
      resolve({ success: false, error: `Failed to write to helper stdin: ${(err as Error).message}` });
    }
  });
}

function getPythonPath(): string | null {
  const candidates = [
    path.join(os.homedir(), '.npcsh', 'venv', 'bin', 'python3'),
    path.join(os.homedir(), '.npcsh', 'venv', 'Scripts', 'python.exe'),
    path.join(os.homedir(), '.venv', 'bin', 'python3'),
    path.join(os.homedir(), '.venv', 'Scripts', 'python.exe'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const which = require('child_process').execSync('which python3 || which python', { encoding: 'utf8' }).trim();
    if (which) return which;
  } catch {}
  return null;
}

// File-system IPC
ipcMain.handle('readDirectory', async (_, dirPath: string) => {
  try {
    const resolved = expandHomeDir(dirPath);
    const entries = await fs.promises.readdir(resolved, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name, path: path.join(resolved, e.name), isDirectory: e.isDirectory(),
      size: e.isFile() ? fs.statSync(path.join(resolved, e.name)).size : 0,
      modified: e.isFile() ? fs.statSync(path.join(resolved, e.name)).mtime.toISOString() : '',
    }));
  } catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('readDirectoryImages', async (_, dirPath: string) => {
  try {
    const resolved = expandHomeDir(dirPath);
    const entries = await fs.promises.readdir(resolved, { withFileTypes: true });
    const images = entries.filter(e => {
      const ext = e.name.split('.').pop()?.toLowerCase() || '';
      return e.isFile() && ['png','jpg','jpeg','gif','webp','svg','bmp','ico'].includes(ext);
    }).map(e => {
      const full = path.join(resolved, e.name);
      return {
        name: e.name,
        path: full,
        url: `media://${full}`,
        size: fs.statSync(full).size,
        modified: fs.statSync(full).mtime.toISOString(),
      };
    });
    return images;
  } catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('ensureDirectory', async (_, dirPath: string) => {
  try { await fs.promises.mkdir(expandHomeDir(dirPath), { recursive: true }); return { success: true }; }
  catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('getHomeDir', async () => os.homedir());
ipcMain.handle('show-open-dialog', async (_, options) => {
  const win = BrowserWindow.getFocusedWindow(); if (!win) return { canceled: true };
  return dialog.showOpenDialog(win, options);
});
ipcMain.handle('show-save-dialog', async (_, options) => {
  const win = BrowserWindow.getFocusedWindow(); if (!win) return { canceled: true };
  return dialog.showSaveDialog(win, options);
});
ipcMain.handle('read-file-content', async (_, filePath: string) => {
  try { const content = await fs.promises.readFile(expandHomeDir(filePath), 'utf-8'); return { content }; }
  catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('write-file-content', async (_, filePath: string, content: string) => {
  try { await fs.promises.writeFile(expandHomeDir(filePath), content, 'utf-8'); return { success: true }; }
  catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('read-file-buffer', async (_, filePath: string) => {
  try { const data = await fs.promises.readFile(expandHomeDir(filePath)); return { data: Array.from(data) }; }
  catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('write-file-buffer', async (_, filePath: string, uint8: number[]) => {
  try { await fs.promises.writeFile(expandHomeDir(filePath), Buffer.from(uint8)); return { success: true }; }
  catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('getFileStats', async (_, filePath: string) => {
  try { const s = fs.statSync(expandHomeDir(filePath)); return { size: s.size, modified: s.mtime.toISOString(), isDirectory: s.isDirectory() }; }
  catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('file-exists', async (_, filePath: string) => { try { return fs.existsSync(expandHomeDir(filePath)); } catch { return false; } });
ipcMain.handle('delete-file', async (_, filePath: string) => { try { fs.unlinkSync(expandHomeDir(filePath)); return { success: true }; } catch (e) { return { error: (e as Error).message }; } });
ipcMain.handle('copy-file', async (_, src: string, dest: string) => { try { fs.copyFileSync(expandHomeDir(src), expandHomeDir(dest)); return { success: true }; } catch (e) { return { error: (e as Error).message }; } });
ipcMain.handle('renameFile', async (_, oldPath: string, newPath: string) => { try { fs.renameSync(expandHomeDir(oldPath), expandHomeDir(newPath)); return { success: true }; } catch (e) { return { error: (e as Error).message }; } });
ipcMain.handle('open-in-native-explorer', async (_, filePath: string) => {
  const { shell } = require('electron');
  shell.showItemInFolder(expandHomeDir(filePath)); return { success: true };
});

ipcMain.handle('getAvailableImageModels', async (_, currentPath) => {
  if (!currentPath) return { models: [], error: 'Current path is required to fetch image models.' };
  try {
    const url = `${BACKEND_URL}/api/image_models?currentPath=${encodeURIComponent(currentPath)}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    if (!Array.isArray(data.models)) data.models = [];
    return data;
  } catch (err) {
    return { models: [], error: (err as Error).message || 'Failed to fetch image models from backend' };
  }
});

// Image generation IPC — proxy to the shared backend exactly like incognide does
ipcMain.handle('generate_images', async (_, { prompt, n, model, provider, attachments, baseFilename, currentPath, workspacePath, width, height, customModelPath }) => {
  console.log(`[Main Process] Image gen request: n=${n} prompt="${prompt}" model="${model}" provider=${provider}`);

  if (!prompt) return { error: 'Prompt cannot be empty' };
  if (!model || !provider) return { error: 'Image model and provider must be selected.' };

  const needsLocalVenv = provider === 'diffusers' || !!customModelPath;

  if (!needsLocalVenv) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/generate_images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, n, model, provider, attachments, baseFilename, currentPath, width, height }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        return { error: errorBody.error || `HTTP error! status: ${response.status}` };
      }
      const data = await response.json();
      if (data.error) return { error: data.error };
      return { images: data.images, filenames: data.filenames, generation_id: data.generation_id };
    } catch (error: any) {
      console.error('Error generating images via backend:', error);
      return { error: error.message || 'Image generation failed — is the backend running?' };
    }
  }

  // Local diffusers path: shell out to Python helper
  const outputDir = currentPath && currentPath.startsWith('~')
    ? path.join(os.homedir(), currentPath.slice(1).replace(/^\//, ''))
    : (currentPath || path.join(os.homedir(), '.npcsh', 'images'));

  const python = getPythonPath();
  if (!python) {
    return { error: 'No Python environment found. Install npcpy with diffusers+torch in a venv and try again.' };
  }

  const payload = {
    prompt,
    n,
    model,
    provider,
    attachments,
    base_filename: baseFilename || 'vixynt_gen_',
    output_dir: outputDir,
    width,
    height,
    custom_model_path: customModelPath,
  };

  const result = await shellOutHelper(python, 'run_image_gen.py', payload);
  if (!result.success) {
    console.error('Image generation (shell-out) failed:', result.error);
    return { error: result.error };
  }

  const paths = result.paths || [];
  const filenames = paths.map((p: string) => path.basename(p));
  return { images: paths.map((p: string) => `file://${p}`), filenames, generation_id: `gen_${Date.now()}` };
});

ipcMain.handle('save-generated-image', async (_, blob: any, folderPath: string, filename: string) => {
  try {
    const data = Buffer.from(blob, 'base64');
    const dir = expandHomeDir(folderPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path.join(dir, filename), data);
    return { success: true, path: path.join(dir, filename) };
  } catch (e) { return { error: (e as Error).message }; }
});

ipcMain.handle('generative-fill', async (_, params) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/generative_fill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Generative fill failed');
    }
    return await response.json();
  } catch (error: any) {
    console.error('Generative fill error:', error);
    return { error: error.message };
  }
});

// Fine-tuning IPC
const finetuneJobsDir = path.join(os.homedir(), '.npcsh', 'vixynt', 'finetune_jobs');

ipcMain.handle('finetune-diffusers', async (_, params) => {
  try {
    const workspacePath = params.workspacePath || params.currentPath;
    const python = getPythonPath();
    if (!python) {
      return { error: 'No Python environment found. Install npcpy with diffusers+torch in a venv and try again.' };
    }
    const scriptPath = resolveHelperScript('run_finetune_diffusers.py');
    if (!scriptPath) return { error: 'run_finetune_diffusers.py not found in resources' };

    const jobId = `ft_${Date.now()}`;
    const jobDir = path.join(finetuneJobsDir, jobId);
    await fs.promises.mkdir(jobDir, { recursive: true });
    const statusFile = path.join(jobDir, 'status.json');

    const payload = {
      images: params.images,
      captions: params.captions,
      output_name: params.outputName,
      output_path: params.outputPath,
      epochs: params.epochs,
      batch_size: params.batchSize,
      learning_rate: params.learningRate,
      job_id: jobId,
      status_file: statusFile,
    };

    const proc = spawn(python, [scriptPath], {
      stdio: ['pipe', 'ignore', 'ignore'],
      detached: true,
    });
    try {
      proc.stdin.write(JSON.stringify(payload));
      proc.stdin.end();
    } catch (err: any) {
      return { error: `Failed to start helper: ${err.message}` };
    }
    proc.unref();

    await fs.promises.writeFile(statusFile, JSON.stringify({ status: 'running', job_id: jobId, start_time: new Date().toISOString() }));
    return { job_id: jobId, status_file: statusFile };
  } catch (error: any) {
    console.error('Finetune diffusers error:', error);
    return { error: error.message };
  }
});

ipcMain.handle('get-finetune-status', async (_, jobId: string) => {
  const statusFile = path.join(finetuneJobsDir, jobId, 'status.json');
  try {
    const raw = await fs.promises.readFile(statusFile, 'utf8');
    return JSON.parse(raw);
  } catch (err: any) {
    return { error: `Status not available for job ${jobId}: ${err.message}` };
  }
});

// ─── Update checker ───
const fsPromises = fs.promises;
const APP_VERSION = (() => {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    return (JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version as string) || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();
const UPDATE_MANIFEST_URL = 'https://storage.googleapis.com/vixynt-executables/manifest.json';

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function platformDownloadKey(): string {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'win32') return 'windows-x64';
  if (platform === 'linux') return arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  if (platform === 'darwin') return arch === 'arm64' ? 'macos-arm64' : 'macos-x64';
  return 'macos-arm64';
}

ipcMain.handle('get-app-version', () => APP_VERSION);

ipcMain.handle('check-for-updates', async () => {
  try {
    const response = await fetch(UPDATE_MANIFEST_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest: any = await response.json();
    const latestVersion: string = manifest.version || '0.0.0';
    const hasUpdate = compareVersions(latestVersion, APP_VERSION) > 0;
    const platformKey = platformDownloadKey();
    const releaseUrl: string = manifest.downloads?.[platformKey] || UPDATE_MANIFEST_URL;
    return {
      success: true,
      currentVersion: APP_VERSION,
      latestVersion,
      hasUpdate,
      releaseUrl,
      downloads: manifest.downloads || {},
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err), currentVersion: APP_VERSION };
  }
});

ipcMain.handle('open-external', async (_event, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
});

ipcMain.handle('download-and-install-update', async (event, { releaseUrl }: { releaseUrl: string }) => {
  try {
    const tmpDir = path.join(os.tmpdir(), 'vixynt-update');
    await fsPromises.mkdir(tmpDir, { recursive: true });
    const fileName = path.basename(new URL(releaseUrl).pathname) || 'vixynt-update';
    const filePath = path.join(tmpDir, fileName);

    const response = await fetch(releaseUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    if (!response.body) throw new Error('No response body');

    const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
    let receivedBytes = 0;
    const fileStream = fs.createWriteStream(filePath);
    const nodeStream = Readable.fromWeb(response.body as any);

    await new Promise<void>((resolve, reject) => {
      nodeStream.on('data', (chunk: Buffer) => {
        receivedBytes += chunk.length;
        if (totalBytes > 0) {
          const progress = Math.round((receivedBytes / totalBytes) * 100);
          event.sender.send('update-download-progress', { progress, receivedBytes, totalBytes });
        }
      });
      nodeStream.pipe(fileStream);
      nodeStream.on('error', reject);
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    const platform = process.platform;
    if (platform === 'darwin' && filePath.endsWith('.dmg')) {
      spawn('open', [filePath], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform === 'win32') {
      spawn(filePath, [], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform === 'linux') {
      if (filePath.endsWith('.AppImage')) {
        await fsPromises.chmod(filePath, 0o755);
        spawn(filePath, [], { detached: true, stdio: 'ignore' }).unref();
      } else {
        spawn('xdg-open', [filePath], { detached: true, stdio: 'ignore' }).unref();
      }
    }

    return { success: true, filePath };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
});
