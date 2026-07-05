import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    X, Loader, Image as ImageIcon, Folder,
    Camera, Wand2, Sliders, Grid, Upload, Trash2, Edit,
    MessageSquare, Check, List, LayoutGrid, Save, Undo,
    Redo, Search, Sparkles, Info, Tag, Crop, RotateCw, Type, ChevronLeft, ChevronRight,
    Download, PlusCircle, Copy, ExternalLink, ChevronsRight, GitBranch,
    Layers, Eye, EyeOff, GripVertical, FileJson, FolderOpen,
    Lasso, Star, Workflow, Video, Film, Scissors, Play, Pause, SkipBack, SkipForward,
    Volume2, VolumeX, Square, Circle, Music, Mic, Move, AlignLeft, AlignCenter, AlignRight,
    Bold, Italic, Underline, Database, HardDrive, Package,
    RectangleHorizontal, Brush, Eraser, Blend, Plus, ZoomIn, ZoomOut, Rewind, FastForward,
  } from 'lucide-react';

import {
    ImageGrid,
    Lightbox,
    StarRating,
    RangeSlider,
    SortableList,
    ImageEditor
} from 'npcts';

interface VideoEditorProps {
    videoClips: any[];
    setVideoClips: (v: any[] | ((prev: any[]) => any[])) => void;
    selectedImage: string | null;
    setSelectedImage: (v: string | null) => void;
    currentPath: string;
    setError: (v: string | null) => void;
    setActiveTab: (tab: string) => void;
}

const VideoEditor: React.FC<VideoEditorProps> = ({
    videoClips,
    setVideoClips,
    selectedImage,
    setSelectedImage,
    currentPath,
    setError,
    setActiveTab,
}) => {
    const [videoTracks, setVideoTracks] = useState([
        { id: 'video-1', type: 'video', clips: [] },
        { id: 'audio-1', type: 'audio', clips: [] }
    ]);
    const [videoCurrentTime, setVideoCurrentTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(60);
    const [videoPlaying, setVideoPlaying] = useState(false);
    const [videoZoom, setVideoZoom] = useState(1);
    const [selectedClipId, setSelectedClipId] = useState(null);
    const [videoTransitions, setVideoTransitions] = useState([]);
    const [selectedTransitionId, setSelectedTransitionId] = useState(null);
    const [videoTextLayers, setVideoTextLayers] = useState([]);
    const [selectedVideoTextId, setSelectedVideoTextId] = useState(null);
    const [addingVideoText, setAddingVideoText] = useState(false);
    const [videoPanelCollapsed, setVideoPanelCollapsed] = useState('');
    const videoPreviewRef = useRef(null);
    const timelineRef = useRef(null);
const splitClipAtPlayhead = useCallback(() => {
    const clipAtPlayhead = videoClips.find(c =>
        c.trackId && c.x <= videoCurrentTime && (c.x + c.duration) >= videoCurrentTime
    );
    if (clipAtPlayhead) {
        const splitPoint = videoCurrentTime - clipAtPlayhead.x;
        if (splitPoint > 0.1 && splitPoint < clipAtPlayhead.duration - 0.1) {
            const newClip = {
                ...clipAtPlayhead,
                id: `clip_${Date.now()}`,
                x: videoCurrentTime,
                duration: clipAtPlayhead.duration - splitPoint,
                trimStart: (clipAtPlayhead.trimStart || 0) + splitPoint
            };
            setVideoClips(prev => [
                ...prev.map(c => c.id === clipAtPlayhead.id ? {...c, duration: splitPoint} : c),
                newClip
            ]);
        }
    }
}, [videoClips, videoCurrentTime]);
useEffect(() => {
    const handleKeyDown = (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            const video = videoPreviewRef.current;
            if (video) {
                if (videoPlaying) video.pause();
                else video.play().catch(() => {});
            }
            setVideoPlaying(!videoPlaying);
        }
        if (e.code === 'KeyS' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            splitClipAtPlayhead();
        }
        if (e.code === 'Delete' || e.code === 'Backspace') {
            if (selectedClipId && !e.target.closest('input, textarea')) {
                setVideoClips(prev => prev.filter(c => c.id !== selectedClipId));
                setSelectedClipId(null);
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
}, [videoPlaying, videoCurrentTime, selectedClipId, splitClipAtPlayhead]);
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    const formatTimeShort = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const PIXELS_PER_SECOND = 50 * videoZoom;
    const totalTimelineWidth = Math.max(videoDuration, 120) * PIXELS_PER_SECOND + 100;

    const handleUndo = () => {};
    const handleRedo = () => {};

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-10 border-b theme-border flex items-center px-3 gap-1 bg-gray-800/80">
                <button
                    onClick={async () => {
                        try {
                            const fileData = await window.api.showOpenDialog({
                                properties: ['openFile', 'multiSelections'],
                                filters: [{ name: 'Media', extensions: ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v', 'mp3', 'wav', 'aac', 'm4a'] }]
                            });
                            if (fileData && fileData.length > 0) {
                                const newClips = fileData.map((file, i) => {
                                    const clipId = `clip_${Date.now()}_${i}`;
                                    const isAudio = !!file.name.match(/\.(mp3|wav|aac|m4a|ogg|flac)$/i);
                                    const fileSrc = `media://${file.path}`;

                                    const el = document.createElement(isAudio ? 'audio' : 'video');
                                    el.preload = 'metadata';
                                    el.src = fileSrc;
                                    el.addEventListener('loadedmetadata', () => {
                                        const realDuration = el.duration;
                                        if (realDuration && isFinite(realDuration) && realDuration > 0) {
                                            setVideoClips(prev => prev.map(c => c.id === clipId ? { ...c, duration: realDuration } : c));
                                        }
                                        el.remove();
                                    });
                                    return {
                                        id: clipId,
                                        type: isAudio ? 'audio' : 'video',
                                        src: fileSrc,
                                        name: file.name,
                                        startTime: 0,
                                        duration: 10,
                                        trackId: null,
                                        x: 0,
                                        trimStart: 0,
                                        trimEnd: 0,
                                        volume: 1,
                                        speed: 1
                                    };
                                });
                                setVideoClips(prev => [...prev, ...newClips]);
                            }
                        } catch (err) {
                            setError('Import failed: ' + (err as any).message);
                        }
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs flex items-center gap-1"
                >
                    <Upload size={12}/> Import
                </button>
                <div className="w-px h-5 bg-gray-600 mx-1"/>
                <button onClick={handleUndo} className="p-1.5 hover:bg-gray-700 rounded" title="Undo (Cmd+Z)">
                    <Undo size={14}/>
                </button>
                <button onClick={handleRedo} className="p-1.5 hover:bg-gray-700 rounded" title="Redo (Cmd+Shift+Z)">
                    <Redo size={14}/>
                </button>
                <div className="w-px h-5 bg-gray-600 mx-1"/>
                <button
                    onClick={splitClipAtPlayhead}
                    className="p-1.5 hover:bg-gray-700 rounded"
                    title="Split at Playhead (Cmd+S)"
                >
                    <Scissors size={14}/>
                </button>
                <button
                    onClick={() => {
                        if (selectedClipId) {
                            setVideoClips(prev => prev.filter(c => c.id !== selectedClipId));
                            setSelectedClipId(null);
                        }
                    }}
                    className="p-1.5 hover:bg-gray-700 rounded text-red-400"
                    title="Delete Selected (Del)"
                >
                    <Trash2 size={14}/>
                </button>
                <div className="w-px h-5 bg-gray-600 mx-1"/>
                <button
                    onClick={() => {
                        const newTextLayer = {
                            id: `text_${Date.now()}`,
                            content: 'New Text',
                            x: 50,
                            y: 50,
                            startTime: videoCurrentTime,
                            duration: 5,
                            fontSize: 48,
                            color: '#FFFFFF',
                            fontFamily: 'Arial',
                            bold: true,
                            italic: false,
                            align: 'center',
                            hasBackground: false,
                            backgroundColor: 'rgba(0,0,0,0.5)'
                        };
                        setVideoTextLayers(prev => [...prev, newTextLayer]);
                        setSelectedVideoTextId(newTextLayer.id);
                        setSelectedClipId(null);
                        setSelectedTransitionId(null);
                    }}
                    className="p-1.5 hover:bg-gray-700 rounded"
                    title="Add Text Overlay"
                >
                    <Type size={14}/>
                </button>
                <button
                    onClick={() => {

                        const videoTrackClips = videoClips.filter(c => c.trackId?.startsWith('video')).sort((a, b) => a.x - b.x);
                        if (videoTrackClips.length >= 2) {

                            for (let i = 0; i < videoTrackClips.length - 1; i++) {
                                const clip1 = videoTrackClips[i];
                                const clip2 = videoTrackClips[i + 1];
                                const hasTransition = videoTransitions.some(t => t.fromClipId === clip1.id && t.toClipId === clip2.id);
                                if (!hasTransition && Math.abs((clip1.x + clip1.duration) - clip2.x) < 0.5) {
                                    setVideoTransitions(prev => [...prev, {
                                        id: `trans_${Date.now()}`,
                                        fromClipId: clip1.id,
                                        toClipId: clip2.id,
                                        type: 'crossfade',
                                        duration: 0.5
                                    }]);
                                    break;
                                }
                            }
                        }
                    }}
                    className="p-1.5 hover:bg-gray-700 rounded"
                    title="Add Transition"
                >
                    <Blend size={14}/>
                </button>
                <div className="flex-1"/>
                <span className="text-xs text-gray-400 font-mono">{formatTime(videoCurrentTime)}</span>
                <div className="w-px h-5 bg-gray-600 mx-2"/>
                <button
                    onClick={async () => {
                        try {
                            const projectData = {
                                clips: videoClips,
                                textLayers: videoTextLayers,
                                duration: videoDuration,
                                exportedAt: new Date().toISOString()
                            };
                            const result = await window.api?.showSaveDialog?.({
                                defaultPath: 'video-project.json',
                                filters: [{ name: 'Project', extensions: ['json'] }]
                            });
                            if (result?.filePath) {
                                await window.api?.writeFileContent?.(result.filePath, JSON.stringify(projectData, null, 2));
                            }
                        } catch (e) { console.error('Export failed:', e); }
                    }}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-xs flex items-center gap-1"
                >
                    <Download size={12}/> Export
                </button>
            </div>

            <div className="flex-1 flex flex-col">
                <div className="flex-1 flex items-center justify-center p-4 bg-gray-900/50 min-h-0 max-h-[50vh]">
                    {(() => {
                        const timelineClips = videoClips.filter(c => c.trackId?.startsWith('video'));
                        const currentClip = timelineClips.find(c => c.x <= videoCurrentTime && (c.x + c.duration) > videoCurrentTime);
                        const videoSrc = currentClip?.src || (timelineClips[0]?.src || '');

                        return (
                            <div className="relative w-full max-w-full h-full">
                                <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-2xl relative max-w-full max-h-full mx-auto">
                                    {videoSrc ? (
                                        <video
                                            ref={videoPreviewRef}
                                            src={videoSrc}
                                            className="w-full h-full object-contain"
                                            onTimeUpdate={(e) => setVideoCurrentTime((e.target as HTMLVideoElement).currentTime)}
                                            onLoadedMetadata={(e) => {
                                                const video = e.target as HTMLVideoElement;
                                                if (currentClip) {
                                                    setVideoClips(prev => prev.map(c => c.id === currentClip.id ? {...c, duration: video.duration} : c));
                                                }
                                                setVideoDuration(Math.max(videoDuration, video.duration));
                                            }}
                                            onEnded={() => setVideoPlaying(false)}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <div className="text-center">
                                                <Film size={48} className="mx-auto text-gray-700 mb-2"/>
                                                <p className="text-gray-600 text-sm">Add clips to timeline</p>
                                            </div>
                                        </div>
                                    )}

                                    {videoTextLayers.filter(t =>
                                        videoCurrentTime >= t.startTime && videoCurrentTime <= (t.startTime + t.duration)
                                    ).map(text => (
                                        <div
                                            key={text.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedVideoTextId(text.id);
                                                setSelectedClipId(null);
                                                setSelectedTransitionId(null);
                                            }}
                                            className={`absolute cursor-move ${selectedVideoTextId === text.id ? 'ring-2 ring-yellow-400' : ''}`}
                                            style={{
                                                left: `${text.x}%`,
                                                top: `${text.y}%`,
                                                transform: 'translate(-50%, -50%)',
                                                fontSize: `${text.fontSize}px`,
                                                color: text.color,
                                                fontFamily: text.fontFamily,
                                                fontWeight: text.bold ? 'bold' : 'normal',
                                                fontStyle: text.italic ? 'italic' : 'normal',
                                                textAlign: text.align,
                                                textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                                                padding: text.hasBackground ? '8px 16px' : '0',
                                                background: text.hasBackground ? text.backgroundColor : 'transparent',
                                                borderRadius: text.hasBackground ? '4px' : '0',
                                                whiteSpace: 'pre-wrap',
                                                zIndex: 10
                                            }}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                const startX = e.clientX;
                                                const startY = e.clientY;
                                                const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                                                if (!rect) return;

                                                const handleMove = (moveE: MouseEvent) => {
                                                    const deltaX = ((moveE.clientX - startX) / rect.width) * 100;
                                                    const deltaY = ((moveE.clientY - startY) / rect.height) * 100;
                                                    setVideoTextLayers(prev => prev.map(t =>
                                                        t.id === text.id
                                                            ? {...t, x: Math.max(0, Math.min(100, text.x + deltaX)), y: Math.max(0, Math.min(100, text.y + deltaY))}
                                                            : t
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
                                            {text.content}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                <div className="h-20 border-t theme-border flex items-center overflow-x-auto bg-gray-800/60 px-2 gap-2">
                    {videoClips.filter(c => !c.trackId).length === 0 ? (
                        <div className="w-full text-center text-gray-500 text-xs">
                            Import media to add to the timeline
                        </div>
                    ) : (
                        videoClips.filter(c => !c.trackId).map(clip => (
                            <div
                                key={clip.id}
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData('clipId', clip.id)}
                                onClick={() => setSelectedClipId(clip.id)}
                                className={`flex-shrink-0 w-20 h-16 rounded cursor-move flex flex-col items-center justify-center gap-1 group ${
                                    selectedClipId === clip.id ? 'bg-blue-600/40 ring-1 ring-blue-500' : 'bg-gray-700/30 hover:bg-gray-700/50'
                                }`}
                            >
                                <div className={`w-7 h-7 rounded flex items-center justify-center ${clip.type === 'video' ? 'bg-blue-600/30' : 'bg-green-600/30'}`}>
                                    {clip.type === 'video' ? <Film size={12} className="text-blue-400"/> : <Music size={12} className="text-green-400"/>}
                                </div>
                                <p className="text-xs truncate w-full px-1 text-center">{clip.name}</p>
                                <p className="text-xs text-gray-500">{formatTimeShort(clip.duration || 0)}</p>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const trackId = clip.type === 'video' ? 'video-1' : 'audio-1';
                                        const lastClipOnTrack = videoClips.filter(c => c.trackId === trackId).sort((a, b) => (b.x + b.duration) - (a.x + a.duration))[0];
                                        const insertX = lastClipOnTrack ? lastClipOnTrack.x + lastClipOnTrack.duration : 0;
                                        setVideoClips(prev => prev.map(c => c.id === clip.id ? {...c, trackId, x: insertX} : c));
                                    }}
                                    className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-blue-500/50 rounded transition-opacity"
                                >
                                    <Plus size={10}/>
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="h-14 border-t theme-border flex items-center justify-center gap-3 bg-gray-800/50">
                    <button onClick={() => { if (videoPreviewRef.current) videoPreviewRef.current.currentTime = 0; setVideoCurrentTime(0); }} className="p-2 hover:bg-gray-700 rounded">
                        <SkipBack size={18}/>
                    </button>
                    <button onClick={() => { if (videoPreviewRef.current) videoPreviewRef.current.currentTime -= 5; }} className="p-2 hover:bg-gray-700 rounded">
                        <Rewind size={18}/>
                    </button>
                    <button
                        onClick={() => {
                            const video = videoPreviewRef.current;
                            if (video) {
                                if (videoPlaying) video.pause();
                                else video.play().catch(() => {});
                            }
                            setVideoPlaying(!videoPlaying);
                        }}
                        className="p-3 bg-blue-600 hover:bg-blue-700 rounded-full"
                    >
                        {videoPlaying ? <Pause size={22}/> : <Play size={22}/>}
                    </button>
                    <button onClick={() => { if (videoPreviewRef.current) videoPreviewRef.current.currentTime += 5; }} className="p-2 hover:bg-gray-700 rounded">
                        <FastForward size={18}/>
                    </button>
                    <button onClick={() => { if (videoPreviewRef.current) videoPreviewRef.current.currentTime = videoDuration; setVideoCurrentTime(videoDuration); }} className="p-2 hover:bg-gray-700 rounded">
                        <SkipForward size={18}/>
                    </button>
                    <div className="w-px h-6 bg-gray-600 mx-2"/>
                    <div className="flex items-center gap-2">
                        <Volume2 size={14} className="text-gray-400"/>
                        <input
                            type="range" min={0} max={1} step={0.05} defaultValue={1}
                            onChange={(e) => { if (videoPreviewRef.current) videoPreviewRef.current.volume = parseFloat(e.target.value); }}
                            className="w-16 h-1"
                        />
                    </div>
                </div>
            </div>

            <div className="h-56 border-t theme-border flex flex-col bg-gray-900/80">
                <div className="h-8 border-b theme-border flex items-center px-2 gap-2 bg-gray-800/50">
                    <button onClick={() => setVideoZoom(Math.max(0.25, videoZoom - 0.25))} className="p-1 hover:bg-gray-700 rounded text-xs">
                        <ZoomOut size={12}/>
                    </button>
                    <span className="text-xs text-gray-400 w-10 text-center">{Math.round(videoZoom * 100)}%</span>
                    <button onClick={() => setVideoZoom(Math.min(4, videoZoom + 0.25))} className="p-1 hover:bg-gray-700 rounded text-xs">
                        <ZoomIn size={12}/>
                    </button>
                    <div className="w-px h-4 bg-gray-600 mx-1"/>
                    <span className="text-xs text-gray-500">Total: {formatTimeShort(videoDuration)}</span>
                    <div className="flex-1"/>
                    <span className="text-xs text-gray-500">Clips: {videoClips.filter(c => c.trackId).length}</span>
                </div>

                <div className="h-6 border-b theme-border flex" style={{ marginLeft: '80px' }}>
                    <div className="relative" style={{ width: `${totalTimelineWidth - 80}px` }}>
                        {Array.from({ length: Math.ceil(Math.max(videoDuration, 120)) }).map((_, i) => (
                            <div
                                key={i}
                                className="absolute top-0 bottom-0 border-l border-gray-700 text-xs text-gray-500"
                                style={{ left: `${i * PIXELS_PER_SECOND}px` }}
                            >
                                <span className="ml-1">{formatTimeShort(i)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    <div className="relative" style={{ width: `${totalTimelineWidth}px`, minHeight: '100%' }}>
                        {videoTracks.map((track, trackIndex) => (
                            <div
                                key={track.id}
                                className={`h-14 border-b theme-border flex relative ${track.type === 'video' ? 'bg-blue-950/30' : 'bg-green-950/30'}`}
                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                onDrop={(e) => {
                                    const clipId = e.dataTransfer.getData('clipId');
                                    if (!clipId) return;
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const x = Math.max(0, (e.clientX - rect.left - 80) / PIXELS_PER_SECOND);
                                    setVideoClips(prev => prev.map(c => c.id === clipId ? {...c, trackId: track.id, x} : c));
                                }}
                            >
                                <div className="w-20 flex-shrink-0 px-2 text-xs border-r theme-border flex flex-col justify-center bg-gray-800/90 z-10">
                                    <div className="flex items-center gap-1">
                                        {track.type === 'video' ? <Film size={12} className="text-blue-400"/> : <Music size={12} className="text-green-400"/>}
                                        <span className="text-gray-300">{track.type === 'video' ? `V${trackIndex + 1}` : `A${trackIndex + 1}`}</span>
                                    </div>
                                </div>

                                <div className="flex-1 relative">
                                    {videoClips.filter(c => c.trackId === track.id).map(clip => (
                                        <div
                                            key={clip.id}
                                            draggable
                                            onDragStart={(e) => e.dataTransfer.setData('clipId', clip.id)}
                                            onClick={(e) => { e.stopPropagation(); setSelectedClipId(clip.id); }}
                                            className={`absolute top-1 bottom-1 rounded cursor-pointer group ${
                                                selectedClipId === clip.id ? 'ring-2 ring-yellow-400' : ''
                                            } ${track.type === 'video' ? 'bg-gradient-to-b from-blue-500 to-blue-700' : 'bg-gradient-to-b from-green-500 to-green-700'}`}
                                            style={{
                                                left: `${(clip.x || 0) * PIXELS_PER_SECOND}px`,
                                                width: `${Math.max((clip.duration || 1) * PIXELS_PER_SECOND, 20)}px`
                                            }}
                                        >
                                            <div
                                                className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize bg-white/0 hover:bg-white/40 rounded-l z-10 flex items-center justify-center"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    const startX = e.clientX;
                                                    const origX = clip.x || 0;
                                                    const origDuration = clip.duration || 1;
                                                    const origTrimStart = clip.trimStart || 0;

                                                    const handleMove = (moveE: MouseEvent) => {
                                                        const deltaX = moveE.clientX - startX;
                                                        const deltaTime = deltaX / PIXELS_PER_SECOND;
                                                        const newX = Math.max(0, origX + deltaTime);
                                                        const newDuration = Math.max(0.5, origDuration - deltaTime);
                                                        const newTrimStart = Math.max(0, origTrimStart + deltaTime);

                                                        setVideoClips(prev => prev.map(c =>
                                                            c.id === clip.id
                                                                ? {...c, x: newX, duration: newDuration, trimStart: newTrimStart}
                                                                : c
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
                                                <div className="w-0.5 h-6 bg-white/50 rounded-full opacity-0 group-hover:opacity-100"/>
                                            </div>
                                            <div
                                                className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize bg-white/0 hover:bg-white/40 rounded-r z-10 flex items-center justify-center"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    const startX = e.clientX;
                                                    const origDuration = clip.duration || 1;

                                                    const handleMove = (moveE: MouseEvent) => {
                                                        const deltaX = moveE.clientX - startX;
                                                        const deltaTime = deltaX / PIXELS_PER_SECOND;
                                                        const newDuration = Math.max(0.5, origDuration + deltaTime);

                                                        setVideoClips(prev => prev.map(c =>
                                                            c.id === clip.id
                                                                ? {...c, duration: newDuration}
                                                                : c
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
                                                <div className="w-0.5 h-6 bg-white/50 rounded-full opacity-0 group-hover:opacity-100"/>
                                            </div>

                                            <div className="px-2 py-1 h-full flex flex-col overflow-hidden">
                                                <span className="text-xs font-medium truncate">{clip.name}</span>
                                                {clip.duration > 2 && (
                                                    <span className="text-xs text-white/60">{formatTimeShort(clip.duration)}</span>
                                                )}
                                            </div>

                                            <div className="absolute bottom-0 left-0 right-0 h-3 flex items-end px-1 gap-px opacity-40">
                                                {Array.from({ length: Math.min(30, Math.floor((clip.duration || 1) * 3)) }).map((_, i) => (
                                                    <div key={i} className="flex-1 bg-white" style={{ height: `${20 + (Math.sin(i * 1.5 + (clip.id?.charCodeAt(0) || 0)) * 0.5 + 0.5) * 80}%` }}/>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    {videoTransitions.filter(t => {
                                        const fromClip = videoClips.find(c => c.id === t.fromClipId);
                                        return fromClip?.trackId === track.id;
                                    }).map(transition => {
                                        const fromClip = videoClips.find(c => c.id === transition.fromClipId);
                                        if (!fromClip) return null;
                                        const transitionX = (fromClip.x + fromClip.duration - transition.duration / 2) * PIXELS_PER_SECOND;
                                        return (
                                            <div
                                                key={transition.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedTransitionId(transition.id);
                                                    setSelectedClipId(null);
                                                }}
                                                className={`absolute top-1 bottom-1 flex items-center justify-center cursor-pointer ${
                                                    selectedTransitionId === transition.id ? 'ring-2 ring-yellow-400' : ''
                                                }`}
                                                style={{
                                                    left: `${transitionX}px`,
                                                    width: `${transition.duration * PIXELS_PER_SECOND}px`,
                                                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                                                    zIndex: 20
                                                }}
                                                title={`${transition.type} (${transition.duration}s)`}
                                            >
                                                <Blend size={12} className="text-white/70"/>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {videoTextLayers.length > 0 && (
                            <div className="h-10 border-b theme-border flex relative bg-orange-950/30">
                                <div className="w-20 flex-shrink-0 px-2 text-xs border-r theme-border flex items-center gap-1 bg-gray-800/90 z-10">
                                    <Type size={12} className="text-orange-400"/>
                                    <span className="text-gray-300">Text</span>
                                </div>
                                <div className="flex-1 relative">
                                    {videoTextLayers.map(text => (
                                        <div
                                            key={text.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedVideoTextId(text.id);
                                                setSelectedClipId(null);
                                                setSelectedTransitionId(null);
                                            }}
                                            className={`absolute top-1 bottom-1 rounded cursor-pointer px-2 flex items-center gap-1 ${
                                                selectedVideoTextId === text.id ? 'ring-2 ring-yellow-400' : ''
                                            } bg-gradient-to-b from-orange-500 to-orange-700`}
                                            style={{
                                                left: `${text.startTime * PIXELS_PER_SECOND}px`,
                                                width: `${Math.max(text.duration * PIXELS_PER_SECOND, 30)}px`
                                            }}
                                        >
                                            <Type size={10}/>
                                            <span className="text-xs truncate">{text.content}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => setVideoTracks(prev => [...prev, {
                                id: `track_${Date.now()}`,
                                type: prev.length % 2 === 0 ? 'video' : 'audio',
                                clips: []
                            }])}
                            className="w-full h-8 flex items-center justify-center text-xs text-gray-500 hover:bg-gray-700/30 border-b theme-border"
                        >
                            <Plus size={12} className="mr-1"/> Add Track
                        </button>

                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none"
                            style={{ left: `${80 + videoCurrentTime * PIXELS_PER_SECOND}px` }}
                        >
                            <div className="absolute -top-1 -left-2 w-4 h-3 bg-red-500" style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }}/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

const handleCanvasMouseDown = (e) => {
  if (!canvasContainerRef.current) return;
  const p = getRelativeCoords(e, canvasContainerRef.current);
  if (!p) return;

  const rect = canvasContainerRef.current.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (editorTool === 'text') {
      const newText = {
          id: `text_${Date.now()}`,
          content: 'Edit me',
          x: x,
          y: y,
          fontSize: 32,
          color: '#FFFFFF',
          fontFamily: 'Arial'
      };
      setTextLayers(prev => [...prev, newText]);
      setEditingTextId(newText.id);
      return;
  }

  if (editorTool === 'brush' || editorTool === 'eraser') {
      setIsDrawingBrush(true);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = editorTool === 'eraser' ? 'rgba(0,0,0,1)' : brushColor;
      ctx.globalCompositeOperation = editorTool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.beginPath();
      ctx.moveTo(x, y);
      return;
  }

  if (editorTool === 'select' && selection) {
      const xPercent = (x / rect.width) * 100;
      const yPercent = (y / rect.height) * 100;

      if (selection.type === 'rect') {
          const inSelection =
              xPercent >= Math.min(selection.x1, selection.x2) &&
              xPercent <= Math.max(selection.x1, selection.x2) &&
              yPercent >= Math.min(selection.y1, selection.y2) &&
              yPercent <= Math.max(selection.y1, selection.y2);

          if (inSelection) {
              setIsDraggingSelection(true);
              setSelectionDragStart({ x: xPercent, y: yPercent });
              return;
          }
      }
  }

  setDrawingSelection(true);

  if (selectionMode === 'rect') {
      const xPercent = (x / rect.width) * 100;
      const yPercent = (y / rect.height) * 100;
      setSelection({ type: 'rect', x1: xPercent, y1: yPercent, x2: xPercent, y2: yPercent });
  } else if (selectionMode === 'lasso') {
      const xPercent = (x / rect.width) * 100;
      const yPercent = (y / rect.height) * 100;
      setSelectionPoints([{ x: xPercent, y: yPercent }]);
  }
};

  const handleCanvasMouseMove = (e) => {
    if (!canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDrawingBrush && (editorTool === 'brush' || editorTool === 'eraser')) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.globalCompositeOperation = editorTool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = editorTool === 'eraser' ? 'rgba(0,0,0,1)' : brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineTo(x, y);
        ctx.stroke();
        return;
    }

    if (isDraggingSelection && selection && editorTool === 'select') {
        const xPercent = (x / rect.width) * 100;
        const yPercent = (y / rect.height) * 100;

        const dx = xPercent - selectionDragStart.x;
        const dy = yPercent - selectionDragStart.y;

        setSelection(prev => ({
            ...prev,
            x1: prev.x1 + dx,
            x2: prev.x2 + dx,
            y1: prev.y1 + dy,
            y2: prev.y2 + dy
        }));

        setSelectionDragStart({ x: xPercent, y: yPercent });
        return;
    }

    if (!drawingSelection) return;

    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;

    if (selectionMode === 'rect' && selection) {
        setSelection(prev => ({ ...prev, x2: xPercent, y2: yPercent }));
    } else if (selectionMode === 'lasso') {
        setSelectionPoints(prev => [...prev, { x: xPercent, y: yPercent }]);
    }
};

const handleCanvasMouseUp = () => {
    console.log('Mouse up - selectionMode:', selectionMode);
    console.log('selectionPoints length:', selectionPoints.length);
    console.log('selectionPoints:', selectionPoints);

    setDrawingSelection(false);
    if (isDrawingBrush) {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.globalCompositeOperation = 'source-over';
        }
    }
    setIsDrawingBrush(false);
    setIsDraggingSelection(false);

    if (selectionMode === 'lasso' && selectionPoints.length > 2) {
        console.log('Creating lasso selection!');
        setSelection({ type: 'lasso', points: selectionPoints });
    }
};
const executeGenerativeFill = async (sel, prompt, opts?: { model?: string; provider?: string }) => {
    // The ImageEditor (npcts) component passes its own selection object here
    // as the first arg — honor that instead of the legacy PhotoViewer-level
    // `selection` state which is only populated by the old darkroom path.
    const activeSelection = sel || selection;
    console.log('executeGenerativeFill called with prompt:', prompt);
    console.log('selectedImage:', selectedImage);
    console.log('selection:', activeSelection);

    if (!selectedImage || !activeSelection) {
        setError('Need image and selection for generative fill');
        return;
    }

    try {
        const maskData = await createMaskFromSelection(activeSelection);
        console.log('Mask data created:', maskData ? 'yes' : 'no');

        const imagePath = selectedImage.replace('media://', '');
        console.log('Image path:', imagePath);

        // Prefer a cloud inpaint model. The local `diffusers` path relies on the
        // StableDiffusionInpaintPipeline which breaks when the system's diffusers/
        // peft/transformers versions disagree (HybridCache import error), so
        // even if the user has a diffusers model selected for general image
        // generation, route generative fill to Gemini / OpenAI by default.
        // Prefer the explicit model/provider the user picked in the fill UI;
        // fall back to the currently-selected generation model, then to a
        // sane cloud default.
        const model = opts?.model || selectedModel || 'gemini-2.5-flash-image';
        const provider = opts?.provider || selectedProvider || 'gemini';
        console.log('Using model:', model, 'provider:', provider);

        const response = await window.api.generativeFill({
            imagePath,
            mask: maskData,
            prompt: prompt,
            model: model,
            provider: provider
        });

        console.log('Response from generativeFill:', response);

        if (response.error) throw new Error(response.error);

        if (response.resultPath) {
            setSelectedImage(`media://${response.resultPath}`);
            await loadImagesForAllSources(imageSources);
        }

        setSelection(null);

    } catch (error) {
        console.error('Fill error:', error);
        setError('Generative fill failed: ' + error.message);
    }
};

const loadImageDims = (src: string): Promise<{ w: number; h: number }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = reject;
        img.src = src;
    });
};

const createMaskFromSelection = async (sel) => {
    // Always derive dimensions from the currently-selected image file rather
    // than PhotoViewer's legacy imageRef (which is null when the npcts
    // ImageEditor is the renderer).
    let dims: { w: number; h: number } | null = null;
    const legacyImg = imageRef.current;
    if (legacyImg && legacyImg.naturalWidth > 0) {
        dims = { w: legacyImg.naturalWidth, h: legacyImg.naturalHeight };
    } else if (selectedImage) {
        try { dims = await loadImageDims(selectedImage); } catch { dims = null; }
    }
    if (!dims) return null;

    const canvas = document.createElement('canvas');
    canvas.width = dims.w;
    canvas.height = dims.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';

    if (sel.type === 'rect') {
        const x = Math.min(sel.x1, sel.x2) / 100 * canvas.width;
        const y = Math.min(sel.y1, sel.y2) / 100 * canvas.height;
        const w = Math.abs(sel.x2 - sel.x1) / 100 * canvas.width;
        const h = Math.abs(sel.y2 - sel.y1) / 100 * canvas.height;
        ctx.fillRect(x, y, w, h);
    } else if (sel.type === 'lasso') {
        ctx.beginPath();
        sel.points.forEach((p, i) => {
            const x = (p.x / 100) * canvas.width;
            const y = (p.y / 100) * canvas.height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
    }

    return canvas.toDataURL('image/png');
};
    const handleOpenPhotoFromDisk = async () => {
        try {
            const result = await window.api?.showOpenDialog?.({
                properties: ['openFile'],
                filters: [
                    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });
            const picked = Array.isArray(result)
                ? (result[0]?.path || result[0])
                : (result?.filePaths?.[0] || result?.filePath || result?.[0]);
            if (picked) {
                setSelectedImage(picked.startsWith('media://') || picked.startsWith('file://') ? picked : `media://${picked}`);
            }
        } catch (e) { console.error('Open photo failed:', e); }
    };
};

export default VideoEditor;
