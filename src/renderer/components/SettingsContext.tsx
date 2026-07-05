import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface TrackedFolder {
  id: string;
  name: string;
  path: string;
}

interface Settings {
  aiEnabled: boolean;
  trackedFolders: TrackedFolder[];
  defaultImageOutputDir: string;
  defaultModelOutputDir: string;
  backendPythonPath: string | null;
  providerApiKeys: Record<string, string>;
}

interface SettingsContextType {
  settings: Settings;
  aiEnabled: boolean;
  updateSettings: (partial: Partial<Settings>) => void;
  addTrackedFolder: (folder: TrackedFolder) => void;
  removeTrackedFolder: (id: string) => void;
  updateTrackedFolder: (id: string, updates: Partial<TrackedFolder>) => void;
}

const DEFAULT_SETTINGS: Settings = {
  aiEnabled: true,
  trackedFolders: [],
  defaultImageOutputDir: '',
  defaultModelOutputDir: '',
  backendPythonPath: null,
  providerApiKeys: {},
};

const STORAGE_KEY = 'vixynt_settings';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  aiEnabled: true,
  updateSettings: () => {},
  addTrackedFolder: () => {},
  removeTrackedFolder: () => {},
  updateTrackedFolder: () => {},
});

export const useSettings = () => useContext(SettingsContext);
export const useAiEnabled = () => useContext(SettingsContext).aiEnabled;

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const persist = useCallback((s: Settings) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
  }, []);

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      persist(next);
      return next;
    });
  }, [persist]);

  const addTrackedFolder = useCallback((folder: TrackedFolder) => {
    setSettings(prev => {
      if (prev.trackedFolders.some(f => f.path === folder.path)) return prev;
      const next = { ...prev, trackedFolders: [...prev.trackedFolders, folder] };
      persist(next);
      return next;
    });
  }, [persist]);

  const removeTrackedFolder = useCallback((id: string) => {
    setSettings(prev => {
      const next = { ...prev, trackedFolders: prev.trackedFolders.filter(f => f.id !== id) };
      persist(next);
      return next;
    });
  }, [persist]);

  const updateTrackedFolder = useCallback((id: string, updates: Partial<TrackedFolder>) => {
    setSettings(prev => {
      const next = {
        ...prev,
        trackedFolders: prev.trackedFolders.map(f => f.id === id ? { ...f, ...updates } : f),
      };
      persist(next);
      return next;
    });
  }, [persist]);

  return (
    <SettingsContext.Provider value={{
      settings,
      aiEnabled: settings.aiEnabled,
      updateSettings,
      addTrackedFolder,
      removeTrackedFolder,
      updateTrackedFolder,
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export default SettingsContext;
