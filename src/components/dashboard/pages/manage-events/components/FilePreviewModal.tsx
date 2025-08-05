import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react';
import { extractFilename, isImageFile, isPdfFile } from '../utils/filenameUtils';

interface FilePreviewModalProps {
  url: string | null;
  onClose: () => void;
  filename?: string;
}

export default function FilePreviewModal({ url, onClose, filename }: FilePreviewModalProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const extractedFilename = filename || (url ? extractFilename(url) : 'file');
  const isImage = url ? isImageFile(extractedFilename) : false;
  const isPdf = url ? isPdfFile(extractedFilename) : false;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [onClose]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 25));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleFullscreen = async () => {
    const element = document.getElementById('file-preview-container');
    if (!element) return;

    try {
      if (!document.fullscreenElement) {
        await element.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const resetView = () => {
    setZoom(100);
    setRotation(0);
  };

  if (!url) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4">
      <div 
        id="file-preview-container"
        className={`bg-white rounded-lg w-full h-full max-w-6xl max-h-[95vh] flex flex-col ${
          isFullscreen ? 'max-w-none max-h-none rounded-none' : ''
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex justify-between items-center z-10 rounded-t-lg">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate" title={extractedFilename}>
              {extractedFilename}
            </h3>
            <p className="text-sm text-gray-500">
              {isImage ? 'Image' : isPdf ? 'PDF Document' : 'Document'} Preview
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2 ml-4">
            {isImage && (
              <>
                <button
                  onClick={handleZoomOut}
                  disabled={zoom <= 25}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600 min-w-[3rem] text-center">
                  {zoom}%
                </span>
                <button
                  onClick={handleZoomIn}
                  disabled={zoom >= 300}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRotate}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                  title="Rotate"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={resetView}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                  title="Reset view"
                >
                  Reset
                </button>
              </>
            )}

            <div className="w-px h-6 bg-gray-300 mx-2"></div>

            <button
              onClick={handleFullscreen}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-100 rounded"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <a
              href={url}
              download={extractedFilename}
              className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded"
              title="Download file"
            >
              <Download className="w-4 h-4" />
            </a>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-4">
          {isImage && (
            <div className="flex items-center justify-center w-full h-full">
              <img
                src={url}
                alt={extractedFilename}
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transformOrigin: 'center'
                }}
                loading="lazy"
              />
            </div>
          )}

          {isPdf && (
            <div className="w-full h-full">
              <iframe
                src={`${url}#toolbar=1&navpanes=1&scrollbar=1`}
                className="w-full h-full border-0 rounded"
                title={`PDF Preview: ${extractedFilename}`}
                loading="lazy"
              />
            </div>
          )}

          {!isImage && !isPdf && (
            <div className="text-center">
              <div className="bg-white rounded-lg p-8 shadow-lg max-w-md">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Preview Not Available</h3>
                <p className="text-gray-600 mb-4">
                  This file type cannot be previewed in the browser.
                </p>
                <div className="space-y-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in New Tab
                  </a>
                  <br />
                  <a
                    href={url}
                    download={extractedFilename}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download File
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 py-2 border-t rounded-b-lg">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>File: {extractedFilename}</span>
            <span>Press ESC to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
