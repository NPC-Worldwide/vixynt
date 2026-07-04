import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Trash2, Square } from 'lucide-react';

interface PhysicsObject {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  mass: number;
}

const GameEngine: React.FC = () => {
  const [objects, setObjects] = useState<PhysicsObject[]>([]);
  const [gravity, setGravity] = useState(9.8);
  const [paused, setPaused] = useState(false);
  const [selectedObj, setSelectedObj] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (paused) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const step = () => {
      setObjects(prev => {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const updated = prev.map(obj => {
          let { x, y, vx, vy } = obj;
          vy += gravity * 0.01;
          x += vx * 0.01;
          y += vy * 0.01;
          if (y + obj.h >= h) { y = h - obj.h; vy *= -0.5; }
          if (y <= 0) { y = 0; vy *= -0.5; }
          if (x + obj.w >= w) { x = w - obj.w; vx *= -0.5; }
          if (x <= 0) { x = 0; vx *= -0.5; }
          return { ...obj, x, y, vx, vy };
        });

        ctx.clearRect(0, 0, w, h);
        updated.forEach(obj => {
          ctx.fillStyle = obj.color;
          ctx.fillRect(Math.round(obj.x), Math.round(obj.y), obj.w, obj.h);
        });

        return updated;
      });
      animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [paused, gravity]);

  const spawnObject = (x: number, y: number) => {
    const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];
    setObjects(prev => [...prev, {
      id: `obj_${Date.now()}`,
      x: x - 15, y: y - 15,
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.5) * 100,
      w: 30, h: 30,
      color: colors[Math.floor(Math.random() * colors.length)],
      mass: 1,
    }]);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-10 border-b theme-border flex items-center gap-2 px-3 bg-gray-800/80">
        <span className="text-xs text-gray-400">Physics Sandbox</span>
        <div className="w-px h-4 bg-gray-600" />
        <button
          onClick={() => setPaused(!paused)}
          className={`p-1.5 rounded ${paused ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'}`}
          title={paused ? 'Play' : 'Pause'}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">Gravity:</span>
          <input
            type="range"
            min={0} max={30} step={0.5}
            value={gravity}
            onChange={e => setGravity(parseFloat(e.target.value))}
            className="w-24 h-1"
          />
          <span className="text-xs text-gray-400 w-8">{gravity}</span>
        </div>
        <button
          onClick={() => setObjects([])}
          className="p-1.5 hover:bg-red-600/30 rounded"
          title="Clear all"
        >
          <Trash2 size={14} className="text-red-400" />
        </button>
        <div className="flex-1" />
        <span className="text-xs text-gray-500">{objects.length} objects</span>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <canvas
          ref={canvasRef}
          className="flex-1 cursor-crosshair bg-gray-900/80"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            spawnObject(e.clientX - rect.left, e.clientY - rect.top);
          }}
        />
        <div className="w-56 border-l theme-border flex flex-col overflow-hidden theme-bg-secondary">
          <div className="p-2 border-b theme-border">
            <h4 className="text-xs font-semibold text-gray-400 uppercase">Inspector</h4>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {selectedObj ? (() => {
              const obj = objects.find(o => o.id === selectedObj);
              if (!obj) return null;
              return (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400">Object: {obj.id.slice(0, 12)}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">X</label>
                      <div className="text-sm theme-bg-primary px-2 py-1 rounded">{obj.x.toFixed(1)}</div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Y</label>
                      <div className="text-sm theme-bg-primary px-2 py-1 rounded">{obj.y.toFixed(1)}</div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">VX</label>
                      <div className="text-sm theme-bg-primary px-2 py-1 rounded">{obj.vx.toFixed(1)}</div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">VY</label>
                      <div className="text-sm theme-bg-primary px-2 py-1 rounded">{obj.vy.toFixed(1)}</div>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="text-center py-8 text-gray-600">
                <Square size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">Click canvas to spawn objects.<br />Select an object to inspect.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameEngine;
