import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';

const IS_DEV = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
const BACKEND_PORT = IS_DEV ? '5437' : '5337';
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  if (IS_DEV) { win.loadURL('http://localhost:5173'); win.webContents.openDevTools(); }
  else { win.loadFile(path.join(__dirname, '../dist/index.html')); }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

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
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name, path: path.join(dirPath, e.name), isDirectory: e.isDirectory(),
      size: e.isFile() ? fs.statSync(path.join(dirPath, e.name)).size : 0,
      modified: e.isFile() ? fs.statSync(path.join(dirPath, e.name)).mtime.toISOString() : '',
    }));
  } catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('readDirectoryImages', async (_, dirPath: string) => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const images = entries.filter(e => {
      const ext = e.name.split('.').pop()?.toLowerCase() || '';
      return e.isFile() && ['png','jpg','jpeg','gif','webp','svg','bmp','ico'].includes(ext);
    }).map(e => ({
      name: e.name, path: path.join(dirPath, e.name),
      size: fs.statSync(path.join(dirPath, e.name)).size,
      modified: fs.statSync(path.join(dirPath, e.name)).mtime.toISOString(),
    }));
    return images;
  } catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('ensureDirectory', async (_, dirPath: string) => {
  try { await fs.promises.mkdir(dirPath, { recursive: true }); return { success: true }; }
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
  try { const content = await fs.promises.readFile(filePath, 'utf-8'); return { content }; }
  catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('write-file-content', async (_, filePath: string, content: string) => {
  try { await fs.promises.writeFile(filePath, content, 'utf-8'); return { success: true }; }
  catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('read-file-buffer', async (_, filePath: string) => {
  try { const data = await fs.promises.readFile(filePath); return { data: Array.from(data) }; }
  catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('write-file-buffer', async (_, filePath: string, uint8: number[]) => {
  try { await fs.promises.writeFile(filePath, Buffer.from(uint8)); return { success: true }; }
  catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('getFileStats', async (_, filePath: string) => {
  try { const s = fs.statSync(filePath); return { size: s.size, modified: s.mtime.toISOString(), isDirectory: s.isDirectory() }; }
  catch (e) { return { error: (e as Error).message }; }
});
ipcMain.handle('file-exists', async (_, filePath: string) => { try { return fs.existsSync(filePath); } catch { return false; } });
ipcMain.handle('delete-file', async (_, filePath: string) => { try { fs.unlinkSync(filePath); return { success: true }; } catch (e) { return { error: (e as Error).message }; } });
ipcMain.handle('copy-file', async (_, src: string, dest: string) => { try { fs.copyFileSync(src, dest); return { success: true }; } catch (e) { return { error: (e as Error).message }; } });
ipcMain.handle('renameFile', async (_, oldPath: string, newPath: string) => { try { fs.renameSync(oldPath, newPath); return { success: true }; } catch (e) { return { error: (e as Error).message }; } });
ipcMain.handle('open-in-native-explorer', async (_, filePath: string) => {
  const { shell } = require('electron');
  shell.showItemInFolder(filePath); return { success: true };
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
        body: JSON.stringify({ prompt, n, model, provider, attachments, baseFilename, currentPath }),
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
    await fs.promises.mkdir(folderPath, { recursive: true });
    await fs.promises.writeFile(path.join(folderPath, filename), data);
    return { success: true, path: path.join(folderPath, filename) };
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
