export const getFileName = (filePath: string | null | undefined): string => {
    if (!filePath) return '';
    return filePath.replace(/\\/g, '/').split('/').pop() || '';
};

export const generateId = () => Math.random().toString(36).slice(2, 11);

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const downloadJSON = (data: any, filename = 'labels.json') => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const readJSONFile = (file: File) =>
  new Promise<any>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });

export const getParentPath = (filePath: string | null | undefined): string => {
    if (!filePath) return '';
    const normalized = filePath.replace(/\\/g, '/');
    return normalized.split('/').slice(0, -1).join('/') || '/';
};

export const normalizePath = (p: string): string => {
    if (!p) return '';
    let normalized = p.replace(/\\/g, '/');
    if (normalized.startsWith('~/')) {
        normalized = normalized.replace('~', '');
    }
    return normalized;
};

export const stripSourcePrefix = (name: string | undefined | null): string => {
    if (!name) return '';
    return name.replace(/^(project:|global:)/, '');
};
