import React, { useState, useRef } from 'react';
import { Film, Play, Pause, PlusCircle, Image as ImageIcon } from 'lucide-react';

interface AnimFrame {
  id: string;
  name: string;
  duration: number;
  image: string | null;
}

const AnimationStudio: React.FC = () => {
  const [animFrames, setAnimFrames] = useState<AnimFrame[]>([
    { id: 'frame_1', name: 'Frame 1', duration: 100, image: null },
  ]);
  const [selectedFrameId, setSelectedFrameId] = useState<string>('frame_1');
  const [animPlaying, setAnimPlaying] = useState(false);
  const [animFps, setAnimFps] = useState(12);
  const animPreviewRef = useRef<HTMLDivElement>(null);
  const selectedFrame = animFrames.find(f => f.id === selectedFrameId);

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-56 border-r theme-border flex flex-col overflow-hidden theme-bg-secondary">
        <div className="p-2 border-b theme-border">
          <h4 className="text-xs font-semibold text-gray-400 uppercase">Frames</h4>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {animFrames.map((frame, i) => (
            <div
              key={frame.id}
              onClick={() => setSelectedFrameId(frame.id)}
              className={`p-2 rounded cursor-pointer flex items-center gap-2 ${
                selectedFrameId === frame.id ? 'bg-blue-600/40 ring-1 ring-blue-500' : 'bg-gray-700/30 hover:bg-gray-700/50'
              }`}
            >
              <span className="text-xs text-gray-400 w-6">{i + 1}</span>
              <span className="text-xs flex-1 truncate">{frame.name}</span>
              <span className="text-xs text-gray-500">{frame.duration}ms</span>
            </div>
          ))}
          <button
            onClick={() => {
              const id = `frame_${Date.now()}`;
              setAnimFrames(prev => [...prev, { id, name: `Frame ${prev.length + 1}`, duration: 100, image: null }]);
              setSelectedFrameId(id);
            }}
            className="w-full py-1.5 text-xs theme-button rounded flex items-center justify-center gap-1"
          >
            <PlusCircle size={12} /> Add Frame
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4 bg-gray-900/50">
          <div ref={animPreviewRef} className="relative w-full max-w-4xl aspect-video bg-gray-800/80 rounded-lg overflow-hidden shadow-2xl flex items-center justify-center">
            {selectedFrame?.image ? (
              <img src={selectedFrame.image} className="max-w-full max-h-full object-contain" alt={selectedFrame.name} />
            ) : (
              <div className="text-center">
                <Film size={48} className="mx-auto text-gray-700 mb-2" />
                <p className="text-gray-600 text-sm">Select a frame or drag an image here</p>
              </div>
            )}
          </div>
        </div>

        <div className="h-14 border-t theme-border flex items-center justify-center gap-3 bg-gray-800/50">
          <button
            onClick={() => setAnimPlaying(!animPlaying)}
            className="p-3 bg-blue-600 hover:bg-blue-700 rounded-full"
          >
            {animPlaying ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">FPS:</span>
            <input
              type="number"
              min={1} max={60} value={animFps}
              onChange={e => setAnimFps(parseInt(e.target.value) || 12)}
              className="w-14 theme-input text-xs text-center"
            />
          </div>
        </div>

        <div className="h-32 border-t theme-border flex overflow-x-auto bg-gray-900/80">
          <div className="flex gap-1 p-2">
            {animFrames.map((frame, i) => (
              <div
                key={frame.id}
                onClick={() => setSelectedFrameId(frame.id)}
                className={`flex-shrink-0 w-20 h-20 rounded cursor-pointer border-2 flex flex-col items-center justify-center ${
                  selectedFrameId === frame.id ? 'border-blue-500 bg-blue-600/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                {frame.image ? (
                  <img src={frame.image} className="w-full h-full object-cover rounded" alt="" />
                ) : (
                  <ImageIcon size={20} className="text-gray-600" />
                )}
                <span className="text-xs text-gray-500 mt-0.5">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-64 border-l theme-border flex flex-col overflow-hidden theme-bg-secondary">
        <div className="p-2 border-b theme-border">
          <h4 className="text-xs font-semibold text-gray-400 uppercase">Properties</h4>
        </div>
        {selectedFrame && (
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            <div>
              <label className="text-xs text-gray-400 uppercase">Name</label>
              <input
                type="text"
                value={selectedFrame.name}
                onChange={e => setAnimFrames(prev => prev.map(f => f.id === selectedFrame.id ? {...f, name: e.target.value} : f))}
                className="w-full theme-input text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase">Duration (ms)</label>
              <input
                type="number"
                value={selectedFrame.duration}
                onChange={e => setAnimFrames(prev => prev.map(f => f.id === selectedFrame.id ? {...f, duration: parseInt(e.target.value) || 50} : f))}
                className="w-full theme-input text-sm mt-1"
                min={10}
              />
            </div>
            <button
              onClick={() => {
                setAnimFrames(prev => prev.filter(f => f.id !== selectedFrame.id));
                setSelectedFrameId(animFrames[0]?.id || '');
              }}
              className="w-full py-1.5 bg-red-600/20 hover:bg-red-600/30 rounded text-red-400 text-xs"
            >
              Delete Frame
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimationStudio;
