import React, { useState, useCallback } from 'react';
import PhotoViewer from './components/PhotoViewer';
import TitleBar from './components/TitleBar';
import { SettingsProvider } from './components/SettingsContext';
import { getHomeDir } from './lib/utils';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>('');
  React.useEffect(() => { getHomeDir().then((dir) => setCurrentPath(dir)); }, []);
  if (!currentPath) {
    return (
      <div className="h-screen w-screen theme-bg-primary flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }
  return (
    <div className="h-screen w-screen theme-bg-primary overflow-hidden flex flex-col">
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <SettingsProvider>
          <PhotoViewer currentPath={currentPath} />
        </SettingsProvider>
      </div>
    </div>
  );
}
