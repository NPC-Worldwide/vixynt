import React, { useState } from 'react';
import { Folder, X, PlusCircle, Check, FolderOpen } from 'lucide-react';

interface TrackedFolder {
  id: string;
  name: string;
  path: string;
}

interface Settings {
  aiEnabled: boolean;
  trackedFolders: TrackedFolder[];
  defaultImageOutputDir: string;
  defaultModelOutputDir: string;
  providerApiKeys: Record<string, string>;
}

export interface SettingsPanelProps {
  aiEnabled: boolean;
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
  addTrackedFolder: (folder: TrackedFolder) => void;
  removeTrackedFolder: (id: string) => void;
  onBrowseFolder: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  aiEnabled,
  settings,
  updateSettings,
  addTrackedFolder,
  removeTrackedFolder,
  onBrowseFolder,
}) => {
  const handleAddDefaultFolder = async (label: string, defaultPath: string) => {
    try {
      const resolved = defaultPath.replace(/^~/, await (window as any).api.getHomeDir());
      const exists = await (window as any).api?.fileExists?.(resolved);
      if (exists) {
        const id = `folder_${Date.now()}`;
        addTrackedFolder({ id, name: label, path: resolved });
      } else {
        await (window as any).api?.ensureDir?.(resolved);
        const id = `folder_${Date.now()}`;
        addTrackedFolder({ id, name: label, path: resolved });
      }
    } catch {}
  };

  const defaultFolders = [
    { label: 'Pictures', path: '~/Pictures' },
    { label: 'Photos', path: '~/Photos' },
    { label: 'Movies', path: '~/Movies' },
    { label: 'Videos', path: '~/Videos' },
    { label: 'Desktop', path: '~/Desktop' },
  ];

  const PROVIDERS = [
    { id: 'gemini', name: 'Gemini' },
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic' },
    { id: 'stability', name: 'Stability AI' },
    { id: 'replicate', name: 'Replicate' },
    { id: 'fal', name: 'Fal.ai' },
    { id: 'together', name: 'Together AI' },
    { id: 'fireworks', name: 'Fireworks' },
    { id: 'deepinfra', name: 'DeepInfra' },
    { id: 'bfl', name: 'BFL/Flux' },
    { id: 'bagel', name: 'Bagel' },
    { id: 'leonardo', name: 'Leonardo' },
    { id: 'ideogram', name: 'Ideogram' },
  ];

  const [addedProviders, setAddedProviders] = useState<string[]>(() =>
    Object.keys(settings.providerApiKeys || {}).filter((id) =>
      PROVIDERS.some((p) => p.id === id)
    )
  );

  const handleAddProvider = (providerId: string) => {
    if (!providerId || addedProviders.includes(providerId)) return;
    setAddedProviders((prev) => [...prev, providerId]);
  };

  const handleRemoveProvider = (providerId: string) => {
    setAddedProviders((prev) => prev.filter((id) => id !== providerId));
    const nextKeys = { ...settings.providerApiKeys };
    delete nextKeys[providerId];
    updateSettings({ providerApiKeys: nextKeys });
  };

  const availableProviders = PROVIDERS.filter(
    (p) => !addedProviders.includes(p.id)
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 theme-bg-primary">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold theme-text-primary mb-1">Settings</h2>
          <p className="text-sm theme-text-muted">Configure Vixynt to your liking.</p>
        </div>

        <div className="border rounded-lg p-4 theme-border space-y-3">
          <h3 className="text-sm font-semibold theme-text-primary">Tracked Folders</h3>
          <p className="text-xs theme-text-muted">Folders shown in the sidebar for quick image browsing.</p>

          {settings.trackedFolders.length > 0 && (
            <div className="space-y-1">
              {settings.trackedFolders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center gap-2 p-2 rounded theme-bg-secondary"
                >
                  <Folder size={14} className="theme-text-muted" />
                  <span className="text-sm flex-1 theme-text-primary truncate">{folder.name}</span>
                  <span className="text-xs theme-text-muted">{folder.path}</span>
                  <button
                    onClick={() => removeTrackedFolder(folder.id)}
                    className="p-1 hover:bg-red-600/20 rounded"
                    title="Remove"
                  >
                    <X size={12} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 space-y-1">
            <p className="text-xs font-semibold theme-text-secondary uppercase">
              Quick-add common folders
            </p>
            <div className="flex flex-wrap gap-2">
              {defaultFolders.map((df) => {
                const alreadyAdded = settings.trackedFolders.some((f) =>
                  f.path.endsWith(df.label)
                );
                return (
                  <button
                    key={df.path}
                    onClick={() => handleAddDefaultFolder(df.label, df.path)}
                    disabled={alreadyAdded}
                    className={`px-3 py-1.5 rounded text-xs flex items-center gap-1.5 transition-colors ${
                      alreadyAdded
                        ? 'theme-bg-secondary text-gray-500 cursor-not-allowed'
                        : 'theme-button hover:bg-blue-600/30'
                    }`}
                  >
                    <PlusCircle size={12} />
                    {df.label}
                    {alreadyAdded && <Check size={12} className="text-green-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={onBrowseFolder}
            className="theme-button-primary flex items-center gap-2 px-3 py-2 rounded text-sm"
          >
            <FolderOpen size={14} /> Browse for folder...
          </button>
        </div>

        <div className="border rounded-lg p-4 theme-border space-y-3">
          <h3 className="text-sm font-semibold theme-text-primary">Output Paths</h3>
          <div>
            <label className="text-xs theme-text-secondary uppercase">Default image output</label>
            <input
              type="text"
              value={settings.defaultImageOutputDir}
              onChange={(e) => updateSettings({ defaultImageOutputDir: e.target.value })}
              placeholder="e.g. ~/Pictures/Vixynt"
              className="w-full theme-input text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-xs theme-text-secondary uppercase">Model output</label>
            <input
              type="text"
              value={settings.defaultModelOutputDir}
              onChange={(e) => updateSettings({ defaultModelOutputDir: e.target.value })}
              placeholder="e.g. ~/models"
              className="w-full theme-input text-sm mt-1"
            />
          </div>
        </div>

        <div className="border rounded-lg p-4 theme-border space-y-3">
          <h3 className="text-sm font-semibold theme-text-primary">AI Features</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(e) => updateSettings({ aiEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-gray-600 rounded-full peer-checked:bg-blue-600 transition-colors"></div>
              <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
            </div>
            <span className="text-sm theme-text-primary">
              {aiEnabled ? 'AI features enabled' : 'AI features disabled'}
            </span>
          </label>
          {aiEnabled && (
            <>
              <p className="text-xs theme-text-muted ml-13">
                Image generation, video generation, and generative fill are visible.
              </p>
              <div className="pt-2 space-y-3">
                <p className="text-xs font-semibold theme-text-secondary uppercase">
                  Provider API Keys
                </p>
                {addedProviders.map((providerId) => {
                  const provider = PROVIDERS.find((p) => p.id === providerId);
                  if (!provider) return null;
                  const key = settings.providerApiKeys?.[provider.id] || '';
                  return (
                    <div key={provider.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs theme-text-secondary uppercase">
                          {provider.name} key
                        </label>
                        <button
                          onClick={() => handleRemoveProvider(provider.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                      <input
                        type="password"
                        value={key}
                        onChange={(e) =>
                          updateSettings({
                            providerApiKeys: {
                              ...settings.providerApiKeys,
                              [provider.id]: e.target.value,
                            },
                          })
                        }
                        placeholder={`Paste your ${provider.name} API key`}
                        className="w-full theme-input text-sm mt-1"
                      />
                    </div>
                  );
                })}
                {availableProviders.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => handleAddProvider(e.target.value)}
                    className="w-full theme-input text-sm"
                  >
                    <option value="" disabled>
                      Add a provider...
                    </option>
                    {availableProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
