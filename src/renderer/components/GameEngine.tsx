import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Trash2, Sparkles, Plus, Circle, Square, Triangle, Minus } from 'lucide-react';

interface PhysicsBody {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  w: number;
  h: number;
  color: string;
  mass: number;
  isCircle: boolean;
  isStatic: boolean;
}

const SHAPES = {
  circle: { isCircle: true, w: 24, h: 24, radius: 12 },
  square: { isCircle: false, w: 24, h: 24, radius: 0 },
  platform: { isCircle: false, w: 120, h: 16, radius: 0 },
};

const GameEngine: React.FC = () => {
  const [bodies, setBodies] = useState<PhysicsBody[]>([]);
  const [gravity, setGravity] = useState(9.8);
  const [paused, setPaused] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [spawnShape, setSpawnShape] = useState<keyof typeof SHAPES>('circle');
  const [scenePrompt, setScenePrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const dragRef = useRef<{ id: string; ox: number; oy: number; mx: number; my: number } | null>(null);

  const resizeCanvas = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    setCanvasSize({ w, h });
    canvas.width = w;
    canvas.height = h;
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  const generateSceneFromPrompt = useCallback(async () => {
    if (!scenePrompt.trim()) return;
    setGenerating(true);
    try {
      const result = await (window as any).api?.generateScene?.(scenePrompt);
      if (result?.bodies) {
        setBodies(result.bodies);
      } else {
        const words = scenePrompt.toLowerCase().split(/\s+/);
        let count = 5;
        let useBounce = true;
        let useStatic = false;
        let useSquares = false;

        for (const w of words) {
          const n = parseInt(w);
          if (!isNaN(n) && n > 0 && n <= 50) count = n;
        }
        if (scenePrompt.toLowerCase().includes('static') || scenePrompt.toLowerCase().includes('platform') || scenePrompt.toLowerCase().includes('ground')) useStatic = true;
        if (scenePrompt.toLowerCase().includes('bounce') || scenePrompt.toLowerCase().includes('ball')) useBounce = true;
        if (scenePrompt.toLowerCase().includes('square') || scenePrompt.toLowerCase().includes('box') || scenePrompt.toLowerCase().includes('block')) useSquares = true;

        const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
        const newBodies: PhysicsBody[] = [];

        const cw = canvasSize.w || 800;
        const ch = canvasSize.h || 600;

        if (useStatic) {
          newBodies.push({
            id: `static_${Date.now()}`,
            x: cw / 2 - 60, y: ch - 50,
            vx: 0, vy: 0,
            radius: 0, w: 300, h: 16,
            color: '#6b7280', mass: 99999,
            isCircle: false, isStatic: true,
          });
        }

        for (let i = 0; i < count; i++) {
          const isCircle = useSquares ? false : Math.random() > 0.3;
          const r = isCircle ? 10 + Math.random() * 15 : 12;
          newBodies.push({
            id: `body_${Date.now()}_${i}`,
            x: cw * 0.2 + Math.random() * cw * 0.6,
            y: 50 + Math.random() * 150,
            vx: (Math.random() - 0.5) * 300,
            vy: (Math.random() - 0.5) * 100,
            radius: isCircle ? r : 0,
            w: isCircle ? 0 : r * 2,
            h: isCircle ? 0 : r * 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            mass: isCircle ? (r / 10) : (r * r / 50),
            isCircle,
            isStatic: false,
          });
        }
        setBodies(newBodies);
      }
    } catch {
      setError('Scene generation failed');
    } finally {
      setGenerating(false);
    }
  }, [scenePrompt, canvasSize]);

  const spawnBody = useCallback((px: number, py: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = px - rect.left;
    const y = py - rect.top;

    const shape = SHAPES[spawnShape];
    const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

    const body: PhysicsBody = {
      id: `body_${Date.now()}`,
      x, y,
      vx: (Math.random() - 0.5) * 200,
      vy: spawnShape === 'platform' ? 0 : (Math.random() - 0.5) * 100,
      radius: shape.radius,
      w: shape.w, h: shape.h,
      color: colors[Math.floor(Math.random() * colors.length)],
      mass: spawnShape === 'platform' ? 99999 : shape.isCircle ? 2 : 3,
      isCircle: shape.isCircle,
      isStatic: spawnShape === 'platform',
    };

    setBodies(prev => [...prev, body]);
  }, [spawnShape]);

  const findBodyAt = useCallback((px: number, py: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = px - rect.left;
    const y = py - rect.top;

    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i];
      if (b.isCircle) {
        const dx = x - b.x;
        const dy = y - b.y;
        if (dx * dx + dy * dy <= b.radius * b.radius) return b.id;
      } else {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
      }
    }
    return null;
  }, [bodies]);

  useEffect(() => {
    if (paused) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let prevTime = performance.now();

    const step = (time: number) => {
      const dt = Math.min((time - prevTime) / 1000, 0.05);
      prevTime = time;

      const cw = canvas.width;
      const ch = canvas.height;

      setBodies(prev => {
        const next = prev.map(b => {
          if (b.isStatic) return b;
          let { x, y, vx, vy } = b;
          vy += gravity * 60 * dt;
          x += vx * dt;
          y += vy * dt;

          const r = b.isCircle ? b.radius : 0;
          const hw = b.isCircle ? 0 : b.w;
          const hh = b.isCircle ? 0 : b.h;

          if (b.isCircle) {
            if (y + r >= ch) { y = ch - r; vy *= -0.6; }
            if (y - r <= 0) { y = r; vy *= -0.6; }
            if (x + r >= cw) { x = cw - r; vx *= -0.6; }
            if (x - r <= 0) { x = r; vx *= -0.6; }
          } else {
            if (y + hh >= ch) { y = ch - hh; vy *= -0.4; }
            if (y <= 0) { y = 0; vy *= -0.4; }
            if (x + hw >= cw) { x = cw - hw; vx *= -0.4; }
            if (x <= 0) { x = 0; vx *= -0.4; }
          }

          return { ...b, x, y, vx, vy };
        });

        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, cw, ch);

        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let gx = 0; gx < cw; gx += gridSize) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, ch);
          ctx.stroke();
        }
        for (let gy = 0; gy < ch; gy += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(cw, gy);
          ctx.stroke();
        }

        next.forEach(b => {
          ctx.fillStyle = b.color;
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 1;

          if (b.isCircle) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            if (b.id === selectedId) {
              ctx.strokeStyle = '#fbbf24';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(b.x, b.y, b.radius + 2, 0, Math.PI * 2);
              ctx.stroke();
            }
          } else {
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.strokeRect(b.x, b.y, b.w, b.h);
            if (b.id === selectedId) {
              ctx.strokeStyle = '#fbbf24';
              ctx.lineWidth = 2;
              ctx.strokeRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
            }
          }
        });

        return next;
      });

      animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [paused, gravity, selectedId]);

  const selectedBody = bodies.find(b => b.id === selectedId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-10 border-b theme-border flex items-center gap-2 px-3 bg-gray-800/80">
        <span className="text-xs font-semibold text-gray-300">Physics Engine</span>
        <div className="w-px h-4 bg-gray-600" />

        <div className="flex items-center gap-1">
          <button onClick={() => setSpawnShape('circle')} className={`p-1 rounded ${spawnShape === 'circle' ? 'bg-blue-600' : 'hover:bg-gray-700'}`} title="Circle">
            <Circle size={14} fill={spawnShape === 'circle' ? '#fff' : 'none'} />
          </button>
          <button onClick={() => setSpawnShape('square')} className={`p-1 rounded ${spawnShape === 'square' ? 'bg-blue-600' : 'hover:bg-gray-700'}`} title="Square">
            <Square size={14} fill={spawnShape === 'square' ? '#fff' : 'none'} />
          </button>
          <button onClick={() => setSpawnShape('platform')} className={`p-1 rounded ${spawnShape === 'platform' ? 'bg-blue-600' : 'hover:bg-gray-700'}`} title="Static Platform">
            <Minus size={14} />
          </button>
        </div>

        <button
          onClick={() => setPaused(!paused)}
          className={`p-1.5 rounded text-xs flex items-center gap-1 ${paused ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'}`}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>

        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">G:</span>
          <input type="range" min={0} max={30} step={0.5} value={gravity} onChange={e => setGravity(parseFloat(e.target.value))} className="w-20 h-1" />
          <span className="text-xs text-gray-400 w-6">{gravity}</span>
        </div>

        <button onClick={() => { setBodies([]); setSelectedId(null); }} className="p-1.5 hover:bg-red-600/30 rounded" title="Clear">
          <Trash2 size={14} className="text-red-400" />
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <input
            type="text"
            value={scenePrompt}
            onChange={e => setScenePrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') generateSceneFromPrompt(); }}
            placeholder="e.g. 10 bouncing balls and a platform..."
            className="text-xs theme-input px-2 py-1 w-64"
          />
          <button
            onClick={generateSceneFromPrompt}
            disabled={generating || !scenePrompt.trim()}
            className="p-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded flex items-center gap-1 text-xs"
          >
            {generating ? <Sparkles size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Generate
          </button>
        </div>

        <span className="text-xs text-gray-500 ml-2">{bodies.length} objects</span>
      </div>

      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        <canvas
          ref={canvasRef}
          className="flex-1 cursor-crosshair"
          onClick={(e) => {
            const hit = findBodyAt(e.clientX, e.clientY);
            if (hit) {
              setSelectedId(hit);
            } else {
              spawnBody(e.clientX, e.clientY);
            }
          }}
          onMouseDown={(e) => {
            const hit = findBodyAt(e.clientX, e.clientY);
            if (hit && !bodies.find(b => b.id === hit)?.isStatic) {
              const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
              const mx = e.clientX - rect.left;
              const my = e.clientY - rect.top;
              const body = bodies.find(b => b.id === hit)!;
              dragRef.current = { id: hit, ox: body.x, oy: body.y, mx, my };
            }
          }}
          onMouseMove={(e) => {
            if (!dragRef.current) return;
            const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const dx = mx - dragRef.current.mx;
            const dy = my - dragRef.current.my;
            setBodies(prev => prev.map(b => {
              if (b.id !== dragRef.current!.id) return b;
              return { ...b, x: dragRef.current!.ox + dx, y: dragRef.current!.oy + dy, vx: dx * 3, vy: dy * 3 };
            }));
          }}
          onMouseUp={() => { dragRef.current = null; }}
          onMouseLeave={() => { dragRef.current = null; }}
        />

        <div className="w-64 border-l theme-border flex flex-col overflow-hidden theme-bg-secondary">
          <div className="p-2 border-b theme-border flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-400 uppercase">Inspector</h4>
            {selectedBody && (
              <button onClick={() => setBodies(prev => prev.filter(b => b.id !== selectedId))} className="p-0.5 hover:bg-red-600/30 rounded">
                <Trash2 size={12} className="text-red-400" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {selectedBody ? (
              <div className="space-y-3">
                <div className={`p-3 rounded-lg ${selectedBody.isStatic ? 'bg-gray-600/20' : selectedBody.isCircle ? 'bg-blue-600/20' : 'bg-orange-600/20'}`}>
                  <p className="text-xs text-gray-300">{selectedBody.isStatic ? 'Static Platform' : selectedBody.isCircle ? 'Circle' : 'Square'}</p>
                  <p className="text-xs text-gray-500">Mass: {selectedBody.mass.toFixed(1)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-gray-500">X</label><div className="text-sm theme-bg-primary px-2 py-1 rounded font-mono">{selectedBody.x.toFixed(1)}</div></div>
                  <div><label className="text-xs text-gray-500">Y</label><div className="text-sm theme-bg-primary px-2 py-1 rounded font-mono">{selectedBody.y.toFixed(1)}</div></div>
                  <div><label className="text-xs text-gray-500">VX</label><div className="text-sm theme-bg-primary px-2 py-1 rounded font-mono">{selectedBody.vx.toFixed(1)}</div></div>
                  <div><label className="text-xs text-gray-500">VY</label><div className="text-sm theme-bg-primary px-2 py-1 rounded font-mono">{selectedBody.vy.toFixed(1)}</div></div>
                </div>
                {!selectedBody.isStatic && (
                  <button onClick={() => setPaused(false)} className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs">
                    <Play size={12} className="inline mr-1" />Resume
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600">
                <Sparkles size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">Click canvas to spawn.<br />Click body to select.<br />Drag to throw bodies.</p>
                <div className="mt-3 text-xs text-gray-500 space-y-1">
                  <p>Try: "15 bouncing balls"</p>
                  <p>Try: "bouncing balls and a platform"</p>
                  <p>Try: "10 static boxes"</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameEngine;
