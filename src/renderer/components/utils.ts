export const getFileName = (filePath: string | null | undefined): string => {
    if (!filePath) return '';
    return filePath.replace(/\\/g, '/').split('/').pop() || '';
};

export const generateId = () => Math.random().toString(36).slice(2, 11);

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
