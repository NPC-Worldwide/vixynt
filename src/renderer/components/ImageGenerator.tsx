import React from 'react';
import {
  Sparkles,
  Loader,
  X,
  Plus,
  Check,
  Download,
  Edit,
  Trash2,
  ChevronRight,
} from 'lucide-react';

export interface ImageGeneratorProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  rightRef: React.RefObject<HTMLDivElement | null>;
  currentPath: string;
  activeSource: any;
  activeSourceId: string;
  setActiveSourceId: (id: string) => void;
  imageSources: any[];
  selectedImageGroup: Set<string>;
  setSelectedImageGroup: (s: Set<string>) => void;
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  selectedProvider: string;
  setSelectedProvider: (p: string) => void;
  availableModels: any[];
  generatePrompt: string;
  setGeneratePrompt: (p: string) => void;
  generating: boolean;
  setGenerating: (v: boolean) => void;
  generatedImages: string[];
  setGeneratedImages: (imgs: string[]) => void;
  generatedFilenames: string[];
  setGeneratedFilenames: (names: string[]) => void;
  selectedGeneratedImages: Set<number>;
  setSelectedGeneratedImages: (s: Set<number>) => void;
  numImagesToGenerate: number;
  setNumImagesToGenerate: (n: number) => void;
  generateFilename: string;
  setGenerateFilename: (n: string) => void;
  setError: (msg: string | null) => void;
  setSelectedImage: (path: string | null) => void;
  setActiveTab: (tab: string) => void;
}

const ImageGenerator: React.FC<ImageGeneratorProps> = ({
  containerRef,
  rightRef,
  currentPath,
  activeSource,
  activeSourceId,
  setActiveSourceId,
  imageSources,
  selectedImageGroup,
  setSelectedImageGroup,
  selectedModel,
  setSelectedModel,
  selectedProvider,
  setSelectedProvider,
  availableModels,
  generatePrompt,
  setGeneratePrompt,
  generating,
  setGenerating,
  generatedImages,
  setGeneratedImages,
  generatedFilenames,
  setGeneratedFilenames,
  selectedGeneratedImages,
  setSelectedGeneratedImages,
  numImagesToGenerate,
  setNumImagesToGenerate,
  generateFilename,
  setGenerateFilename,
  setError,
  setSelectedImage,
  setActiveTab,
}) => {
  const gridColsClass = 'grid-cols-1';

  const filteredAvailableModels = availableModels.filter(
    (model: any) => model.provider === selectedProvider
  );

  const uniqueProviders = [...new Set(availableModels.map((model: any) => model.provider))];

  const promptTemplates = [
    { label: 'Portrait', prompt: 'A professional portrait photograph of' },
    { label: 'Landscape', prompt: 'A stunning landscape photograph of' },
    { label: 'Abstract', prompt: 'An abstract artistic composition featuring' },
    { label: 'Cinematic', prompt: 'A cinematic film still showing' },
    { label: 'Product', prompt: 'A professional product photograph of' },
    { label: 'Concept Art', prompt: 'Detailed concept art depicting' },
  ];

  const getProviderInfo = (provider: string) => {
    const info: Record<string, { name: string; color: string; icon: string; order: number }> = {
      diffusers: { name: 'HF Diffusers', color: 'bg-yellow-600', icon: '🤗', order: 0 },
      openai: { name: 'OpenAI', color: 'bg-green-600', icon: '🤖', order: 1 },
      stability: { name: 'Stability AI', color: 'bg-purple-600', icon: '🎨', order: 2 },
      replicate: { name: 'Replicate', color: 'bg-blue-600', icon: '🔄', order: 3 },
      fal: { name: 'Fal.ai', color: 'bg-pink-600', icon: '⚡', order: 4 },
      together: { name: 'Together AI', color: 'bg-indigo-600', icon: '🚀', order: 5 },
      fireworks: { name: 'Fireworks', color: 'bg-orange-600', icon: '🎆', order: 6 },
      deepinfra: { name: 'DeepInfra', color: 'bg-cyan-600', icon: '🔥', order: 7 },
      bfl: { name: 'BFL/Flux', color: 'bg-violet-600', icon: '✨', order: 8 },
      bagel: { name: 'Bagel', color: 'bg-amber-600', icon: '🥯', order: 9 },
      leonardo: { name: 'Leonardo', color: 'bg-rose-600', icon: '🎭', order: 10 },
      ideogram: { name: 'Ideogram', color: 'bg-teal-600', icon: '💡', order: 11 },
      anthropic: { name: 'Anthropic', color: 'bg-orange-600', icon: '🔮', order: 12 },
    };
    return (
      info[provider] || {
        name: provider.charAt(0).toUpperCase() + provider.slice(1),
        color: 'bg-gray-600',
        icon: '🖼️',
        order: 99,
      }
    );
  };

  const sortedProviders = [...uniqueProviders].sort(
    (a: any, b: any) => getProviderInfo(a).order - getProviderInfo(b).order
  );

  const handleImageSelect = (index: number, isSelected: boolean) => {
    setSelectedGeneratedImages((prev: Set<number>) => {
      const next = new Set(prev);
      if (isSelected) next.add(index);
      else next.delete(index);
      return next;
    });
  };

  const handleUseSelected = () => {
    setActiveTab('editor');
    setSelectedGeneratedImages(new Set());
  };

  return (
    <div ref={containerRef} className="grid grid-cols-[340px_minmax(0,1fr)] h-full min-w-0">
      <div className="border-r theme-border theme-bg-secondary flex flex-col overflow-hidden">
        <div className="p-4 border-b theme-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Sparkles size={20} /> Image Generator
            </h3>
            {generating && (
              <span className="flex items-center gap-1.5 text-xs text-purple-300">
                <Loader size={12} className="animate-spin" />
                Generating...
              </span>
            )}
          </div>
          <label className="text-xs text-gray-400 font-semibold uppercase">Prompt</label>
          <textarea
            value={generatePrompt}
            onChange={(e) => setGeneratePrompt(e.target.value)}
            rows={4}
            className="w-full theme-input text-sm resize-none mt-2"
            placeholder="Describe the image you want to create..."
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {promptTemplates.map((t) => (
              <button
                key={t.label}
                onClick={() =>
                  setGeneratePrompt((prev: string) => (prev ? `${prev} ${t.prompt}` : t.prompt))
                }
                className="px-2 py-0.5 text-[10px] rounded-full bg-purple-600/20 text-purple-200 hover:bg-purple-600/40 transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-200 uppercase tracking-wide mb-2 block">
              Provider
            </label>
            <div className="grid grid-cols-3 gap-2">
              {sortedProviders.map((provider) => {
                const info = getProviderInfo(provider);
                return (
                  <button
                    key={provider}
                    onClick={() => {
                      setSelectedProvider(provider);
                      const modelsForProvider = availableModels.filter(
                        (m: any) => m.provider === provider
                      );
                      if (modelsForProvider.length > 0) {
                        setSelectedModel(modelsForProvider[0].value);
                      }
                    }}
                    className={`p-2 rounded-lg border transition-all text-center ${
                      selectedProvider === provider
                        ? 'border-purple-500 bg-purple-500/20'
                        : 'border-white/10 hover:border-white/30 hover:bg-white/5'
                    }`}
                  >
                    <div className="text-lg mb-0.5">{info.icon}</div>
                    <div className="text-[10px] font-medium truncate text-gray-200">{info.name}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-200 uppercase tracking-wide mb-2 block">
              Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full theme-input text-sm"
            >
              {filteredAvailableModels.map((model: any) => (
                <option key={model.value} value={model.value}>
                  {model.display_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-200 uppercase tracking-wide mb-2 block">
              References ({selectedImageGroup.size + selectedGeneratedImages.size})
            </label>
            <div className="flex flex-wrap gap-2 p-2 rounded-lg bg-black/20 border border-white/10">
              {Array.from(selectedImageGroup)
                .slice(0, 8)
                .map((imgPath: string, idx: number) => (
                  <div key={`gallery-${idx}`} className="relative group">
                    <img src={imgPath} alt="" className="w-14 h-14 object-cover rounded" />
                    <button
                      onClick={() => {
                        const newSelection = new Set(selectedImageGroup);
                        newSelection.delete(imgPath);
                        setSelectedImageGroup(newSelection);
                      }}
                      className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} className="text-white" />
                    </button>
                  </div>
                ))}
              {Array.from(selectedGeneratedImages)
                .slice(0, 4)
                .map((index: number) => (
                  <div key={`gen-${index}`} className="relative group">
                    <img
                      src={generatedImages[index]}
                      className="w-14 h-14 object-cover rounded border-2 border-purple-500"
                      alt=""
                    />
                    <button
                      onClick={() => handleImageSelect(index, false)}
                      className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} className="text-white" />
                    </button>
                  </div>
                ))}
              <button
                onClick={async () => {
                  try {
                    const result = await (window as any).api?.showOpenDialog?.({
                      properties: ['openFile', 'multiSelections'],
                      filters: [
                        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] },
                        { name: 'All Files', extensions: ['*'] },
                      ],
                      defaultPath: currentPath || undefined,
                    });
                    const picked: string[] = Array.isArray(result)
                      ? result.map((r: any) => r?.path || r).filter(Boolean)
                      : result?.filePaths || [];
                    if (picked.length) {
                      const next = new Set(selectedImageGroup);
                      picked.forEach((p: string) =>
                        next.add(
                          p.startsWith('media://') || p.startsWith('file://')
                            ? p
                            : `media://${p}`
                        )
                      );
                      setSelectedImageGroup(next);
                    }
                  } catch (err) {
                    console.error('Add reference failed:', err);
                  }
                }}
                className="w-14 h-14 rounded border-2 border-dashed border-white/20 hover:border-purple-500 hover:bg-purple-500/10 flex items-center justify-center text-white/70 hover:text-purple-200 transition-colors"
                title="Add reference from files (project or global)"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          <details className="group">
            <summary className="text-xs font-medium text-gray-200 uppercase tracking-wide cursor-pointer flex items-center gap-2 select-none">
              <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
              Output Settings
            </summary>
            <div className="mt-3 space-y-3 pl-4">
              <div>
                <label className="text-xs text-gray-200 mb-1 block">Save Location</label>
                <select
                  value={activeSourceId}
                  onChange={(e) => setActiveSourceId(e.target.value)}
                  className="w-full theme-input text-xs"
                >
                  {imageSources.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  {imageSources.length === 0 && (
                    <option value="">No folders tracked</option>
                  )}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-200 mb-1 block">Filename Prefix</label>
                <input
                  type="text"
                  value={generateFilename}
                  onChange={(e) => setGenerateFilename(e.target.value)}
                  placeholder="vixynt_gen"
                  className="w-full theme-input text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Number of Images</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setNumImagesToGenerate(n)}
                      className={`flex-1 py-1.5 text-sm rounded ${
                        numImagesToGenerate === n
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <input
                    type="number"
                    value={numImagesToGenerate}
                    onChange={(e) =>
                      setNumImagesToGenerate(
                        Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1))
                      )
                    }
                    min="1"
                    max="10"
                    className="w-16 theme-input text-sm text-center"
                  />
                </div>
              </div>
            </div>
          </details>
        </div>

        <div className="p-4 border-t theme-border bg-black/20">
          <button
            onClick={async () => {
              if (!generatePrompt || !numImagesToGenerate) return;
              setGenerating(true);
              try {
                const baseFilename = generateFilename || 'vixynt_gen';
                const attachments = [
                  ...Array.from(selectedImageGroup).map((path: string) => ({
                    path: path.replace('media://', ''),
                  })),
                ];
                const outputPath = activeSource?.path || currentPath;
                const response = await (window as any).api.generateImages(
                  generatePrompt,
                  numImagesToGenerate,
                  selectedModel,
                  selectedProvider,
                  attachments,
                  baseFilename,
                  outputPath,
                  { workspacePath: currentPath }
                );

                if (response.error) {
                  throw new Error(response.error);
                }

                if (response.filenames && response.filenames.length > 0) {
                  const imagePaths = response.filenames.map((p: string) => `media://${p}`);
                  setGeneratedImages(imagePaths);
                  setGeneratedFilenames(response.filenames);
                } else if (response.images && response.images.length > 0) {
                  setGeneratedImages(response.images);
                  setGeneratedFilenames([]);
                } else {
                  setGeneratedImages([]);
                  setGeneratedFilenames([]);
                }
              } catch (e: any) {
                setError('Generation failed: ' + e.message);
              } finally {
                setGenerating(false);
              }
            }}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            disabled={!generatePrompt || generating}
          >
            {generating ? (
              <>
                <Loader size={18} className="animate-spin" />
                Generating {numImagesToGenerate} image
                {numImagesToGenerate > 1 ? 's' : ''}...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Generate {numImagesToGenerate} Image
                {numImagesToGenerate > 1 ? 's' : ''}
              </>
            )}
          </button>
          {selectedGeneratedImages.size === 1 && (
            <button
              onClick={handleUseSelected}
              className="w-full mt-2 py-2 rounded-lg border border-white/20 text-sm hover:bg-white/10 transition-colors"
            >
              Edit in DarkRoom
            </button>
          )}
        </div>
      </div>

      <div ref={rightRef} className="min-w-0 flex flex-col overflow-hidden theme-bg-primary">
        {generatedImages.length > 0 && (
          <div className="p-3 border-b theme-border flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {generatedImages.length} generated image{generatedImages.length > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setGeneratedImages([])}
              className="px-3 py-1.5 text-xs rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={12} /> Clear All
            </button>
          </div>
        )}

        <div className="flex-1 p-4 overflow-y-auto">
          {generating && generatedImages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin" />
                <Sparkles size={24} className="absolute inset-0 m-auto text-purple-400" />
              </div>
              <p className="mt-4 text-gray-400">
                Creating your image{numImagesToGenerate > 1 ? 's' : ''}...
              </p>
              <p className="text-xs text-gray-600 mt-1">This may take a moment</p>
            </div>
          )}
          {!generating && generatedImages.length > 0 && (
            <div className={`grid ${gridColsClass} gap-4 w-full`}>
              {generatedImages.map((imgSrc: string, index: number) => (
                <div
                  key={index}
                  className="relative group rounded-xl overflow-hidden bg-black/20 aspect-square"
                >
                  <img
                    src={imgSrc}
                    className="w-full h-full object-cover"
                    alt={`Generated image ${index + 1}`}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleImageSelect(index, !selectedGeneratedImages.has(index))}
                      className={`p-2 rounded-lg ${
                        selectedGeneratedImages.has(index)
                          ? 'bg-purple-500'
                          : 'bg-white/20 hover:bg-white/30'
                      } transition-colors`}
                      title="Select for reference"
                    >
                      <Check size={16} />
                    </button>
                    <a
                      className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                      href={imgSrc}
                      download={`${generateFilename}_${index}.png`}
                      title="Download"
                    >
                      <Download size={16} />
                    </a>
                    <button
                      onClick={() => {
                        setSelectedImage(imgSrc);
                        setActiveTab('editor');
                      }}
                      className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                      title="Edit in DarkRoom"
                    >
                      <Edit size={16} />
                    </button>
                  </div>
                  {selectedGeneratedImages.has(index) && (
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                      <Check size={14} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {!generating && generatedImages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-24 h-24 rounded-full bg-purple-600/10 flex items-center justify-center mb-4">
                <Sparkles size={40} className="text-purple-400/50" />
              </div>
              <p className="text-gray-400 text-lg">Your generated images will appear here</p>
              <p className="text-gray-600 text-sm mt-1">
                Enter a prompt and click Generate to start
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageGenerator;
