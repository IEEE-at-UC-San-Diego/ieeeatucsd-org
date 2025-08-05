import React from 'react';
import { Eye, Download, ExternalLink, FileText, Image } from 'lucide-react';
import { truncateFilename, extractFilename, isImageFile, isPdfFile } from '../utils/filenameUtils';
import { EventAuditService } from '../../../shared/services/eventAuditService';
import { auth } from '../../../../../firebase/client';

interface EnhancedFileViewerProps {
  url: string;
  filename?: string;
  eventRequestId?: string;
  onPreview?: (url: string) => void;
  showAuditLogging?: boolean;
  className?: string;
}

export default function EnhancedFileViewer({
  url,
  filename,
  eventRequestId,
  onPreview,
  showAuditLogging = true,
  className = ''
}: EnhancedFileViewerProps) {
  const extractedFilename = filename || extractFilename(url);
  const displayName = truncateFilename(extractedFilename);
  const isImage = isImageFile(extractedFilename);
  const isPdf = isPdfFile(extractedFilename);

  const logFileView = async (action: string) => {
    if (!showAuditLogging || !eventRequestId) return;
    
    try {
      const userName = await EventAuditService.getUserName(auth.currentUser?.uid || '');
      await EventAuditService.logFileView(
        eventRequestId,
        auth.currentUser?.uid || '',
        extractedFilename,
        getFileType(extractedFilename),
        userName,
        { action, url }
      );
    } catch (error) {
      console.error('Failed to log file view:', error);
    }
  };

  const getFileType = (filename: string): string => {
    if (isImageFile(filename)) return 'image';
    if (isPdfFile(filename)) return 'pdf';
    return 'document';
  };

  const getFileIcon = () => {
    if (isImage) {
      return <Image className="w-5 h-5 text-blue-500" />;
    } else if (isPdf) {
      return <FileText className="w-5 h-5 text-red-500" />;
    } else {
      return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const handlePreview = () => {
    logFileView('preview');
    if (onPreview) {
      onPreview(url);
    }
  };

  const handleDownload = () => {
    logFileView('download');
  };

  const handleExternalOpen = () => {
    logFileView('external_open');
  };

  return (
    <div className={`border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {getFileIcon()}
          <span 
            className="text-sm font-medium text-gray-700 truncate"
            title={extractedFilename}
          >
            {displayName}
          </span>
        </div>
        <div className="flex space-x-2 flex-shrink-0">
          <button
            onClick={handlePreview}
            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-100 transition-colors"
            title="Preview file"
          >
            <Eye className="w-4 h-4" />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleExternalOpen}
            className="text-purple-600 hover:text-purple-800 p-1 rounded hover:bg-purple-100 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href={url}
            download={extractedFilename}
            onClick={handleDownload}
            className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-100 transition-colors"
            title="Download file"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* File Preview Thumbnail */}
      {isImage && (
        <div 
          className="w-full h-32 rounded cursor-pointer overflow-hidden"
          onClick={handlePreview}
        >
          <img
            src={url}
            alt={extractedFilename}
            className="w-full h-full object-cover hover:scale-105 transition-transform"
            loading="lazy"
          />
        </div>
      )}

      {isPdf && (
        <div 
          className="w-full h-32 bg-red-100 rounded flex items-center justify-center cursor-pointer hover:bg-red-200 transition-colors"
          onClick={handlePreview}
        >
          <div className="text-center">
            <FileText className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <span className="text-red-600 font-medium text-sm">PDF Document</span>
          </div>
        </div>
      )}

      {!isImage && !isPdf && (
        <div 
          className="w-full h-32 bg-gray-200 rounded flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors"
          onClick={handlePreview}
        >
          <div className="text-center">
            <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <span className="text-gray-600 font-medium text-sm">Document</span>
          </div>
        </div>
      )}

      {/* File Info */}
      <div className="mt-3 text-xs text-gray-500">
        <div className="flex justify-between items-center">
          <span>Type: {getFileType(extractedFilename).toUpperCase()}</span>
          <span className="truncate ml-2" title={extractedFilename}>
            {extractedFilename.length > 20 ? '...' + extractedFilename.slice(-15) : extractedFilename}
          </span>
        </div>
      </div>
    </div>
  );
}
