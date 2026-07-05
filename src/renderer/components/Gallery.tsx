import React from 'react';
import { Check, Loader } from 'lucide-react';
import { ImageGrid } from 'npcts';
import { getFileName } from './utils';

const IMAGES_PER_PAGE = 24;

interface GalleryProps {
  sortedAndFilteredImages: string[];
  selectedImageGroup: Set<string>;
  viewMode: string;
  sortBy: string;
  setSortBy: (v: string) => void;
  sortOrder: string;
  setSortOrder: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  displayedImagesCount: number;
  setDisplayedImagesCount: (v: number | ((prev: number) => number)) => void;
  renamingImage: { path: string | null; newName: string };
  setRenamingImage: (v: any) => void;
  imageMetaCache: Record<string, any>;
  loading: boolean;
  handleImageClick: (e: any, imgPath: string, index: number) => void;
  handleImageDoubleClick: (e: any, imgPath: string, index: number) => void;
  handleContextMenu: (e: any, imgPath: string) => void;
  handleRenameSubmit: () => void;
  formatFileSize: (bytes: number) => string;
  formatDate: (dateVal: any) => string;
  setActiveTab: (tab: string) => void;
}

const Gallery: React.FC<GalleryProps> = ({
  sortedAndFilteredImages,
  selectedImageGroup,
  viewMode,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  filterType,
  setFilterType,
  displayedImagesCount,
  setDisplayedImagesCount,
  renamingImage,
  setRenamingImage,
  imageMetaCache,
  loading,
  handleImageClick,
  handleImageDoubleClick,
  handleContextMenu,
  handleRenameSubmit,
  formatFileSize,
  formatDate,
  setActiveTab,
}) => (
  <div className="flex-1 flex flex-col overflow-hidden">
    <div className="flex items-center justify-between px-4 py-2 border-b theme-border theme-bg-secondary/40">
      <div className="flex items-center gap-2 text-xs theme-text-muted">
        <span>{sortedAndFilteredImages.length} items</span>
        {selectedImageGroup.size > 0 && (
          <span>• {selectedImageGroup.size} selected</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-xs theme-text-muted">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="theme-input text-xs py-1"
          >
            <option value="name">Name</option>
            <option value="type">Type</option>
            <option value="size">Size</option>
            <option value="date">Date</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="theme-button px-2 py-1 text-xs"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs theme-text-muted">Type:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="theme-input text-xs py-1"
          >
            <option value="all">All</option>
            <option value="jpg">JPG</option>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
            <option value="gif">GIF</option>
          </select>
        </div>
      </div>
    </div>

    <div className="flex-1 p-4 overflow-y-auto">
      {viewMode === 'grid' ? (
        <ImageGrid
          images={sortedAndFilteredImages.slice(0, displayedImagesCount)}
          selected={selectedImageGroup}
          onSelect={(img: string, e: any) => {
            const index = sortedAndFilteredImages.indexOf(img);
            handleImageClick(e, img, index);
          }}
          onContextMenu={(img: string, e: any) => handleContextMenu(e, img)}
          columns={{ sm: 2, md: 4, lg: 8 }}
          gap={16}
          showFilename={false}
          loading={loading}
          emptyMessage="No images found."
          renderItem={(img: string, isSelected: boolean) => {
            const isRenaming = renamingImage.path === img;
            if (isRenaming) {
              return (
                <div className="relative aspect-square">
                  <input
                    type="text"
                    value={renamingImage.newName}
                    onChange={(e) => setRenamingImage((p: any) => ({ ...p, newName: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
                    onBlur={handleRenameSubmit}
                    className="w-full h-full p-2 theme-input text-xs"
                    autoFocus
                  />
                </div>
              );
            }
            const index = sortedAndFilteredImages.indexOf(img);
            return (
              <div
                className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer group ${
                  isSelected ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-blue-500' : ''
                }`}
                onDoubleClick={(e) => handleImageDoubleClick(e, img, index)}
              >
                <img src={img} alt="" className="w-full h-full object-cover theme-bg-secondary" draggable={false} />
                <div
                  className={`absolute inset-0 transition-all duration-200 pointer-events-none ${
                    !isSelected ? 'group-hover:bg-black/40' : ''
                  }`}
                />
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-1">
                    <Check size={12} className="text-white" />
                  </div>
                )}
              </div>
            );
          }}
        />
      ) : (
        <div className="space-y-1 w-full">
          <div className="flex gap-2 px-2 py-1 text-xs font-semibold theme-text-secondary border-b theme-border">
            <div className="w-12 flex-shrink-0"></div>
            <div className="w-[420px] flex-shrink-0 truncate">Name</div>
            <div className="flex-1 min-w-0 truncate">Type</div>
            <div className="flex-1 min-w-0 truncate">Size</div>
            <div className="flex-1 min-w-0 truncate">Date</div>
          </div>

          {loading ? (
            <div className="flex justify-center p-8">
              <Loader className="animate-spin" />
            </div>
          ) : sortedAndFilteredImages.length > 0 ? (
            sortedAndFilteredImages.slice(0, displayedImagesCount).map((img, index) => {
              const isSelected = selectedImageGroup.has(img);
              const isRenaming = renamingImage.path === img;
              const filename = getFileName(img);
              const ext = filename.split('.').pop()?.toUpperCase();
              const meta = imageMetaCache[img] || {};

              return (
                <div
                  key={img}
                  onClick={(e) => handleImageClick(e, img, index)}
                  onDoubleClick={(e) => handleImageDoubleClick(e, img, index)}
                  onContextMenu={(e) => handleContextMenu(e, img)}
                  className={`flex gap-2 px-2 py-2 rounded cursor-pointer items-center ${
                    isSelected ? 'bg-blue-900/30 ring-1 ring-blue-500' : 'theme-hover'
                  }`}
                >
                  <div className="w-12 flex-shrink-0">
                    <img src={img} alt="" className="w-10 h-10 object-cover rounded" />
                  </div>
                  <div className="w-[420px] flex-shrink-0 truncate text-sm">
                    {isRenaming ? (
                      <input
                        type="text"
                        value={renamingImage.newName}
                        onChange={(e) => setRenamingImage((p: any) => ({ ...p, newName: e.target.value }))}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') handleRenameSubmit();
                          if (e.key === 'Escape') setRenamingImage({ path: null, newName: '' });
                        }}
                        onBlur={handleRenameSubmit}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full theme-input text-xs py-1"
                        autoFocus
                      />
                    ) : (
                      <span title={filename}>{filename}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-xs theme-text-muted truncate">{ext}</div>
                  <div className="flex-1 min-w-0 text-xs theme-text-muted truncate">{formatFileSize(meta?.size)}</div>
                  <div className="flex-1 min-w-0 text-xs theme-text-muted truncate">{formatDate(meta?.mtime)}</div>
                </div>
              );
            })
          ) : (
            <div className="text-center p-8 theme-text-muted">No images found.</div>
          )}
        </div>
      )}
    </div>

    {sortedAndFilteredImages.length > displayedImagesCount && (
      <div className="p-4 border-t theme-border text-center">
        <button
          onClick={() => setDisplayedImagesCount((prev) => prev + IMAGES_PER_PAGE)}
          className="theme-button px-4 py-2 text-sm rounded"
        >
          Load More ({sortedAndFilteredImages.length - displayedImagesCount} remaining)
        </button>
      </div>
    )}
  </div>
);

export default Gallery;
