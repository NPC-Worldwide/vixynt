import React from 'react';
import {
  Video,
  Loader,
  Sparkles,
  Layers,
  Package,
  Plus,
  ChevronRight,
  Film,
  Download,
} from 'lucide-react';

export interface VideoGeneratorProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  rightRef: React.RefObject<HTMLDivElement | null>;
  currentPath: string;
  selectedImage: string | null;
  setSelectedImage: (path: string | null) => void;
  videoPrompt: string;
  setVideoPrompt: (p: string) => void;
  videoModel: string;
  setVideoModel: (m: string) => void;
  videoDurationSetting: number;
  setVideoDurationSetting: (d: number) => void;
  generatingVideo: boolean;
  setGeneratingVideo: (v: boolean) => void;
  generatedVideos: any[];
  setGeneratedVideos: (v: any[]) => void;
  videoSelectionMode: boolean;
  setVideoSelectionMode: (v: boolean) => void;
  selectedGeneratedVideos: Set<string>;
  setSelectedGeneratedVideos: (s: Set<string>) => void;
  showCreateVideoDataset: boolean;
  setShowCreateVideoDataset: (v: boolean) => void;
  showAddToVideoDataset: boolean;
  setShowAddToVideoDataset: (v: boolean) => void;
  newVideoDatasetName: string;
  setNewVideoDatasetName: (n: string) => void;
  videoDatasets: any[];
  setVideoDatasets: (v: any[]) => void;
  selectedVideoDatasetId: string;
  setSelectedVideoDatasetId: (id: string) => void;
  setError: (msg: string | null) => void;
  setVideoClips: (v: any[]) => void;
  setActiveTab: (tab: string) => void;
}

const VideoGenerator: React.FC<VideoGeneratorProps> = ({
  containerRef,
  rightRef,
  currentPath,
  selectedImage,
  setSelectedImage,
  videoPrompt,
  setVideoPrompt,
  videoModel,
  setVideoModel,
  videoDurationSetting,
  setVideoDurationSetting,
  generatingVideo,
  setGeneratingVideo,
  generatedVideos,
  setGeneratedVideos,
  videoSelectionMode,
  setVideoSelectionMode,
  selectedGeneratedVideos,
  setSelectedGeneratedVideos,
  showCreateVideoDataset,
  setShowCreateVideoDataset,
  showAddToVideoDataset,
  setShowAddToVideoDataset,
  newVideoDatasetName,
  setNewVideoDatasetName,
  videoDatasets,
  setVideoDatasets,
  selectedVideoDatasetId,
  setSelectedVideoDatasetId,
  setError,
  setVideoClips,
  setActiveTab,
}) => {
  const VIDEO_MODELS = [
    { id: 'veo-3.1-generate-preview', name: 'Veo 3.1', provider: 'gemini', maxDuration: 8 },
    { id: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast', provider: 'gemini', maxDuration: 8 },
    { id: 'veo-2.0-generate-001', name: 'Veo 2', provider: 'gemini', maxDuration: 8 },
    { id: 'damo-vilab/text-to-video-ms-1.7b', name: 'ModelScope 1.7B (Local)', provider: 'diffusers', maxDuration: 4 },
  ];

  const toggleVideoSelection = (id: string) => {
    setSelectedGeneratedVideos((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div ref={containerRef} className="grid grid-cols-[340px_minmax(0,1fr)] h-full min-w-0">
      <div className="border-r theme-border theme-bg-secondary flex flex-col overflow-hidden">
        <div className="p-4 border-b theme-border">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Video size={20} /> Video Generator
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs text-gray-400 font-semibold uppercase">Prompt</label>
            <textarea
              value={videoPrompt}
              onChange={(e) => setVideoPrompt(e.target.value)}
              placeholder="Describe the video you want to create..."
              className="w-full theme-input mt-2 text-sm"
              rows={4}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 font-semibold uppercase">Model</label>
            <select
              value={videoModel}
              onChange={(e) => setVideoModel(e.target.value)}
              className="w-full theme-input mt-2 text-sm"
            >
              <option value="">Select a model...</option>
              {VIDEO_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 font-semibold uppercase">Duration (seconds)</label>
            <div className="flex items-center gap-3 mt-2">
              <input
                type="range"
                min={2}
                max={16}
                value={videoDurationSetting}
                onChange={(e) => setVideoDurationSetting(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm w-8">{videoDurationSetting}s</span>
            </div>
          </div>

          {selectedImage && (
            <div className="p-3 bg-blue-600/20 rounded-lg border border-blue-500/50">
              <p className="text-xs text-blue-400 font-semibold mb-2">Reference Image</p>
              <img src={selectedImage} className="w-full rounded aspect-video object-cover" />
              <button
                onClick={() => setSelectedImage(null)}
                className="text-xs text-blue-400 hover:text-blue-300 mt-2"
              >
                Remove reference
              </button>
            </div>
          )}
        </div>

        <div className="p-4 border-t theme-border bg-black/20">
          <button
            onClick={async () => {
              if (!videoPrompt || !videoModel) {
                setError('Please enter a prompt and select a model');
                return;
              }
              setGeneratingVideo(true);
              try {
                const selectedModelData = VIDEO_MODELS.find((m) => m.id === videoModel);
                const result = await (window as any).api.generateVideo(
                  videoPrompt,
                  videoModel,
                  selectedModelData?.provider || 'gemini',
                  videoDurationSetting,
                  currentPath,
                  selectedImage ? (selectedImage as any).base64 : null
                );
                if (result.error) {
                  throw new Error(result.error);
                }
                setGeneratedVideos((prev: any[]) => [
                  ...prev,
                  {
                    id: `video_${Date.now()}`,
                    prompt: videoPrompt,
                    url: result.video_base64 || '',
                    path: result.video_path || '',
                    createdAt: new Date().toISOString(),
                  },
                ]);
              } catch (err: any) {
                setError('Video generation failed: ' + err.message);
              } finally {
                setGeneratingVideo(false);
              }
            }}
            disabled={generatingVideo || !videoPrompt}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-semibold flex items-center justify-center gap-2"
          >
            {generatingVideo ? (
              <>
                <Loader size={18} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Generate Video
              </>
            )}
          </button>
        </div>
      </div>

      <div ref={rightRef} className="min-w-0 flex flex-col overflow-hidden theme-bg-primary">
        {generatedVideos.length > 0 && (
          <div className="p-3 border-b theme-border flex items-center gap-2">
            <button
              onClick={() => {
                setVideoSelectionMode(!videoSelectionMode);
                if (videoSelectionMode) setSelectedGeneratedVideos(new Set());
              }}
              className={`px-3 py-1.5 rounded text-xs flex items-center gap-1 ${
                videoSelectionMode
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <Layers size={12} /> {videoSelectionMode ? 'Cancel' : 'Select'}
            </button>
            {videoSelectionMode && selectedGeneratedVideos.size > 0 && (
              <>
                <span className="text-xs text-gray-400">{selectedGeneratedVideos.size} selected</span>
                <button
                  onClick={() => setShowAddToVideoDataset(true)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs flex items-center gap-1"
                >
                  <Plus size={12} /> Add to Dataset
                </button>
              </>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setShowCreateVideoDataset(true)}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs flex items-center gap-1"
            >
              <Package size={12} /> Datasets
            </button>
          </div>
        )}

        <div className="flex-1 p-4 overflow-y-auto">
          {generatedVideos.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 w-full">
              {generatedVideos.map((video: any) => (
                <div
                  key={video.id}
                  onClick={() => videoSelectionMode && toggleVideoSelection(video.id)}
                  className={`bg-gray-800 rounded-xl overflow-hidden ${
                    videoSelectionMode
                      ? selectedGeneratedVideos.has(video.id)
                        ? 'ring-2 ring-purple-500 bg-purple-900/20 cursor-pointer'
                        : 'hover:bg-gray-700/50 cursor-pointer'
                      : ''
                  }`}
                >
                  <div className="aspect-video bg-gray-900 flex items-center justify-center relative">
                    {videoSelectionMode && (
                      <input
                        type="checkbox"
                        checked={selectedGeneratedVideos.has(video.id)}
                        onChange={() => toggleVideoSelection(video.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-2 left-2 w-4 h-4 z-10"
                      />
                    )}
                    {video.url ? (
                      <video src={video.url} controls className="w-full h-full" />
                    ) : (
                      <div className="text-center">
                        <Film size={32} className="mx-auto text-gray-600 mb-2" />
                        <p className="text-xs text-gray-500">Processing...</p>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm text-gray-300 line-clamp-2">{video.prompt}</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={async () => {
                          if (video.url) {
                            try {
                              const link = document.createElement('a');
                              link.href = video.url;
                              link.download = `generated-video-${Date.now()}.mp4`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            } catch (e) {
                              console.error('Download failed:', e);
                            }
                          }
                        }}
                        disabled={!video.url}
                        className="flex-1 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 rounded text-blue-400 text-xs flex items-center justify-center gap-1 disabled:opacity-40"
                      >
                        <Download size={12} /> Download
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setVideoClips((prev: any[]) => [
                            ...prev,
                            {
                              id: `clip_${Date.now()}`,
                              type: 'video',
                              src: video.url,
                              startTime: 0,
                              duration: videoDurationSetting,
                              trackId: 'video-1',
                            },
                          ]);
                          setActiveTab('video-editor');
                        }}
                        className="flex-1 py-1.5 bg-green-600/20 hover:bg-green-600/30 rounded text-green-400 text-xs flex items-center justify-center gap-1"
                      >
                        <Film size={12} /> Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Video size={64} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400 text-lg">Generate AI Videos</p>
                <p className="text-gray-600 text-sm mt-2">
                  Enter a prompt and select a model to get started
                </p>
              </div>
            </div>
          )}
        </div>

        {showCreateVideoDataset && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200]"
            onClick={() => setShowCreateVideoDataset(false)}
          >
            <div
              className="bg-gray-800 rounded-lg shadow-xl w-96 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Package className="text-purple-400" size={18} />
                Create Video Dataset
              </h4>
              <input
                type="text"
                value={newVideoDatasetName}
                onChange={(e) => setNewVideoDatasetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newVideoDatasetName.trim()) {
                    const newDataset = {
                      id: `video_dataset_${Date.now()}`,
                      name: newVideoDatasetName.trim(),
                      examples: [],
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    setVideoDatasets((prev: any[]) => [...prev, newDataset]);
                    setSelectedVideoDatasetId(newDataset.id);
                    setNewVideoDatasetName('');
                    setShowCreateVideoDataset(false);
                  }
                }}
                placeholder="Dataset name..."
                className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded focus:border-purple-500 focus:outline-none mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreateVideoDataset(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!newVideoDatasetName.trim()) return;
                    const newDataset = {
                      id: `video_dataset_${Date.now()}`,
                      name: newVideoDatasetName.trim(),
                      examples: [],
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    setVideoDatasets((prev: any[]) => [...prev, newDataset]);
                    setSelectedVideoDatasetId(newDataset.id);
                    setNewVideoDatasetName('');
                    setShowCreateVideoDataset(false);
                  }}
                  disabled={!newVideoDatasetName.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddToVideoDataset && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200]"
            onClick={() => setShowAddToVideoDataset(false)}
          >
            <div
              className="bg-gray-800 rounded-lg shadow-xl w-96 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Plus className="text-purple-400" size={18} />
                Add to Dataset
              </h4>
              {videoDatasets.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <p>No datasets yet</p>
                  <button
                    onClick={() => {
                      setShowAddToVideoDataset(false);
                      setShowCreateVideoDataset(true);
                    }}
                    className="mt-2 text-purple-400 hover:text-purple-300"
                  >
                    Create a dataset first
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {videoDatasets.map((dataset: any) => (
                    <button
                      key={dataset.id}
                      onClick={() => {
                        const selected = generatedVideos.filter((v: any) =>
                          selectedGeneratedVideos.has(v.id)
                        );
                        const newExamples = selected.map((v: any) => ({
                          id: `video_ex_${Date.now()}_${v.id}`,
                          prompt: v.prompt,
                          videoUrl: v.url,
                          model: videoModel,
                          duration: videoDurationSetting,
                          qualityScore: 4,
                          createdAt: new Date().toISOString(),
                        }));
                        setVideoDatasets((prev: any[]) =>
                          prev.map((d: any) =>
                            d.id === dataset.id
                              ? {
                                  ...d,
                                  examples: [...d.examples, ...newExamples],
                                  updatedAt: new Date().toISOString(),
                                }
                              : d
                          )
                        );
                        setSelectedGeneratedVideos(new Set());
                        setVideoSelectionMode(false);
                        setShowAddToVideoDataset(false);
                      }}
                      className="w-full p-3 bg-gray-700 hover:bg-gray-600 rounded text-left flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium">{dataset.name}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          {dataset.examples.length} videos
                        </span>
                      </div>
                      <ChevronRight size={16} className="text-gray-500" />
                    </button>
                  ))}
                </div>
              )}
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowAddToVideoDataset(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoGenerator;
