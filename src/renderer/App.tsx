import React, { useState, useCallback, useRef, useEffect } from 'react';
import PhotoViewer from './components/PhotoViewer';
import TitleBar from './components/TitleBar';
import { SettingsProvider } from './components/SettingsContext';
import { getHomeDir } from './lib/utils';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>('');
  const appRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  React.useEffect(() => { getHomeDir().then((dir) => setCurrentPath(dir)); }, []);

  useEffect(() => {
    if (!currentPath) return;
    requestAnimationFrame(() => {
      console.log('[APP WIDTHS]', {
        app: appRef.current?.getBoundingClientRect().width,
        content: contentRef.current?.getBoundingClientRect().width,
        windowInnerWidth: window.innerWidth,
      });
    });
  }, [currentPath]);

  if (!currentPath) {
    return (
      <div className="h-screen w-screen theme-bg-primary flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }
  return (
    <div ref={appRef} className="h-screen w-screen theme-bg-primary overflow-hidden flex flex-col">
      <TitleBar />
      <div ref={contentRef} className="flex-1 flex overflow-hidden min-w-0">
        <SettingsProvider>
          <PhotoViewer currentPath={currentPath} />
        </SettingsProvider>
      </div>
    </div>
  );
}
