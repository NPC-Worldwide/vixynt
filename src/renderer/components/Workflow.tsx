import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, ChevronsRight, Loader, Save, Trash2, Workflow as WorkflowIcon, X } from 'lucide-react';

interface WorkflowProps {
    currentPath: string;
    selectedModel: string;
    selectedProvider: string;
    availableModels: any[];
    settings: { defaultImageOutputDir?: string };
    aiEnabled: boolean;
    selectedImage: string | null;
    setError: (v: string | null) => void;
}

const Workflow: React.FC<WorkflowProps> = ({
    currentPath,
    selectedModel,
    selectedProvider,
    availableModels,
    settings,
    aiEnabled,
    selectedImage,
    setError,
}) => {
const WORKFLOW_NODE_TYPES = {
    source: { name: 'Load Image', icon: '📂', color: 'bg-blue-600', inputs: [], outputs: ['image'] },
    generate: { name: 'Generate', icon: '✨', color: 'bg-purple-600', inputs: ['ref'], outputs: ['image'] },
    upscale: { name: 'Upscale', icon: '🔍', color: 'bg-green-600', inputs: ['image'], outputs: ['image'] },
    adjust: { name: 'Adjust', icon: '🎨', color: 'bg-yellow-600', inputs: ['image'], outputs: ['image'] },
    filter: { name: 'Filter', icon: '🖼️', color: 'bg-pink-600', inputs: ['image', 'style'], outputs: ['image'] },
    mask: { name: 'Mask', icon: '✂️', color: 'bg-cyan-600', inputs: ['image'], outputs: ['image', 'mask'] },
    fill: { name: 'Gen Fill', icon: '🪄', color: 'bg-indigo-600', inputs: ['image', 'mask'], outputs: ['image'] },
    output: { name: 'Save', icon: '💾', color: 'bg-gray-600', inputs: ['image'], outputs: [] }
};

const addWorkflowNode = useCallback((type, x = 100, y = 100) => {
    const nodeConfig = WORKFLOW_NODE_TYPES[type];
    const newNode = {
        id: `node_${Date.now()}`,
        type,
        x,
        y,
        params: type === 'generate' ? { prompt: '', model: selectedModel } :
                type === 'adjust' ? { brightness: 0, contrast: 0, saturation: 0 } :
                type === 'upscale' ? { scale: 2 } :
                type === 'source' ? { imagePath: '' } :
                type === 'output' ? { filename: 'output.png' } : {}
    };
    setWorkflowNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
}, [selectedModel]);

const deleteWorkflowNode = useCallback((nodeId) => {
    setWorkflowNodes(prev => prev.filter(n => n.id !== nodeId));
    setWorkflowConnections(prev => prev.filter(c => c.from !== nodeId && c.to !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
}, [selectedNodeId]);

const updateWorkflowNode = useCallback((nodeId, params) => {
    setWorkflowNodes(prev => prev.map(n =>
        n.id === nodeId ? { ...n, params: { ...n.params, ...params } } : n
    ));
}, []);

const addWorkflowConnection = useCallback((fromNode, fromPort, toNode, toPort) => {
    const existingConnection = workflowConnections.find(
        c => c.to === toNode && c.toPort === toPort
    );
    if (existingConnection) {
        setWorkflowConnections(prev => prev.filter(c => c !== existingConnection));
    }
    setWorkflowConnections(prev => [...prev, {
        id: `conn_${Date.now()}`,
        from: fromNode,
        fromPort,
        to: toNode,
        toPort
    }]);
}, [workflowConnections]);

const executeWorkflow = useCallback(async () => {
    setWorkflowExecuting(true);
    setWorkflowResult(null);
    setWorkflowNodes(prev => prev.map(n => ({
        ...n,
        _output: undefined,
        _status: undefined,
        _statusMsg: undefined,
    })));
    try {
        const nodeOutputs: Record<string, { image: string | null; mask?: string | null }> = {};
        const processed = new Set<string>();
        const setStatus = (id: string, s: 'running' | 'done' | 'error', msg?: string) => {
            updateWorkflowNode(id, { _status: s, _statusMsg: msg });
        };
        const cleanPath = (p: string) => (p ? p.replace(/^media:\/\//, '') : '');
        const outputDir = settings.defaultImageOutputDir || currentPath || '~/Pictures';

        // Seed source + generate nodes
        for (const node of workflowNodes) {
            if (node.type === 'source') {
                setStatus(node.id, 'running');
                const p = node.params?.imagePath;
                if (!p) { setStatus(node.id, 'error', 'No image set'); continue; }
                nodeOutputs[node.id] = { image: cleanPath(p) };
                updateWorkflowNode(node.id, { _output: cleanPath(p) });
                processed.add(node.id);
                setStatus(node.id, 'done');
            } else if (node.type === 'generate') {
                const prompt = node.params?.prompt;
                if (!prompt) { setStatus(node.id, 'error', 'No prompt'); continue; }
                setStatus(node.id, 'running', 'Generating…');
                try {
                    // Route away from the local `diffusers` provider — the env's
                    // diffusers/peft/transformers versions disagree (HybridCache
                    // import error), so the backend crashes. Prefer any non-
                    // diffusers model from the available list, then fall back to
                    // a sane cloud default.
                    let genModel = node.params?.model || selectedModel;
                    let genProvider = node.params?.provider || selectedProvider;
                    if (genProvider === 'diffusers') {
                        const cloud = availableModels.find((m: any) => m.provider && m.provider !== 'diffusers');
                        if (cloud) {
                            genModel = cloud.value || cloud.name || cloud.display_name;
                            genProvider = cloud.provider;
                        } else {
                            genModel = 'gemini-2.5-flash-image';
                            genProvider = 'gemini';
                        }
                    }
                    const resp = await window.api.generateImages(
                        prompt, 1,
                        genModel, genProvider,
                        [], node.params?.filename || 'wf_gen', outputDir,
                        { workspacePath: currentPath },
                    );
                    if (resp?.error) throw new Error(resp.error);
                    const out = resp?.filenames && resp.filenames[0];
                    if (!out) throw new Error('Backend returned no filenames — image not saved');
                    nodeOutputs[node.id] = { image: cleanPath(out) };
                    updateWorkflowNode(node.id, { _output: cleanPath(out) });
                    processed.add(node.id);
                    setStatus(node.id, 'done', `${genProvider}`);
                } catch (e: any) {
                    setStatus(node.id, 'error', e.message || 'generate failed');
                }
            }
        }

        // Downstream DAG walk
        let changed = true;
        while (changed) {
            changed = false;
            for (const node of workflowNodes) {
                if (processed.has(node.id)) continue;
                const incoming = workflowConnections.filter(c => c.to === node.id);
                if (!incoming.length || !incoming.every(c => processed.has(c.from))) continue;
                const inputImage = incoming.map(c => nodeOutputs[c.from]?.image).find(Boolean) || null;

                if (node.type === 'adjust' || node.type === 'filter' || node.type === 'upscale' || node.type === 'mask') {
                    setStatus(node.id, 'done', 'pass-through (op not yet wired)');
                    nodeOutputs[node.id] = { image: inputImage };
                    updateWorkflowNode(node.id, { _output: inputImage });
                    processed.add(node.id); changed = true;
                } else if (node.type === 'fill') {
                    setStatus(node.id, 'done', 'pass-through (fill op not yet wired)');
                    nodeOutputs[node.id] = { image: inputImage };
                    updateWorkflowNode(node.id, { _output: inputImage });
                    processed.add(node.id); changed = true;
                } else if (node.type === 'output') {
                    setStatus(node.id, 'running');
                    try {
                        if (!inputImage) throw new Error('No image on input');
                        const outName = node.params?.filename || `wf_${Date.now()}.png`;
                        const outPath = `${outputDir}/${outName}`;
                        await window.api?.copyFile?.(inputImage, outPath);
                        nodeOutputs[node.id] = { image: outPath };
                        updateWorkflowNode(node.id, { _output: outPath });
                        setStatus(node.id, 'done', outPath);
                        setWorkflowResult({ path: `media://${outPath}`, savedTo: outPath });
                    } catch (e: any) {
                        setStatus(node.id, 'error', e.message || 'save failed');
                    }
                    processed.add(node.id); changed = true;
                } else {
                    nodeOutputs[node.id] = { image: inputImage };
                    updateWorkflowNode(node.id, { _output: inputImage });
                    processed.add(node.id); changed = true;
                }
            }
        }

        // Final result: the last produced image from any output node, else the last non-source
        if (!workflowNodes.some(n => n.type === 'output') && processed.size > 0) {
            const lastImg = Object.values(nodeOutputs).reverse().find(o => o.image)?.image;
            if (lastImg) setWorkflowResult({ path: lastImg.startsWith('media://') ? lastImg : `media://${lastImg}`, savedTo: null });
        }

        console.log('[Workflow] Execution complete. Processed:', processed.size, 'nodes');
    } catch (err: any) {
        setError('Workflow execution failed: ' + err.message);
    } finally {
        setWorkflowExecuting(false);
    }
}, [workflowNodes, workflowConnections, currentPath, selectedModel, selectedProvider, availableModels, settings.defaultImageOutputDir]);
    const visibleNodeTypes = aiEnabled
        ? WORKFLOW_NODE_TYPES
        : Object.fromEntries(
            Object.entries(WORKFLOW_NODE_TYPES).filter(([type]) => !['generate', 'fill'].includes(type))
        );

    return (
        <div className="flex-1 flex overflow-hidden">
            <div className="w-56 border-r theme-border p-3 flex flex-col gap-3 overflow-y-auto theme-bg-secondary">
                <h3 className="text-sm font-semibold text-white mb-2">Add Nodes</h3>
                <div className="grid grid-cols-2 gap-2">
                    {Object.entries(visibleNodeTypes).map(([type, config]) => (
                        <button
                            key={type}
                            onClick={() => addWorkflowNode(type, 200 + Math.random() * 200, 100 + Math.random() * 200)}
                            className={`${config.color} p-2 rounded-lg text-white text-xs flex flex-col items-center gap-1 hover:opacity-90 transition-opacity`}
                        >
                            <span className="text-lg">{config.icon}</span>
                            <span>{config.name}</span>
                        </button>
                    ))}
                </div>

                <div className="border-t theme-border pt-3 mt-2">
                    <h4 className="text-xs font-semibold text-gray-400 mb-2">Workflow</h4>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={executeWorkflow}
                            disabled={workflowExecuting || workflowNodes.length === 0}
                            className="w-full py-2 px-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white text-sm flex items-center justify-center gap-2"
                        >
                            {workflowExecuting ? (
                                <>
                                    <Loader size={14} className="animate-spin" />
                                    Running...
                                </>
                            ) : (
                                <>
                                    <ChevronsRight size={14} />
                                    Execute
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => {
                                const name = window.prompt('Save workflow as:', `workflow_${new Date().toISOString().slice(0,10)}`);
                                if (!name) return;
                                setSavedWorkflows(prev => {
                                    const without = prev.filter(w => w.name !== name);
                                    return [...without, { name, nodes: workflowNodes, connections: workflowConnections }];
                                });
                            }}
                            disabled={workflowNodes.length === 0}
                            className="w-full py-2 px-3 bg-blue-600/30 hover:bg-blue-600/50 disabled:bg-gray-600/20 disabled:cursor-not-allowed rounded-lg text-blue-300 text-sm flex items-center justify-center gap-2"
                        >
                            <Save size={14} /> Save Workflow
                        </button>
                        <button
                            onClick={() => { setWorkflowNodes([]); setWorkflowConnections([]); setSelectedNodeId(null); }}
                            disabled={workflowNodes.length === 0}
                            className="w-full py-2 px-3 bg-red-600/20 hover:bg-red-600/30 disabled:bg-gray-600/20 disabled:cursor-not-allowed rounded-lg text-red-400 text-sm flex items-center justify-center gap-2"
                        >
                            <Trash2 size={14} /> Clear All
                        </button>
                    </div>
                </div>

                <div className="border-t theme-border pt-3 mt-2">
                    <h4 className="text-xs font-semibold text-gray-400 mb-2">Examples</h4>
                    <div className="flex flex-col gap-1.5">
                        {[
                            {
                                name: 'Generate → Upscale → Save',
                                load: () => {
                                    const ids = ['n_gen', 'n_up', 'n_out'];
                                    setWorkflowNodes([
                                        { id: ids[0], type: 'generate', x: 80,  y: 100, params: { prompt: 'A cinematic photograph of a mountain range at dusk' } },
                                        { id: ids[1], type: 'upscale',  x: 320, y: 100, params: { scale: 2 } },
                                        { id: ids[2], type: 'output',   x: 560, y: 100, params: { filename: 'generated.png' } },
                                    ]);
                                    setWorkflowConnections([
                                        { id: 'c1', from: ids[0], fromPort: 0, to: ids[1], toPort: 0 },
                                        { id: 'c2', from: ids[1], fromPort: 0, to: ids[2], toPort: 0 },
                                    ]);
                                }
                            },
                            {
                                name: 'Load → Adjust → Filter → Save',
                                load: () => {
                                    const ids = ['n_src', 'n_adj', 'n_flt', 'n_out'];
                                    setWorkflowNodes([
                                        { id: ids[0], type: 'source', x: 80,  y: 100, params: {} },
                                        { id: ids[1], type: 'adjust', x: 300, y: 100, params: {} },
                                        { id: ids[2], type: 'filter', x: 520, y: 100, params: { style: 'vintage' } },
                                        { id: ids[3], type: 'output', x: 740, y: 100, params: { filename: 'processed.png' } },
                                    ]);
                                    setWorkflowConnections([
                                        { id: 'c1', from: ids[0], fromPort: 0, to: ids[1], toPort: 0 },
                                        { id: 'c2', from: ids[1], fromPort: 0, to: ids[2], toPort: 0 },
                                        { id: 'c3', from: ids[2], fromPort: 0, to: ids[3], toPort: 0 },
                                    ]);
                                }
                            },
                            {
                                name: 'Load → Mask → Gen Fill → Save',
                                load: () => {
                                    const ids = ['n_src', 'n_msk', 'n_fill', 'n_out'];
                                    setWorkflowNodes([
                                        { id: ids[0], type: 'source', x: 80,  y: 100, params: {} },
                                        { id: ids[1], type: 'mask',   x: 300, y: 100, params: {} },
                                        { id: ids[2], type: 'fill',   x: 520, y: 180, params: { prompt: 'replace with a lush forest' } },
                                        { id: ids[3], type: 'output', x: 740, y: 180, params: { filename: 'inpainted.png' } },
                                    ]);
                                    setWorkflowConnections([
                                        { id: 'c1', from: ids[0], fromPort: 0, to: ids[1], toPort: 0 },
                                        { id: 'c2', from: ids[1], fromPort: 0, to: ids[2], toPort: 0 },
                                        { id: 'c3', from: ids[1], fromPort: 1, to: ids[2], toPort: 1 },
                                        { id: 'c4', from: ids[2], fromPort: 0, to: ids[3], toPort: 0 },
                                    ]);
                                }
                            },
                        ].map((ex) => (
                            <button
                                key={ex.name}
                                onClick={() => { ex.load(); setSelectedNodeId(null); }}
                                className="w-full py-1.5 px-2 bg-white/5 hover:bg-white/10 rounded text-left text-[11px] theme-text-primary"
                            >
                                {ex.name}
                            </button>
                        ))}
                    </div>
                </div>

                {savedWorkflows.length > 0 && (
                    <div className="border-t theme-border pt-3 mt-2">
                        <h4 className="text-xs font-semibold text-gray-400 mb-2">Saved</h4>
                        <div className="flex flex-col gap-1">
                            {savedWorkflows.map((w) => (
                                <div key={w.name} className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            setWorkflowNodes(w.nodes || []);
                                            setWorkflowConnections(w.connections || []);
                                            setSelectedNodeId(null);
                                        }}
                                        className="flex-1 py-1 px-2 bg-white/5 hover:bg-white/10 rounded text-left text-[11px] truncate theme-text-primary"
                                        title={w.name}
                                    >
                                        {w.name}
                                    </button>
                                    <button
                                        onClick={() => setSavedWorkflows(prev => prev.filter(x => x.name !== w.name))}
                                        className="p-1 text-gray-500 hover:text-red-400"
                                        title="Delete"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div
                ref={workflowCanvasRef}
                className="flex-1 relative overflow-auto theme-bg-primary"
                style={{
                    backgroundImage: 'radial-gradient(circle, #374151 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                }}
                onMouseMove={(e) => {
                    if (!draggingConnection) return;
                    const rect = workflowCanvasRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setDragMousePos({
                        x: e.clientX - rect.left + (workflowCanvasRef.current?.scrollLeft || 0),
                        y: e.clientY - rect.top + (workflowCanvasRef.current?.scrollTop || 0),
                    });
                }}
                onMouseUp={() => {
                    // Clicked outside an input port — cancel the drag
                    setDraggingConnection(null);
                    setDragMousePos(null);
                }}
            >
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: '2000px', minHeight: '2000px' }}>
                    {draggingConnection && dragMousePos && (() => {
                        const fromNode = workflowNodes.find(n => n.id === draggingConnection.from);
                        if (!fromNode) return null;
                        const fromX = fromNode.x + 180;
                        const fromY = fromNode.y + 30 + draggingConnection.fromPort * 20;
                        const cx1 = fromX + 50;
                        const cx2 = dragMousePos.x - 50;
                        return (
                            <path
                                d={`M ${fromX} ${fromY} C ${cx1} ${fromY}, ${cx2} ${dragMousePos.y}, ${dragMousePos.x} ${dragMousePos.y}`}
                                stroke="#60a5fa"
                                strokeWidth="2"
                                strokeDasharray="6 4"
                                fill="none"
                            />
                        );
                    })()}
                    {workflowConnections.map(conn => {
                        const fromNode = workflowNodes.find(n => n.id === conn.from);
                        const toNode = workflowNodes.find(n => n.id === conn.to);
                        if (!fromNode || !toNode) return null;

                        const fromX = fromNode.x + 180;
                        const fromY = fromNode.y + 30 + conn.fromPort * 20;
                        const toX = toNode.x;
                        const toY = toNode.y + 30 + conn.toPort * 20;

                        const cx1 = fromX + 50;
                        const cx2 = toX - 50;

                        return (
                            <path
                                key={conn.id}
                                d={`M ${fromX} ${fromY} C ${cx1} ${fromY}, ${cx2} ${toY}, ${toX} ${toY}`}
                                stroke="#60a5fa"
                                strokeWidth="2"
                                fill="none"
                                className="drop-shadow-lg"
                            />
                        );
                    })}
                </svg>

                {workflowNodes.map(node => {
                    const config = WORKFLOW_NODE_TYPES[node.type];
                    return (
                        <div
                            key={node.id}
                            className={`absolute rounded-lg shadow-xl border-2 ${selectedNodeId === node.id ? 'border-blue-400' : 'border-gray-600'} cursor-move`}
                            style={{ left: node.x, top: node.y, width: 180 }}
                            onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
                            onMouseDown={(e) => {
                                if (e.button !== 0) return;
                                const startX = e.clientX - node.x;
                                const startY = e.clientY - node.y;

                                const handleMove = (e2) => {
                                    setWorkflowNodes(prev => prev.map(n =>
                                        n.id === node.id ? { ...n, x: e2.clientX - startX, y: e2.clientY - startY } : n
                                    ));
                                };

                                const handleUp = () => {
                                    document.removeEventListener('mousemove', handleMove);
                                    document.removeEventListener('mouseup', handleUp);
                                };

                                document.addEventListener('mousemove', handleMove);
                                document.addEventListener('mouseup', handleUp);
                            }}
                        >
                            <div className={`${config.color} px-3 py-2 rounded-t-md flex items-center gap-2`}>
                                <span>{config.icon}</span>
                                <span className="text-white text-sm font-medium flex-1 truncate">{config.name}</span>
                                {node._status === 'running' && <Loader size={12} className="text-white animate-spin" />}
                                {node._status === 'done' && <Check size={12} className="text-white" />}
                                {node._status === 'error' && <span className="text-[10px] text-red-200" title={node._statusMsg}>!</span>}
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteWorkflowNode(node.id); }}
                                    className="text-white/60 hover:text-white"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            {node._statusMsg && node._status !== 'running' && (
                                <div className="text-[10px] text-gray-400 px-3 py-0.5 truncate bg-gray-900/60" title={node._statusMsg}>
                                    {node._statusMsg}
                                </div>
                            )}
                            {node._output && (
                                <div
                                    className="bg-black/60 border-y theme-border p-1 cursor-zoom-in"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const p = node._output.startsWith('media://') ? node._output : `media://${node._output}`;
                                        setWorkflowResult({ path: p, savedTo: node._output });
                                    }}
                                    title={`Click to preview\n${node._output}`}
                                >
                                    <img
                                        src={node._output.startsWith('media://') ? node._output : `media://${node._output}`}
                                        alt="node output"
                                        className="w-full h-20 object-contain bg-black"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                </div>
                            )}

                            <div className="bg-gray-800 p-2 rounded-b-md">
                                {config.inputs.map((input, i) => (
                                    <div key={input} className="flex items-center gap-2 py-1">
                                        <div
                                            className={`w-3 h-3 rounded-full border-2 border-gray-700 -ml-4 ${draggingConnection ? 'bg-green-400 cursor-crosshair' : 'bg-yellow-500'}`}
                                            onMouseUp={(e) => {
                                                e.stopPropagation();
                                                if (draggingConnection && draggingConnection.from !== node.id) {
                                                    addWorkflowConnection(draggingConnection.from, draggingConnection.fromPort, node.id, i);
                                                }
                                                setDraggingConnection(null);
                                            }}
                                        />
                                        <span className="text-xs text-gray-400">{input}</span>
                                    </div>
                                ))}

                                {node.type === 'generate' && (() => {
                                    const effectiveModel = node.params.model || selectedModel;
                                    const effectiveProvider = node.params.provider || selectedProvider;
                                    const willFallback = effectiveProvider === 'diffusers';
                                    return (
                                        <>
                                            <input
                                                type="text"
                                                placeholder="Prompt..."
                                                value={node.params.prompt || ''}
                                                onChange={(e) => updateWorkflowNode(node.id, { prompt: e.target.value })}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full text-xs theme-input mt-1 px-2 py-1"
                                            />
                                            <div
                                                className={`mt-1 text-[10px] px-2 py-0.5 rounded truncate ${willFallback ? 'bg-yellow-900/60 text-yellow-300' : 'bg-purple-900/40 text-purple-200'}`}
                                                title={willFallback ? 'diffusers is broken locally — will fall back to a cloud model' : `${effectiveProvider}/${effectiveModel}`}
                                            >
                                                {willFallback ? '⚠ ' : ''}{effectiveProvider}/{(effectiveModel || '').slice(0, 24)}
                                            </div>
                                        </>
                                    );
                                })()}
                                {node.type === 'fill' && (() => {
                                    const effectiveModel = node.params.model || 'gemini-2.5-flash-image';
                                    const effectiveProvider = node.params.provider || 'gemini';
                                    return (
                                        <>
                                            <input
                                                type="text"
                                                placeholder="Fill prompt..."
                                                value={node.params.prompt || ''}
                                                onChange={(e) => updateWorkflowNode(node.id, { prompt: e.target.value })}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full text-xs theme-input mt-1 px-2 py-1"
                                            />
                                            <div
                                                className="mt-1 text-[10px] px-2 py-0.5 rounded truncate bg-indigo-900/40 text-indigo-200"
                                                title={`${effectiveProvider}/${effectiveModel}`}
                                            >
                                                {effectiveProvider}/{effectiveModel.slice(0, 24)}
                                            </div>
                                        </>
                                    );
                                })()}
                                {node.type === 'source' && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (selectedImage) {
                                                updateWorkflowNode(node.id, { imagePath: selectedImage });
                                            }
                                        }}
                                        className="w-full text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded mt-1"
                                    >
                                        {node.params.imagePath ? '✓ Image set' : 'Set from selection'}
                                    </button>
                                )}
                                {node.type === 'upscale' && (
                                    <select
                                        value={node.params.scale || 2}
                                        onChange={(e) => updateWorkflowNode(node.id, { scale: parseInt(e.target.value) })}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full text-xs theme-input mt-1 px-2 py-1"
                                    >
                                        <option value={2}>2x</option>
                                        <option value={4}>4x</option>
                                    </select>
                                )}
                                {node.type === 'output' && (
                                    <input
                                        type="text"
                                        placeholder="filename.png"
                                        value={node.params.filename || ''}
                                        onChange={(e) => updateWorkflowNode(node.id, { filename: e.target.value })}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full text-xs theme-input mt-1 px-2 py-1"
                                    />
                                )}

                                {config.outputs.map((output, i) => (
                                    <div key={output} className="flex items-center justify-end gap-2 py-1">
                                        <span className="text-xs text-gray-400">{output}</span>
                                        <div
                                            className="w-3 h-3 rounded-full bg-blue-500 border-2 border-gray-700 -mr-4 cursor-crosshair"
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                setDraggingConnection({ from: node.id, fromPort: i });
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {workflowNodes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <WorkflowIcon size={48} className="text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400 text-lg">Build Your Workflow</p>
                            <p className="text-gray-600 text-sm mt-2">Click nodes on the left to add them to the canvas</p>
                        </div>
                    </div>
                )}
                {workflowResult && (
                    <div className="absolute bottom-4 right-4 w-80 bg-black/90 border theme-border rounded-lg shadow-xl overflow-hidden z-20">
                        <div className="flex items-center justify-between px-3 py-2 border-b theme-border">
                            <span className="text-xs font-semibold text-white">Result</span>
                            <button onClick={() => setWorkflowResult(null)} className="text-gray-400 hover:text-white">
                                <X size={14} />
                            </button>
                        </div>
                        <img src={workflowResult.path} alt="workflow result" className="w-full max-h-64 object-contain bg-black" />
                        {workflowResult.savedTo && (
                            <div className="px-3 py-1.5 text-[10px] theme-text-muted truncate border-t theme-border" title={workflowResult.savedTo}>
                                saved to {workflowResult.savedTo}
                            </div>
                        )}
                        <div className="flex border-t theme-border">
                            <button
                                onClick={() => { setSelectedImage(workflowResult.path); setActiveTab('editor'); }}
                                className="flex-1 px-3 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white"
                            >
                                Open in DarkRoom
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="w-64 border-l theme-border p-3 overflow-y-auto theme-bg-secondary">
                <h3 className="text-sm font-semibold text-white mb-3">Node Properties</h3>
                {selectedNodeId ? (() => {
                    const node = workflowNodes.find(n => n.id === selectedNodeId);
                    if (!node) return <p className="text-gray-500 text-sm">Node not found</p>;
                    const config = WORKFLOW_NODE_TYPES[node.type];

                    return (
                        <div className="space-y-3">
                            <div className={`${config.color} p-2 rounded-lg flex items-center gap-2`}>
                                <span className="text-lg">{config.icon}</span>
                                <span className="text-white font-medium">{config.name}</span>
                            </div>

                            {node.type === 'generate' && (
                                <>
                                    <div>
                                        <label className="text-xs text-gray-400">Prompt</label>
                                        <textarea
                                            value={node.params.prompt || ''}
                                            onChange={(e) => updateWorkflowNode(node.id, { prompt: e.target.value })}
                                            className="w-full theme-input mt-1 text-sm"
                                            rows={3}
                                            placeholder="Describe your image..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400">Provider</label>
                                        <select
                                            value={node.params.provider || selectedProvider || ''}
                                            onChange={(e) => {
                                                const p = e.target.value;
                                                const first = availableModels.find((m: any) => m.provider === p);
                                                updateWorkflowNode(node.id, { provider: p, model: first?.value || node.params.model });
                                            }}
                                            className="w-full theme-input mt-1 text-sm"
                                        >
                                            {[...new Set(availableModels.map((m: any) => m.provider))].map((p: any) => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400">Model</label>
                                        <select
                                            value={node.params.model || selectedModel || ''}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                const found = availableModels.find((m: any) => m.value === v);
                                                updateWorkflowNode(node.id, { model: v, provider: found?.provider || node.params.provider });
                                            }}
                                            className="w-full theme-input mt-1 text-sm"
                                        >
                                            {availableModels
                                                .filter((m: any) => !node.params.provider || m.provider === node.params.provider)
                                                .map((m: any) => (
                                                    <option key={m.value} value={m.value}>{m.display_name || m.value}</option>
                                                ))}
                                        </select>
                                    </div>
                                </>
                            )}
                            {node.type === 'fill' && (
                                <>
                                    <div>
                                        <label className="text-xs text-gray-400">Prompt</label>
                                        <textarea
                                            value={node.params.prompt || ''}
                                            onChange={(e) => updateWorkflowNode(node.id, { prompt: e.target.value })}
                                            className="w-full theme-input mt-1 text-sm"
                                            rows={3}
                                            placeholder="What to fill in the masked area..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400">Provider</label>
                                        <select
                                            value={node.params.provider || 'gemini'}
                                            onChange={(e) => {
                                                const p = e.target.value;
                                                const first = availableModels.find((m: any) => m.provider === p);
                                                updateWorkflowNode(node.id, { provider: p, model: first?.value || node.params.model });
                                            }}
                                            className="w-full theme-input mt-1 text-sm"
                                        >
                                            {[...new Set(availableModels.filter((m: any) => m.provider !== 'diffusers').map((m: any) => m.provider))].map((p: any) => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400">Model</label>
                                        <select
                                            value={node.params.model || 'gemini-2.5-flash-image'}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                const found = availableModels.find((m: any) => m.value === v);
                                                updateWorkflowNode(node.id, { model: v, provider: found?.provider || node.params.provider });
                                            }}
                                            className="w-full theme-input mt-1 text-sm"
                                        >
                                            {availableModels
                                                .filter((m: any) => m.provider !== 'diffusers' && (!node.params.provider || m.provider === node.params.provider))
                                                .map((m: any) => (
                                                    <option key={m.value} value={m.value}>{m.display_name || m.value}</option>
                                                ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            {node.type === 'adjust' && (
                                <>
                                    <div>
                                        <label className="text-xs text-gray-400">Brightness</label>
                                        <input
                                            type="range"
                                            min={-100}
                                            max={100}
                                            value={node.params.brightness || 0}
                                            onChange={(e) => updateWorkflowNode(node.id, { brightness: parseInt(e.target.value) })}
                                            className="w-full mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400">Contrast</label>
                                        <input
                                            type="range"
                                            min={-100}
                                            max={100}
                                            value={node.params.contrast || 0}
                                            onChange={(e) => updateWorkflowNode(node.id, { contrast: parseInt(e.target.value) })}
                                            className="w-full mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400">Saturation</label>
                                        <input
                                            type="range"
                                            min={-100}
                                            max={100}
                                            value={node.params.saturation || 0}
                                            onChange={(e) => updateWorkflowNode(node.id, { saturation: parseInt(e.target.value) })}
                                            className="w-full mt-1"
                                        />
                                    </div>
                                </>
                            )}

                            {node.type === 'upscale' && (
                                <div>
                                    <label className="text-xs text-gray-400">Scale Factor</label>
                                    <select
                                        value={node.params.scale || 2}
                                        onChange={(e) => updateWorkflowNode(node.id, { scale: parseInt(e.target.value) })}
                                        className="w-full theme-input mt-1 text-sm"
                                    >
                                        <option value={2}>2x (Double)</option>
                                        <option value={4}>4x (Quadruple)</option>
                                    </select>
                                </div>
                            )}

                            {node.type === 'source' && (
                                <div>
                                    <label className="text-xs text-gray-400">Source Image</label>
                                    <p className="text-sm text-gray-300 mt-1 truncate">
                                        {node.params.imagePath ? getFileName(node.params.imagePath) : 'Not set'}
                                    </p>
                                    <button
                                        onClick={() => {
                                            if (selectedImage) {
                                                updateWorkflowNode(node.id, { imagePath: selectedImage });
                                            }
                                        }}
                                        className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white"
                                    >
                                        Use Selected Image
                                    </button>
                                </div>
                            )}

                            {node.type === 'output' && (
                                <div>
                                    <label className="text-xs text-gray-400">Output Filename</label>
                                    <input
                                        type="text"
                                        value={node.params.filename || ''}
                                        onChange={(e) => updateWorkflowNode(node.id, { filename: e.target.value })}
                                        className="w-full theme-input mt-1 text-sm"
                                        placeholder="output.png"
                                    />
                                </div>
                            )}

                            <button
                                onClick={() => deleteWorkflowNode(node.id)}
                                className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 rounded text-red-400 text-sm flex items-center justify-center gap-2 mt-4"
                            >
                                <Trash2 size={14} />
                                Delete Node
                            </button>
                        </div>
                    );
                })() : (
                    <p className="text-gray-500 text-sm">Select a node to edit its properties</p>
                )}
            </div>
        </div>
    );
};

export default Workflow;
