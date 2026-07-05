import React from 'react';
import { Download, Image as ImageIcon, Eraser } from 'lucide-react';
import { ImageEditor } from 'npcts';

interface DarkRoomProps {
  containerRef?: React.RefObject<HTMLDivElement>;
  editorWrapperRef?: React.RefObject<HTMLDivElement>;
  selectedImage: string | null;
  setSelectedImage: (v: string | null) => void;
  currentPath: string;
  setError: (v: string | null) => void;
  aiEnabled: boolean;
  availableModels: any[];
  selectedModel: string;
  selectedProvider: string;
}

const DarkRoom: React.FC<DarkRoomProps> = ({
  containerRef,
  editorWrapperRef,
  selectedImage,
  setSelectedImage,
  currentPath,
  setError,
  aiEnabled,
  availableModels,
  selectedModel,
  selectedProvider,
}) => {
  const getFileParts = () => {
    if (!selectedImage) return null;
    const fsPath = selectedImage.replace('media://', '');
    const dir = fsPath.substring(0, fsPath.lastIndexOf('/'));
    const baseName = fsPath.substring(fsPath.lastIndexOf('/') + 1);
    const nameNoExt = baseName.substring(0, baseName.lastIndexOf('.'));
    return { fsPath, dir, baseName, nameNoExt };
  };

  const handleOpenPhotoFromDisk = async () => {
    try {
      const result = await (window as any).api?.showOpenDialog?.({
        properties: ['openFile'],
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      const picked = Array.isArray(result)
        ? result[0]?.path || result[0]
        : result?.filePaths?.[0] || result?.filePath || result?.[0];
      if (picked) setSelectedImage(`media://${picked}`);
    } catch (e) {
      setError('Failed to open photo');
    }
  };

  const handleGenerativeFill = async (
    sel: any,
    prompt: string,
    opts?: { model?: string; provider?: string }
  ) => {
    if (!prompt) {
      setError('Need a prompt');
      return;
    }
    try {
      const fsPath = (selectedImage || '').replace('media://', '');
      const resp = await (window as any).api?.generativeFill?.(
        fsPath,
        prompt,
        sel,
        opts
      );
      if (resp?.error) throw new Error(resp.error);
      if (resp?.path) setSelectedImage(`media://${resp.path}`);
    } catch (e: any) {
      setError(e.message || 'Generative fill failed');
    }
  };

  const processImage = async (processor: any) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        if (!ctx) return reject(new Error('canvas'));
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height);
        processor(ctx, c.width, c.height, d);
        ctx.putImageData(d, 0, 0);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = selectedImage || '';
    });
  };

  const lastSaveDataRef = React.useRef<any>(null);

  const handleSaveProject = async (data: any) => {
    try {
      const parts = getFileParts();
      if (!parts) return;
      lastSaveDataRef.current = data;
      const projectData = {
        version: 1,
        sourceImage: parts.fsPath,
        adjustments: data.adjustments,
        textLayers: data.textLayers,
        savedAt: new Date().toISOString(),
      };
      const projectPath = `${parts.dir}/${parts.nameNoExt}.vixynt.json`;
      await (window as any).api?.writeFileContent?.(
        projectPath,
        JSON.stringify(projectData, null, 2)
      );
      console.log('[DarkRoom] Project saved:', projectPath);
    } catch (e) {
      console.error('Save project failed:', e);
    }
  };

  const handleExport = async (format: 'png' | 'jpg' = 'png') => {
    try {
      const data = lastSaveDataRef.current;
      if (!data?.dataUrl) return;
      const parts = getFileParts();
      if (!parts) return;
      const result = await (window as any).api?.showSaveDialog?.({
        defaultPath: `${parts.nameNoExt}_export.${format}`,
        filters: [
          { name: format.toUpperCase(), extensions: [format] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (!result?.filePath) return;
      const base64 = data.dataUrl.split(',')[1];
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      await (window as any).api?.writeFileBuffer?.(result.filePath, bytes);
      console.log('[DarkRoom] Exported to:', result.filePath);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const handleRemoveBackground = async () => {
    try {
      const r = await processImage((ctx: any, w: number, h: number, d: any) => {
        const ed: number[][] = [];
        const es = 4;
        for (let x = 0; x < w; x += es) {
          const i = x * 4;
          ed.push([d[i], d[i + 1], d[i + 2]]);
          const i2 = ((h - 1) * w + x) * 4;
          ed.push([d[i2], d[i2 + 1], d[i2 + 2]]);
        }
        for (let y = 0; y < h; y += es) {
          const i = y * w * 4;
          ed.push([d[i], d[i + 1], d[i + 2]]);
          const i2 = (y * w + w - 1) * 4;
          ed.push([d[i2], d[i2 + 1], d[i2 + 2]]);
        }
        const ac = [0, 0, 0];
        ed.forEach((c) => {
          ac[0] += c[0];
          ac[1] += c[1];
          ac[2] += c[2];
        });
        ac[0] = Math.round(ac[0] / ed.length);
        ac[1] = Math.round(ac[1] / ed.length);
        ac[2] = Math.round(ac[2] / ed.length);
        for (let i = 0; i < d.length; i += 4) {
          if (
            Math.abs(d[i] - ac[0]) < 60 &&
            Math.abs(d[i + 1] - ac[1]) < 60 &&
            Math.abs(d[i + 2] - ac[2]) < 60
          ) {
            d[i + 3] = 0;
          }
        }
      });
      const p = getFileParts();
      if (p) {
        const b = atob((r as string).split(',')[1]);
        const by = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) by[i] = b.charCodeAt(i);
        await (window as any).api?.writeFileBuffer?.(`${p.dir}/${p.nameNoExt}_nobg.png`, by);
        setSelectedImage(`media://${p.dir}/${p.nameNoExt}_nobg.png`);
      }
    } catch (e) {
      setError('Background removal failed');
    }
  };

  const handleColorToAlpha = async () => {
    try {
      const r = await processImage((ctx: any, w: number, h: number, d: any) => {
        const ci = (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4;
        const tr = d[ci],
          tg = d[ci + 1],
          tb = d[ci + 2];
        for (let i = 0; i < d.length; i += 4) {
          const dist = Math.sqrt(
            (d[i] - tr) ** 2 + (d[i + 1] - tg) ** 2 + (d[i + 2] - tb) ** 2
          );
          if (dist < 50) d[i + 3] = Math.round((dist / 50) * 255);
        }
      });
      const p = getFileParts();
      if (p) {
        const b = atob((r as string).split(',')[1]);
        const by = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) by[i] = b.charCodeAt(i);
        await (window as any).api?.writeFileBuffer?.(`${p.dir}/${p.nameNoExt}_keyed.png`, by);
        setSelectedImage(`media://${p.dir}/${p.nameNoExt}_keyed.png`);
      }
    } catch (e) {
      setError('Color key failed');
    }
  };

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b theme-border theme-bg-secondary text-xs">
        <button
          onClick={() => handleExport('png')}
          disabled={!selectedImage}
          className="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded flex items-center gap-1.5"
          title="Export flattened PNG"
        >
          <Download size={12} /> Export PNG
        </button>
        <button
          onClick={() => handleExport('jpg')}
          disabled={!selectedImage}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded flex items-center gap-1.5"
          title="Export flattened JPG"
        >
          <Download size={12} /> Export JPG
        </button>
        <div className="w-px h-5 bg-gray-600 mx-1" />
        <button
          onClick={handleRemoveBackground}
          disabled={!selectedImage}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded flex items-center gap-1.5"
          title="Remove background"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 3v18" />
          </svg>{' '}
          Remove BG
        </button>
        <button
          onClick={handleColorToAlpha}
          disabled={!selectedImage}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded flex items-center gap-1.5"
          title="Color key to alpha"
        >
          <Eraser size={12} /> Color Key
        </button>
        <span className="theme-text-muted ml-2">
          Save (in editor) = project file · Export = flattened image
        </span>
      </div>
      <div className="flex-1 relative overflow-hidden theme-bg-primary">
        {selectedImage ? (
          <div ref={editorWrapperRef} className="absolute inset-0 w-full h-full [&_>*>]:w-full [&_>*>]:h-full [&_>*>]:max-w-none">
            <ImageEditor
              imageSrc={selectedImage}
              onGenerativeFill={aiEnabled ? handleGenerativeFill : undefined}
              onSave={handleSaveProject}
              showHeader={true}
              title="DarkRoom"
              className="w-full h-full"
              fillModels={aiEnabled ? availableModels : []}
              defaultFillModel={aiEnabled ? selectedModel : ''}
              defaultFillProvider={aiEnabled ? selectedProvider : ''}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={handleOpenPhotoFromDisk}
              className="flex flex-col items-center gap-4 px-10 py-8 rounded-2xl border-2 border-dashed theme-border hover:border-blue-500 hover:bg-blue-500/5 theme-text-primary transition-colors"
            >
              <ImageIcon size={64} className="text-blue-400" />
              <span className="text-base font-semibold">Open Photo</span>
              <span className="text-xs theme-text-muted">pick an image to edit in the darkroom</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DarkRoom;
