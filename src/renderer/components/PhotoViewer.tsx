import { getFileName, generateId } from './utils';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSettings } from './SettingsContext';
import ImageGenerator from './ImageGenerator';
import VideoGenerator from './VideoGenerator';
import SettingsPanel from './SettingsPanel';
import Gallery from './Gallery';
import VideoEditor from './VideoEditor';
import DarkRoom from './DarkRoom';
import {
    X, Loader, Image as ImageIcon, Folder,
    Camera, Wand2, Sliders, Grid, Upload, Trash2, Edit,
    MessageSquare, Check, List, LayoutGrid, Save, Undo,
    Redo, Search, Sparkles, Info, Tag, Crop, RotateCw, Type, ChevronLeft, ChevronRight,
    Download, PlusCircle, Copy, ExternalLink, ChevronsRight, GitBranch,
    Layers, Eye, EyeOff, GripVertical, FileJson, FolderOpen,
    Lasso, Star, Video, Film, Scissors, Play, Pause, SkipBack, SkipForward,
    Volume2, VolumeX, Square, Circle, Music, Mic, Move, AlignLeft, AlignCenter, AlignRight,
    Bold, Italic, Underline, Database, HardDrive, Package,
    RectangleHorizontal, Brush, Eraser, Blend, Plus, ZoomIn, ZoomOut, Rewind, FastForward,
  } from 'lucide-react';

import {
    ImageGrid,
    Lightbox
} from 'npcts';

const IMAGES_PER_PAGE = 24;

const PhotoViewer = ({ currentPath }: { currentPath: string }) => {
    const { settings, aiEnabled, updateSettings, addTrackedFolder, removeTrackedFolder, updateTrackedFolder } = useSettings();
    const [activeTab, _setActiveTab] = useState(() => localStorage.getItem('vixynt_activeTab') || 'gallery');
    const setActiveTab = useCallback((tab: string) => {
        _setActiveTab(tab);
        localStorage.setItem('vixynt_activeTab', tab);
    }, []);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    console.log(currentPath);
    const [projectPath, setProjectPath] = useState(currentPath || '');
    const [isEditingPath, setIsEditingPath] = useState(false);
    const [imageSources, setImageSources] = useState([]);
    const [activeSourceId, setActiveSourceId] = useState('');

    const [selectedModel, setSelectedModel] = useState('');
    const [selectedProvider, setSelectedProvider] = useState('');
    const [availableModels, setAvailableModels] = useState([]);

    const [selectedImage, setSelectedImage] = useState(null);
    const [selectedImageGroup, setSelectedImageGroup] = useState(new Set());
    const [lastClickedIndex, setLastClickedIndex] = useState(null);
    const [displayedImagesCount, setDisplayedImagesCount] = useState(IMAGES_PER_PAGE);
    const [lightboxIndex, setLightboxIndex] = useState(null);
    const [viewMode, setViewMode] = useState('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [metaSearch, setMetaSearch] = useState('');

    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, imagePath: null });
    const [renamingImage, setRenamingImage] = useState({ path: null, newName: '' });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem('vixynt_sidebarCollapsed');
        return saved === 'true';
    });



    const [videoPrompt, setVideoPrompt] = useState('');
    const [generatingVideo, setGeneratingVideo] = useState(false);
    const [generatedVideos, setGeneratedVideos] = useState([]);
    const [videoClips, setVideoClips] = useState([]);
    const [videoModel, setVideoModel] = useState('');
    const [videoDurationSetting, setVideoDurationSetting] = useState(5);

    const [videoDatasets, setVideoDatasets] = useState(() => {
        try {
            const stored = localStorage.getItem('vixynt_videoDatasets');
            return stored ? JSON.parse(stored) : [];
        } catch { return []; }
    });
    const [selectedVideoDatasetId, setSelectedVideoDatasetId] = useState(null);
    const [showCreateVideoDataset, setShowCreateVideoDataset] = useState(false);
    const [showAddToVideoDataset, setShowAddToVideoDataset] = useState(false);
    const [newVideoDatasetName, setNewVideoDatasetName] = useState('');
    const [selectedGeneratedVideos, setSelectedGeneratedVideos] = useState(new Set());
    const [videoSelectionMode, setVideoSelectionMode] = useState(false);
    const [videoDatasetExportFormat, setVideoDatasetExportFormat] = useState('jsonl');

    useEffect(() => {
        localStorage.setItem('vixynt_videoDatasets', JSON.stringify(videoDatasets));
    }, [videoDatasets]);



    const activeSource = imageSources.find(s => s.id === activeSourceId);
    const sourceImages = (activeSource?.images || []);
    const filteredImages = sourceImages.filter(img => img.path.toLowerCase().includes(searchTerm.toLowerCase()));

    const [numImagesToGenerate, setNumImagesToGenerate] = useState(1);
    const [outputWidth, setOutputWidth] = useState(1024);
    const [outputHeight, setOutputHeight] = useState(1024);
    const [selectedGeneratedImages, setSelectedGeneratedImages] = useState(new Set());


    const [generatePrompt, setGeneratePrompt] = useState('');
    const [generatedImages, setGeneratedImages] = useState([]);

    // Width debugging refs
    const rootRef = useRef<HTMLDivElement | null>(null);
    const rowRef = useRef<HTMLDivElement | null>(null);
    const sidebarRef = useRef<HTMLDivElement | null>(null);
    const mainRef = useRef<HTMLElement | null>(null);
    const generatorRef = useRef<HTMLDivElement | null>(null);
    const generatorRightRef = useRef<HTMLDivElement | null>(null);
    const videoGeneratorRef = useRef<HTMLDivElement | null>(null);
    const videoGeneratorRightRef = useRef<HTMLDivElement | null>(null);
    const darkroomRef = useRef<HTMLDivElement | null>(null);
    const imageEditorWrapperRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        requestAnimationFrame(() => {
            const rootW = rootRef.current?.getBoundingClientRect().width;
            const rowW = rowRef.current?.getBoundingClientRect().width;
            const parentW = rootRef.current?.parentElement?.getBoundingClientRect().width;
            const htmlClientWidth = document.documentElement.clientWidth;
            const bodyClientWidth = document.body.clientWidth;
            const rootElW = document.getElementById('root')?.getBoundingClientRect().width;
            const sidebarW = sidebarRef.current?.getBoundingClientRect().width;
            const mainW = mainRef.current?.getBoundingClientRect().width;
            const genW = generatorRef.current?.getBoundingClientRect().width;
            const genRightW = generatorRightRef.current?.getBoundingClientRect().width;
            const vidW = videoGeneratorRef.current?.getBoundingClientRect().width;
            const vidRightW = videoGeneratorRightRef.current?.getBoundingClientRect().width;
            const darkW = darkroomRef.current?.getBoundingClientRect().width;
            const editorW = imageEditorWrapperRef.current?.getBoundingClientRect().width;
            console.log('[VIXYNT WIDTHS]', {
                activeTab,
                root: rootW,
                row: rowW,
                parent: parentW,
                htmlClientWidth,
                bodyClientWidth,
                rootElement: rootElW,
                sidebar: sidebarW,
                main: mainW,
                generator: genW,
                generatorRight: genRightW,
                videoGenerator: vidW,
                videoGeneratorRight: vidRightW,
                darkroom: darkW,
                imageEditorWrapper: editorW,
                windowInnerWidth: window.innerWidth,
            });
        });
    }, [activeTab, generatedImages.length, generatedVideos.length, selectedImage]);

    const [generating, setGenerating] = useState(false);


  const [fineTuneConfig, setFineTuneConfig] = useState({
    outputName: 'my_diffusion_model',
    epochs: 100,
    batchSize: 4,
    learningRate: 1e-4,
    captions: []
});

const [captionMode, setCaptionMode] = useState('auto');
const [manualCaptions, setManualCaptions] = useState({});
const [showFineTuneModal, setShowFineTuneModal] = useState(false);
const [isFineTuning, setIsFineTuning] = useState(false);
const [fineTuneStatus, setFineTuneStatus] = useState<{
    status: string;
    epoch?: number;
    total_epochs?: number;
    batch?: number;
    total_batches?: number;
    step?: number;
    loss?: number;
    loss_history?: number[];
    outputPath?: string;
    message?: string;
} | null>(null);

const pollFineTuneStatus = async (jobId: string) => {
    const interval = setInterval(async () => {
        const status = await window.api?.getFineTuneStatus?.(jobId);
        if (status?.status === 'complete' || status?.complete) {
            clearInterval(interval);
            setFineTuneStatus({
                status: 'complete',
                outputPath: status.outputPath,
                loss_history: status.loss_history || [],
                message: `Complete! Model saved to ${status.outputPath}`
            });
            setIsFineTuning(false);
            await loadImagesForAllSources(imageSources);
        } else if (status?.status === 'error' || status?.error) {
            clearInterval(interval);
            setFineTuneStatus(null);
            setIsFineTuning(false);
            setError('Training failed: ' + (status.error || 'Unknown error'));
        } else if (status?.status === 'running') {
            setFineTuneStatus({
                status: 'running',
                epoch: status.epoch || 0,
                total_epochs: status.total_epochs || 0,
                batch: status.batch || 0,
                total_batches: status.total_batches || 0,
                step: status.step || 0,
                loss: status.loss,
                loss_history: status.loss_history || []
            });
        }
    }, 1000);
};

const handleStartFineTune = async () => {
    if (selectedImageGroup.size === 0) {
        setError('Select images first');
        return;
    }

    setIsFineTuning(true);
    setFineTuneStatus({ status: 'preparing', message: 'Preparing training...' });

    const imagePaths = Array.from(selectedImageGroup).map(
        p => p.replace('media://', '')
    );

    let captions = [];
    if (captionMode === 'manual') {
        captions = imagePaths.map(p => manualCaptions[p] || '');
    } else if (captionMode === 'filename') {
        captions = imagePaths.map(p => {
            const name = getFileName(p).replace(/\.[^/.]+$/, '');
            return name.replace(/_/g, ' ').replace(/-/g, ' ');
        });
    }

    const modelsOutputPath = `${currentPath}/models`;

    const finalOutputPath = settings.defaultModelOutputDir || `${currentPath}/models`;

    const config = {
        images: imagePaths,
        captions: captions,
        outputName: fineTuneConfig.outputName,
        epochs: fineTuneConfig.epochs,
        batchSize: fineTuneConfig.batchSize,
        learningRate: fineTuneConfig.learningRate,
        outputPath: finalOutputPath,
        workspacePath: currentPath,
    };

    const response = await window.api?.fineTuneDiffusers?.(config);

    if (response?.error) {
        setError('Fine-tuning failed: ' + response.error);
        setFineTuneStatus(null);
        setIsFineTuning(false);
    } else if (response?.job_id) {
        setFineTuneStatus({ status: 'running', message: 'Training started...' });
        pollFineTuneStatus(response.job_id);
    }
};

const renderFineTuneModal = () => {
    if (!showFineTuneModal) return null;

    const selectedImages = Array.from(selectedImageGroup);

    return (
        <div className="fixed inset-0 bg-black/70 z-[90] flex items-center
            justify-center p-8">
            <div className="theme-bg-secondary rounded-lg p-6 w-full max-w-2xl
                space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">
                        Fine-tune Diffusion Model
                    </h3>
                    <button onClick={() => setShowFineTuneModal(false)}>
                        <X size={20} />
                    </button>
                </div>

                <div className="text-sm theme-text-secondary">
                    Training on {selectedImages.length} images
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-sm font-medium">
                            Output Model Name
                        </label>
                        <input
                            type="text"
                            value={fineTuneConfig.outputName}
                            onChange={e => setFineTuneConfig(
                                p => ({ ...p, outputName: e.target.value })
                            )}
                            className="w-full theme-input mt-1 text-sm"
                            placeholder="my_diffusion_model"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="text-xs font-medium">Epochs</label>
                            <input
                                type="number"
                                value={fineTuneConfig.epochs}
                                onChange={e => setFineTuneConfig(
                                    p => ({ ...p, epochs: parseInt(e.target.value) })
                                )}
                                className="w-full theme-input mt-1 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium">
                                Batch Size
                            </label>
                            <input
                                type="number"
                                value={fineTuneConfig.batchSize}
                                onChange={e => setFineTuneConfig(
                                    p => ({ ...p, batchSize: parseInt(e.target.value) })
                                )}
                                className="w-full theme-input mt-1 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium">
                                Learning Rate
                            </label>
                            <input
                                type="number"
                                step="0.0001"
                                value={fineTuneConfig.learningRate}
                                onChange={e => setFineTuneConfig(
                                    p => ({
                                        ...p,
                                        learningRate: parseFloat(e.target.value)
                                    })
                                )}
                                className="w-full theme-input mt-1 text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium">
                            Caption Mode
                        </label>
                        <div className="grid grid-cols-3 gap-2 mt-1">
                            <button
                                onClick={() => setCaptionMode('auto')}
                                className={`p-2 text-xs rounded border
                                    ${captionMode === 'auto'
                                        ? 'theme-button-primary'
                                        : 'theme-button'}`}
                            >
                                No Captions
                            </button>
                            <button
                                onClick={() => setCaptionMode('filename')}
                                className={`p-2 text-xs rounded border
                                    ${captionMode === 'filename'
                                        ? 'theme-button-primary'
                                        : 'theme-button'}`}
                            >
                                From Filename
                            </button>
                            <button
                                onClick={() => setCaptionMode('manual')}
                                className={`p-2 text-xs rounded border
                                    ${captionMode === 'manual'
                                        ? 'theme-button-primary'
                                        : 'theme-button'}`}
                            >
                                Manual
                            </button>
                        </div>
                    </div>

                    {captionMode === 'manual' && (
                        <div className="space-y-2 max-h-48 overflow-y-auto
                            border theme-border rounded p-2">
                            {selectedImages.map(img => {
                                const path = img.replace('media://', '');
                                const name = getFileName(path);
                                return (
                                    <div key={img} className="flex gap-2
                                        items-center">
                                        <img
                                            src={img}
                                            className="w-10 h-10 object-cover
                                                rounded"
                                        />
                                        <input
                                            type="text"
                                            value={manualCaptions[path] || ''}
                                            onChange={e => setManualCaptions(
                                                p => ({
                                                    ...p,
                                                    [path]: e.target.value
                                                })
                                            )}
                                            placeholder={name}
                                            className="flex-1 theme-input text-xs"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {fineTuneStatus && (
                    <div className="bg-blue-900/30 p-4 rounded text-sm space-y-3">
                        {fineTuneStatus.status === 'running' ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <Loader size={14} className="animate-spin" />
                                    <span className="font-medium">Training in progress...</span>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span>Epoch {fineTuneStatus.epoch}/{fineTuneStatus.total_epochs}</span>
                                        <span>{fineTuneStatus.total_epochs ? Math.round((fineTuneStatus.epoch! / fineTuneStatus.total_epochs) * 100) : 0}%</span>
                                    </div>
                                    <div className="w-full theme-bg-tertiary rounded-full h-2">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${fineTuneStatus.total_epochs ? (fineTuneStatus.epoch! / fineTuneStatus.total_epochs) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>

                                {fineTuneStatus.total_batches > 0 && (
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs theme-text-secondary">
                                            <span>Batch {fineTuneStatus.batch}/{fineTuneStatus.total_batches}</span>
                                            <span>{Math.round((fineTuneStatus.batch! / fineTuneStatus.total_batches) * 100)}%</span>
                                        </div>
                                        <div className="w-full theme-bg-tertiary rounded-full h-1.5">
                                            <div
                                                className="bg-blue-400 h-1.5 rounded-full transition-all duration-150"
                                                style={{ width: `${(fineTuneStatus.batch! / fineTuneStatus.total_batches) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {fineTuneStatus.loss != null && (
                                    <div className="flex items-center gap-4 text-xs">
                                        <span className="theme-text-secondary">Current Loss:</span>
                                        <span className="font-mono text-yellow-400">{fineTuneStatus.loss.toFixed(4)}</span>
                                        <span className="theme-text-secondary">Step:</span>
                                        <span className="font-mono">{fineTuneStatus.step}</span>
                                    </div>
                                )}

                                {fineTuneStatus.loss_history && fineTuneStatus.loss_history.length > 1 && (
                                    <div className="mt-2">
                                        <div className="text-xs theme-text-secondary mb-1">Loss History (per epoch avg)</div>
                                        <div className="flex items-end gap-0.5 h-12 theme-bg-secondary rounded p-1">
                                            {fineTuneStatus.loss_history.slice(-20).map((loss, i) => {
                                                const maxLoss = Math.max(...fineTuneStatus.loss_history!.slice(-20));
                                                const minLoss = Math.min(...fineTuneStatus.loss_history!.slice(-20));
                                                const range = maxLoss - minLoss || 1;
                                                const height = ((loss - minLoss) / range) * 100;
                                                return (
                                                    <div
                                                        key={i}
                                                        className="flex-1 bg-gradient-to-t from-green-600 to-green-400 rounded-t"
                                                        style={{ height: `${Math.max(5, 100 - height)}%` }}
                                                        title={`Epoch ${fineTuneStatus.loss_history!.length - 20 + i + 1}: ${loss.toFixed(4)}`}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : fineTuneStatus.status === 'complete' ? (
                            <div className="flex items-center gap-2 text-green-400">
                                <Check size={16} />
                                <span>{fineTuneStatus.message}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Loader size={14} className="animate-spin" />
                                <span>{fineTuneStatus.message || 'Processing...'}</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => setShowFineTuneModal(false)}
                        className="theme-button px-4 py-2"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleStartFineTune}
                        disabled={isFineTuning || selectedImages.length === 0}
                        className="theme-button-primary px-4 py-2
                            disabled:opacity-50"
                    >
                        {isFineTuning ? 'Training...' : 'Start Training'}
                    </button>
                </div>
            </div>
        </div>
    );
};

    const imgContainerRef = useRef(null);


  const loadImagesForAllSources = useCallback(async (sourcesToLoad) => {
    setLoading(true); setError(null);
    try {
      const updatedSources = await Promise.all(
        sourcesToLoad.map(async (source) => {
          try {
            await window.api?.ensureDir?.(source.path);
            const result = await window.api?.readDirectoryImages?.(source.path) || [];
            // Handle both old (string[]) and new ({ images, deeperFolders }) formats
            const images = Array.isArray(result) ? result : (result.images || []).map((img: any) => typeof img === 'string' ? img : img.url);
            const deeperFolders = Array.isArray(result) ? [] : (result.deeperFolders || []);
            return { ...source, images, deeperFolders };
          } catch (err) {
            console.error('Source load failed:', source, err);
            return { ...source, images: [], deeperFolders: [] };
          }
        })
      );
      setImageSources(updatedSources);
    } catch (err) {
      setError('Failed to load image sources: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);
    useEffect(() => {
        const loadAllData = async () => {
            const initialSources = settings.trackedFolders.map(f => ({
                id: f.id,
                name: f.name,
                path: f.path,
                icon: Folder,
            }));

            setLoading(true);
            setError(null);
            try {
                const updatedSources = await Promise.all(
                    initialSources.map(async (source) => {
                        try {
                            await window.api?.ensureDir?.(source.path);
                            const result = await window.api?.readDirectoryImages?.(source.path) || [];
                            const images = Array.isArray(result) ? result : (result.images || []).map((img: any) => typeof img === 'string' ? img : img.url);
                            const deeperFolders = Array.isArray(result) ? [] : (result.deeperFolders || []);
                            return { ...source, images, deeperFolders };
                        } catch (err) {
                            console.error('Source load failed:', source, err);
                            return { ...source, images: [], deeperFolders: [] };
                        }
                    })
                );
                setImageSources(updatedSources);

                if (updatedSources.length > 0 && !activeSourceId) {
                    const firstWithImages = updatedSources.find(s => s.images?.length > 0);
                    setActiveSourceId(firstWithImages?.id || updatedSources[0].id);
                }
            } catch (err) {
                setError('Failed to load image sources: ' + err.message);
            } finally {
                setLoading(false);
            }

            if (aiEnabled) {
              try {
                const imageModelsResponse = await window.api.getAvailableImageModels(currentPath || '~');
                if (imageModelsResponse?.models && imageModelsResponse.models.length > 0) {
                  setAvailableModels(imageModelsResponse.models);

                  const fineTunedDiffusersModel = imageModelsResponse.models.find(
                    model => model.provider === 'diffusers' && model.display_name.includes('Fine-tuned Diffuser')
                  );

                  const standardDiffusersModel = imageModelsResponse.models.find(
                    model => model.provider === 'diffusers' && model.value.toLowerCase().includes('stable-diffusion')
                  );

                  if (fineTunedDiffusersModel) {
                    setSelectedModel(fineTunedDiffusersModel.value);
                    setSelectedProvider('diffusers');
                  } else if (standardDiffusersModel) {
                    setSelectedModel(standardDiffusersModel.value);
                    setSelectedProvider('diffusers');
                  } else if (imageModelsResponse.models.length > 0) {
                    setSelectedModel(imageModelsResponse.models[0].value);
                    setSelectedProvider(imageModelsResponse.models[0].provider);
                  }
                }
              } catch (error) {
                console.error('Error loading image models:', error);
                if (aiEnabled) setSelectedProvider('diffusers');
              }
            }
        };

        loadAllData();
    }, [currentPath, settings.trackedFolders]);

const [selectedGeneratedImage, setSelectedGeneratedImage] = useState(null);
const [isRefreshing, setIsRefreshing] = useState(false);

const handleRefreshImages = async () => {
  setIsRefreshing(true);
  try {
    await loadImagesForAllSources(imageSources);
  } catch (err) {
    setError('Failed to refresh images: ' + err.message);
  } finally {
    setIsRefreshing(false);
  }
};

const handleUseGeneratedImage = async (imageData) => {
  try {

    const response = await fetch(imageData);
    const blob = await response.blob();
    const timestamp = Date.now();
    const filename = `generated_${timestamp}.png`;

    await window.api?.saveGeneratedImage?.(blob, activeSource?.path, filename);

    await loadImagesForAllSources(imageSources);

    const newImagePath = `media://${activeSource?.path}/${filename}`;
    setSelectedImage(newImagePath);
    setActiveTab('editor');

    setSelectedGeneratedImage({
      path: `${activeSource?.path}/${filename}`,
      data: imageData
    });

  } catch (error) {
    console.error('Failed to save generated image:', error);
    setError('Failed to save generated image: ' + error.message);
  }
};


const [generatedFilenames, setGeneratedFilenames] = useState([]);
const [generateFilename, setGenerateFilename] = useState('vixynt_gen');


  const handleContextMenu = (e, imgPath) => {
    e.preventDefault(); e.stopPropagation();

    if (!selectedImageGroup.has(imgPath)) {
        setSelectedImage(imgPath);
        setSelectedImageGroup(new Set([imgPath]));
    } else {

        setSelectedImage(imgPath);
    }
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, imagePath: imgPath });
  };
  const handleRenameStart = () => {
    setRenamingImage({ path: selectedImage, newName: getFileName(selectedImage) });
    setContextMenu({ visible: false });
    setLightboxIndex(null);
  };

  const handleRenameSubmit = async () => {
    if (!renamingImage.path || !renamingImage.newName.trim()) {
        setRenamingImage({ path: null, newName: '' });
        return;
    }

    try {
        const oldPath = renamingImage.path.replace('media://', '');
        const pathParts = oldPath.split('/');
        const newPath = [...pathParts.slice(0, -1), renamingImage.newName].join('/');

        await window.api?.renameFile?.(oldPath, newPath);

        await loadImagesForAllSources(imageSources);

        if (selectedImage === renamingImage.path) {
            setSelectedImage(`media://${newPath}`);
        }

        setRenamingImage({ path: null, newName: '' });
          setContextMenu({ visible: false });
    setLightboxIndex(null);

    } catch (error) {
        console.error('Rename failed:', error);
        setError('Failed to rename file: ' + error.message);
    }
};

const handleDeleteSelected = async () => {
    if (selectedImageGroup.size === 0) return;

    const confirmed = window.confirm(`Delete ${selectedImageGroup.size} image(s)? This cannot be undone.`);
    if (!confirmed) return;

    try {
        const filesToDelete = Array.from(selectedImageGroup).map(path => path.replace('media://', ''));
        await Promise.all(filesToDelete.map(path => window.api?.deleteFile?.(path)));

        setSelectedImageGroup(new Set());
        setSelectedImage(null);
        await loadImagesForAllSources(imageSources);
    } catch (error) {
        console.error('Delete failed:', error);
        setError('Failed to delete files: ' + error.message);
    }
};

  const renderHeader = () => (
    <div className="flex items-center justify-between p-3 border-b theme-border flex-shrink-0">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold">Vixynt</h2>
        {renderPathNavigator()}
      </div>
    </div>
  );


useEffect(() => { setDisplayedImagesCount(IMAGES_PER_PAGE); }, [activeSourceId, searchTerm]);


    useEffect(() => {
      const handleKeyDown = (e) => {
          if (lightboxIndex !== null) {
              if (e.key === 'ArrowLeft' && lightboxIndex > 0) {
                  setLightboxIndex(i => i - 1);
} else if (e.key === 'ArrowRight' && lightboxIndex < sortedAndFilteredImages.length - 1) {                  setLightboxIndex(i => i + 1);
              }
          }

          console.log('Key pressed:', e.key);
          if (e.key === 'Escape') {
              if (lightboxIndex !== null) {
                  setLightboxIndex(null);
              } else if (contextMenu.visible) {
                  setContextMenu({ visible: false });
              } else if (renamingImage.path) {
                  setRenamingImage({ path: null, newName: '' });
              } else if (isEditingPath) {
                  setIsEditingPath(false);
              }
          }
          if (e.key === 'Enter' && isEditingPath) {
              setIsEditingPath(false);
          }
      };

      const handleClickOutside = () => {
          if (contextMenu.visible) {
              setContextMenu({ visible: false });
          }
      };

      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('click', handleClickOutside);

      return () => {
          document.removeEventListener('keydown', handleKeyDown);
          document.removeEventListener('click', handleClickOutside);
      };
  }, [contextMenu.visible, renamingImage.path, isEditingPath, lightboxIndex, filteredImages.length]);


  const handleOpenFolderDialog = async () => {
    try {
      const result = await window.api?.showOpenDialog?.({
        properties: ['openDirectory'],
      });
      const picked = Array.isArray(result)
        ? (result[0]?.path || result[0])
        : (result?.filePaths?.[0] || result?.filePath || result?.[0]);
      if (picked) {
        const name = picked.split('/').pop() || picked.split('\\').pop() || picked;
        const id = `folder_${Date.now()}`;
        addTrackedFolder({ id, name, path: picked });
        setActiveSourceId(id);
      }
    } catch (e) {
      console.error('Open folder failed:', e);
    }
  };

  const handleRemoveTrackedFolder = (folderId: string) => {
    removeTrackedFolder(folderId);
    if (activeSourceId === folderId) {
      const remaining = settings.trackedFolders.filter(f => f.id !== folderId);
      setActiveSourceId(remaining[0]?.id || '');
    }
  };

  const isMac = navigator.platform.startsWith('Mac');
  const renderSidebar = () => {
    const autoCollapsed = activeTab !== 'gallery';
    if (autoCollapsed) return null;
    return (
    <div
      ref={sidebarRef}
      className={`${sidebarCollapsed ? 'w-12' : 'w-64'} border-r theme-border flex flex-col flex-shrink-0 theme-sidebar transition-all duration-200`}
      style={{ width: sidebarCollapsed ? 48 : 256 }}
    >
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="p-2 border-b theme-border hover:bg-white/5 transition-colors flex items-center justify-center"
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {!sidebarCollapsed ? (
        <>
          <div className="p-3 border-b theme-border">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold theme-text-secondary uppercase tracking-wider">Folders</h4>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleRefreshImages}
                  disabled={isRefreshing}
                  className="p-1 theme-hover rounded-full transition-all disabled:opacity-50"
                  title="Refresh images"
                >
                  {isRefreshing ? (
                    <Loader size={14} className="animate-spin" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.44-4.5M22 12.5a10 10 0 0 1-18.44 4.5"/>
                    </svg>
                  )}
                </button>
                <button
                  onClick={handleOpenFolderDialog}
                  className="p-1 theme-hover rounded-full transition-all"
                  title="Add folder to track"
                >
                  <PlusCircle size={14} />
                </button>
              </div>
            </div>
            {imageSources.map(source => (
              <div key={source.id} className="group relative">
                <button
                  onClick={() => setActiveSourceId(source.id)}
                  className={`w-full text-left p-2 rounded text-sm mb-1 flex items-center gap-2 pr-7 ${activeSourceId === source.id ? 'theme-button-primary' : 'theme-hover'}`}
                >
                  <Folder size={14} className="flex-shrink-0" />
                  <span className="truncate">{source.name}</span>
                  <span className="ml-auto text-xs theme-text-muted flex-shrink-0">({source.images?.length || 0})</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveTrackedFolder(source.id); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover:opacity-100 theme-hover transition-opacity"
                  title="Remove folder"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {imageSources.length === 0 && (
              <div className="text-xs theme-text-muted text-center py-4">
                No folders tracked.<br />
                Click <PlusCircle size={10} className="inline" /> to add one.
              </div>
            )}
          </div>

          <div className="p-3 border-b theme-border">
            <h4 className="text-xs font-semibold theme-text-secondary uppercase tracking-wider mb-2">View Options</h4>
            <div className="flex gap-1 mb-2">
              <button onClick={() => setViewMode('grid')}
                className={`flex-1 p-2 rounded flex items-center justify-center ${viewMode === 'grid' ? 'theme-button-primary' : 'theme-hover'}`}
                title="Grid view">
                <LayoutGrid size={14} /></button>
              <button onClick={() => setViewMode('list')}
                className={`flex-1 p-2 rounded flex items-center justify-center ${viewMode === 'list' ? 'theme-button-primary' : 'theme-hover'}`}
                title="List view">
                <List size={14} /></button>
            </div>
            <div className="relative mb-2">
              <input type="text" placeholder="Filter by name..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} className="w-full pl-2.5 pr-7 theme-input text-sm rounded" />
              <Search size={14} className="absolute right-2 top-2 theme-text-muted pointer-events-none" />
            </div>
            <div className="relative">
              <input type="text" placeholder="Filter by metadata..." value={metaSearch}
                onChange={e => setMetaSearch(e.target.value)} className="w-full pl-2.5 pr-7 theme-input text-sm rounded" />
              <Search size={14} className="absolute right-2 top-2 theme-text-muted pointer-events-none" />
            </div>
          </div>

          <div className="p-3 flex-1 overflow-y-auto">
            {selectedImageGroup.size > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold theme-text-secondary uppercase tracking-wider">Selected ({selectedImageGroup.size})</h4>
                <button className="w-full theme-button flex items-center gap-2 justify-center text-sm py-2 rounded"
                  onClick={handleDeleteSelected}><Trash2 size={14} /> Delete Selected</button>
              </div>
            )}
          </div>

          <div className="p-3 border-t theme-border space-y-1">
            <button
              onClick={() => setActiveTab('settings')}
              className="w-full theme-button flex items-center gap-2 text-sm py-2 rounded justify-center"
            >
              <Sliders size={14} /> Settings
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center py-2 space-y-2">
          {imageSources.map(source => (
            <button
              key={source.id}
              onClick={() => setActiveSourceId(source.id)}
              className={`p-2 rounded ${activeSourceId === source.id ? 'theme-button-primary' : 'theme-hover'}`}
              title={source.name}
            >
              <Folder size={16} />
            </button>
          ))}
          <button
            onClick={handleOpenFolderDialog}
            className="p-2 rounded theme-hover"
            title="Add folder"
          >
            <PlusCircle size={16} />
          </button>
          <div className="border-t theme-border w-6 my-2" />
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'theme-button-primary' : 'theme-hover'}`}
            title="Grid view"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'theme-button-primary' : 'theme-hover'}`}
            title="List view"
          >
            <List size={16} />
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setActiveTab('settings')}
            className="p-2 rounded theme-hover"
            title="Settings"
          >
            <Sliders size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

useEffect(() => {
    const savedView = localStorage.getItem('vixynt_viewMode');
    if (savedView) setViewMode(savedView);
}, []);

useEffect(() => {
    localStorage.setItem('vixynt_viewMode', viewMode);
}, [viewMode]);

useEffect(() => {
    localStorage.setItem('vixynt_sidebarCollapsed', String(sidebarCollapsed));
}, [sidebarCollapsed]);

const [sortBy, setSortBy] = useState('name');
const [sortOrder, setSortOrder] = useState('asc');
const [filterType, setFilterType] = useState('all');
const [imageMetaCache, setImageMetaCache] = useState({});

const sortedAndFilteredImages = React.useMemo(() => {
    const source = imageSources.find(s => s.id === activeSourceId);
    const allImages = source?.images || [];

    let result = allImages.filter(img =>
        img.path.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filterType !== 'all') {
        result = result.filter(img => {
            const ext = img.path.split('.').pop().toLowerCase();
            if (filterType === 'jpg') return ext === 'jpg' || ext === 'jpeg';
            if (filterType === 'png') return ext === 'png';
            if (filterType === 'webp') return ext === 'webp';
            if (filterType === 'gif') return ext === 'gif';
            return true;
        });
    }

    result.sort((a, b) => {
        const nameA = getFileName(a.path).toLowerCase();
        const nameB = getFileName(b.path).toLowerCase();
        const extA = a.path.split('.').pop().toLowerCase();
        const extB = b.path.split('.').pop().toLowerCase();
        const metaA = imageMetaCache[a.path] || {};
        const metaB = imageMetaCache[b.path] || {};

        let comparison = 0;
        if (sortBy === 'name') {
            comparison = nameA.localeCompare(nameB);
        } else if (sortBy === 'type') {
            comparison = extA.localeCompare(extB);
        } else if (sortBy === 'size') {
            const sizeA = metaA?.size || metaA?.file?.size || 0;
            const sizeB = metaB?.size || metaB?.file?.size || 0;
            comparison = sizeA - sizeB;
        } else if (sortBy === 'date') {
            const dateA = metaA?.mtime || metaA?.file?.modified || 0;
            const dateB = metaB?.mtime || metaB?.file?.modified || 0;
            comparison = new Date(dateA) - new Date(dateB);
        }

        return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result.map(img => img.url);
}, [imageSources, activeSourceId, searchTerm, sortBy, sortOrder, filterType, imageMetaCache]);

useEffect(() => {
    if (viewMode !== 'list') return;

    const visible = sortedAndFilteredImages.slice(0, displayedImagesCount);
    const toLoad = visible.filter(img => !imageMetaCache[img]);

    if (toLoad.length === 0) return;

    let cancelled = false;

    const loadBatch = async () => {
        for (const img of toLoad) {
            if (cancelled) break;
            const fsPath = img.replace('media://', '');
            const stats = await window.api?.getFileStats?.(fsPath);
            if (!cancelled && stats) {
                setImageMetaCache(prev => ({ ...prev, [img]: stats }));
            }
        }
    };

    loadBatch();

    return () => { cancelled = true; };
}, [viewMode, sortedAndFilteredImages, displayedImagesCount]);
const formatFileSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const formatDate = (dateVal) => {
    if (!dateVal) return '—';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
};


const handleImageClick = (e, imgPath, index) => {
    e.stopPropagation();
    setRenamingImage({ path: null, newName: '' });

    if (e.shiftKey || e.ctrlKey || e.metaKey) {
        const newSelection = new Set(selectedImageGroup);
        if (e.shiftKey && lastClickedIndex !== null) {
            const start = Math.min(lastClickedIndex, index);
            const end = Math.max(lastClickedIndex, index);
            for (let i = start; i <= end; i++) {
                newSelection.add(sortedAndFilteredImages[i]);
            }
        } else {
            if (newSelection.has(imgPath)) {
                newSelection.delete(imgPath);
            } else {
                newSelection.add(imgPath);
            }
        }
        setSelectedImageGroup(newSelection);
        setLastClickedIndex(index);
    } else {

        const newSelection = new Set([imgPath]);
        setSelectedImageGroup(newSelection);
        setSelectedImage(imgPath);
        setLastClickedIndex(index);
    }
};

const handleImageDoubleClick = (e, imgPath, index) => {
    e.stopPropagation();
    setLightboxIndex(index);
    setSelectedImage(imgPath);
};

const renderLightbox = () => {
    if (lightboxIndex === null) return null;

    return (
        <Lightbox
            images={sortedAndFilteredImages}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
            onContextMenu={(src, e) => handleImageContextMenu(e, src)}
            className="z-[60]"
        />
    );
};

  const renderImageContextMenu = () => (
    contextMenu.visible && (
        <>
            <div
                className="fixed inset-0 z-[75] bg-transparent"
                onClick={() => setContextMenu({ visible: false })}
            />
            <div
                className="fixed theme-bg-secondary theme-border border rounded shadow-lg py-1 z-[80]"
                style={{ top: contextMenu.y, left: contextMenu.x }}
            >
                <button
                    onClick={() => { setActiveTab('editor'); setContextMenu({ visible: false }); setLightboxIndex(null); }}
                    className="flex items-center gap-2 px-4 py-2 theme-hover w-full text-left theme-text-primary text-sm"
                >
                    <Edit size={14} />
                    <span>Edit Image</span>
                </button>
                {aiEnabled && (
                    <>
                        <button
                            onClick={handleUseForGeneration}
                            className="flex items-center gap-2 px-4 py-2 theme-hover w-full text-left theme-text-primary text-sm"
                        >
                            <Sparkles size={14} />
                            <span>Use for Generation</span>
                        </button>
                    </>
                )}
                <hr className="my-1 theme-border" />
                <button
                    onClick={handleRenameStart}
                    className="flex items-center gap-2 px-4 py-2 theme-hover w-full text-left theme-text-primary text-sm"
                >
                    <Edit size={14} />
                    <span>Rename</span>
                </button>
                <button
                    onClick={() => { handleDeleteSelected(); setContextMenu({ visible: false }); setLightboxIndex(null); }}
                    className="flex items-center gap-2 px-4 py-2 theme-hover w-full text-left text-red-400 text-sm hover:bg-red-600/20"
                >
                    <Trash2 size={14} />
                    <span>Delete</span>
                </button>
            </div>
        </>
    )
);

  const handleSendToLLM = () => {
  const selectedImages = Array.from(selectedImageGroup);
  if (selectedImages.length === 0) return;

  onStartConversation?.(selectedImages.map(path => ({ path: path.replace('media://', '') })));
  setContextMenu({ visible: false });
  setLightboxIndex(null);
};

const handleUseForGeneration = () => {
  if (contextMenu.imagePath) {

      setActiveTab('generator');

      setGeneratePrompt(prev => `${prev} ${prev ? '\n\n' : ''}Using reference image: ${getFileName(contextMenu.imagePath)}`);
  }
  setContextMenu({ visible: false });
  setLightboxIndex(null);

};
  const handleImageContextMenu = (e, imgPath) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedImageGroup.has(imgPath)) {
        setSelectedImage(imgPath);
        setSelectedImageGroup(new Set([imgPath]));
    }
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, imagePath: imgPath });
};

  const renderPathNavigator = () => {
    const displayPath = currentPath || projectPath;

    return (
      <div className="flex items-center gap-2 text-sm theme-text-secondary p-2 flex-grow min-w-0" onClick={() => setIsEditingPath(true)}>
          <FolderOpen size={16} className="flex-shrink-0 theme-text-muted" />
          {isEditingPath ? (
              <input type="text" value={projectPath} onChange={e => setProjectPath(e.target.value)}
                     className="theme-input bg-transparent theme-text-primary w-full" autoFocus onBlur={() => setIsEditingPath(false)} />
          ) : (
              <div className="flex items-center gap-1 truncate">
                  {displayPath.split('/').map((part, i) => (
                      <React.Fragment key={i}>
                          {i > 0 && <span className="text-gray-600">/</span>}
                          <button className="px-1 rounded hover:theme-bg-tertiary">{part || '/'}</button>
                      </React.Fragment>
                  ))}
              </div>
          )}
      </div>
    );
  };






const VIXYNT_MODES = [
    { id: 'gallery', name: 'Gallery', icon: Grid, group: 'browse' },
    { id: 'generator', name: 'Image Generate', icon: Sparkles, group: 'create' },
    { id: 'video-gen', name: 'Video Generate', icon: Video, group: 'create' },
    { id: 'editor', name: 'DarkRoom', icon: Sliders, group: 'edit' },
    { id: 'video-editor', name: 'Video Editor', icon: Film, group: 'edit' },
    { id: 'settings', name: 'Settings', icon: Sliders, group: 'manage' },
];

const AI_VIXYNT_MODE_IDS = ['generator', 'video-gen'];
const filteredModes = aiEnabled ? VIXYNT_MODES : VIXYNT_MODES.filter(m => !AI_VIXYNT_MODE_IDS.includes(m.id));
const currentMode = filteredModes.find(m => m.id === activeTab) || filteredModes[0];
const CurrentIcon = currentMode.icon;

useEffect(() => {
    const validIds = new Set(filteredModes.map(m => m.id));
    if (!validIds.has(activeTab)) {
        setActiveTab('gallery');
    }
}, [activeTab, filteredModes, setActiveTab]);

return (
  <div ref={rootRef} className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
    <div className="flex-shrink-0 px-2 py-1.5 border-b theme-border theme-bg-secondary z-30">
      <div className="relative group inline-block">
        <button className="flex items-center gap-2 px-3 py-1.5 w-40 theme-bg-primary theme-hover rounded-lg border theme-border text-sm">
          <CurrentIcon size={16} className="text-blue-400 flex-shrink-0"/>
          <span className="font-medium truncate flex-1 text-left">{currentMode.name}</span>
          <ChevronRight size={14} className="text-gray-500 rotate-90 flex-shrink-0"/>
        </button>
        <div className="absolute top-full left-0 mt-1 w-48 theme-bg-secondary backdrop-blur-sm rounded-lg border theme-border shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-40">
          <div className="py-1">
            {filteredModes.map(mode => {
              const ModeIcon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => setActiveTab(mode.id)}
                  className={`w-full px-3 py-1.5 flex items-center gap-2 text-sm hover:bg-gray-700 ${activeTab === mode.id ? 'text-blue-400 bg-blue-600/20' : 'text-gray-300'}`}
                >
                  <ModeIcon size={14}/>{mode.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    <div ref={rowRef} className="flex-1 flex overflow-hidden min-w-0">
      {renderSidebar()}
      <main ref={mainRef} className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        {activeTab === 'gallery' && (
          <Gallery
            sortedAndFilteredImages={sortedAndFilteredImages}
            selectedImageGroup={selectedImageGroup}
            viewMode={viewMode}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            filterType={filterType}
            setFilterType={setFilterType}
            displayedImagesCount={displayedImagesCount}
            setDisplayedImagesCount={setDisplayedImagesCount}
            renamingImage={renamingImage}
            setRenamingImage={setRenamingImage}
            imageMetaCache={imageMetaCache}
            loading={loading}
            handleImageClick={handleImageClick}
            handleImageDoubleClick={handleImageDoubleClick}
            handleContextMenu={handleContextMenu}
            handleRenameSubmit={handleRenameSubmit}
            formatFileSize={formatFileSize}
            formatDate={formatDate}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === 'editor' && (
          <DarkRoom
            containerRef={darkroomRef}
            editorWrapperRef={imageEditorWrapperRef}
            selectedImage={selectedImage}
            setSelectedImage={setSelectedImage}
            currentPath={currentPath}
            setError={setError}
            aiEnabled={aiEnabled}
            availableModels={availableModels}
            selectedModel={selectedModel}
            selectedProvider={selectedProvider}
          />
        )}
        {aiEnabled && activeTab === 'generator' && (
          <ImageGenerator
            containerRef={generatorRef}
            rightRef={generatorRightRef}
            currentPath={currentPath}
            activeSource={activeSource}
            activeSourceId={activeSourceId}
            setActiveSourceId={setActiveSourceId}
            imageSources={imageSources}
            selectedImageGroup={selectedImageGroup}
            setSelectedImageGroup={setSelectedImageGroup}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            selectedProvider={selectedProvider}
            setSelectedProvider={setSelectedProvider}
            availableModels={availableModels}
            generatePrompt={generatePrompt}
            setGeneratePrompt={setGeneratePrompt}
            generating={generating}
            setGenerating={setGenerating}
            generatedImages={generatedImages}
            setGeneratedImages={setGeneratedImages}
            generatedFilenames={generatedFilenames}
            setGeneratedFilenames={setGeneratedFilenames}
            selectedGeneratedImages={selectedGeneratedImages}
            setSelectedGeneratedImages={setSelectedGeneratedImages}
            numImagesToGenerate={numImagesToGenerate}
            setNumImagesToGenerate={setNumImagesToGenerate}
            generateFilename={generateFilename}
            setGenerateFilename={setGenerateFilename}
            outputWidth={outputWidth}
            setOutputWidth={setOutputWidth}
            outputHeight={outputHeight}
            setOutputHeight={setOutputHeight}
            setError={setError}
            setSelectedImage={setSelectedImage}
            setActiveTab={setActiveTab}
          />
        )}
        {aiEnabled && activeTab === 'video-gen' && (
          <VideoGenerator
            containerRef={videoGeneratorRef}
            rightRef={videoGeneratorRightRef}
            currentPath={currentPath}
            selectedImage={selectedImage}
            setSelectedImage={setSelectedImage}
            videoPrompt={videoPrompt}
            setVideoPrompt={setVideoPrompt}
            videoModel={videoModel}
            setVideoModel={setVideoModel}
            videoDurationSetting={videoDurationSetting}
            setVideoDurationSetting={setVideoDurationSetting}
            generatingVideo={generatingVideo}
            setGeneratingVideo={setGeneratingVideo}
            generatedVideos={generatedVideos}
            setGeneratedVideos={setGeneratedVideos}
            videoSelectionMode={videoSelectionMode}
            setVideoSelectionMode={setVideoSelectionMode}
            selectedGeneratedVideos={selectedGeneratedVideos}
            setSelectedGeneratedVideos={setSelectedGeneratedVideos}
            showCreateVideoDataset={showCreateVideoDataset}
            setShowCreateVideoDataset={setShowCreateVideoDataset}
            showAddToVideoDataset={showAddToVideoDataset}
            setShowAddToVideoDataset={setShowAddToVideoDataset}
            newVideoDatasetName={newVideoDatasetName}
            setNewVideoDatasetName={setNewVideoDatasetName}
            videoDatasets={videoDatasets}
            setVideoDatasets={setVideoDatasets}
            selectedVideoDatasetId={selectedVideoDatasetId}
            setSelectedVideoDatasetId={setSelectedVideoDatasetId}
            setError={setError}
            setVideoClips={setVideoClips}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === 'video-editor' && (
          <VideoEditor
            videoClips={videoClips}
            setVideoClips={setVideoClips}
            selectedImage={selectedImage}
            setSelectedImage={setSelectedImage}
            currentPath={currentPath}
            setError={setError}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsPanel
            aiEnabled={aiEnabled}
            settings={settings}
            updateSettings={updateSettings}
            addTrackedFolder={addTrackedFolder}
            removeTrackedFolder={removeTrackedFolder}
            onBrowseFolder={handleOpenFolderDialog}
          />
        )}
        {aiEnabled && renderFineTuneModal()}
      </main>
    </div>
    {renderImageContextMenu()}
    {renderLightbox()}
  </div>
);

};

export default PhotoViewer;
