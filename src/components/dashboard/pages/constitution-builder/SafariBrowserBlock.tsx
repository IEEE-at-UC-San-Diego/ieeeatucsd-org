import React from 'react';
import { AlertTriangle, ExternalLink, Chrome } from 'lucide-react';
import { getChromeDownloadUrl } from './utils/browserDetection';
import { useSafariDetection } from './hooks/useBrowserDetection';

interface SafariBrowserBlockProps {
  className?: string;
}

const SafariBrowserBlock: React.FC<SafariBrowserBlockProps> = ({ className = '' }) => {
  const { isSafari: isSafariBrowser, isLoading: browserLoading } = useSafariDetection();

  const handleChromeDownload = () => {
    window.open(getChromeDownloadUrl(), '_blank', 'noopener,noreferrer');
  };

  // Don't render the block if not Safari or still loading
  if (browserLoading || !isSafariBrowser) {
    return null;
  }

  return (
    <div className={`min-h-[60vh] flex items-center justify-center p-6 ${className}`}>
      <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        {/* Error Icon */}
        <div className="flex justify-center mb-4">
          <AlertTriangle className="h-12 w-12 text-red-600" />
        </div>

        {/* Content */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-red-800">
            Browser Not Supported
          </h2>

          <p className="text-sm text-red-700">
            The Constitution Builder requires <strong>Google Chrome</strong> for optimal functionality.
            Safari is not supported due to compatibility issues with essential features.
          </p>

          {/* Issues that prevent functionality */}
          <div className="text-xs text-red-600 bg-red-100 rounded-md p-3">
            <p className="font-medium mb-2">Safari limitations:</p>
            <ul className="list-disc list-inside space-y-1 text-left">
              <li>PDF export functionality fails</li>
              <li>Rich text editor has critical issues</li>
              <li>Print functionality is unreliable</li>
              <li>Auto-save features don't work properly</li>
              <li>File operations may fail</li>
            </ul>
          </div>

          {/* Action button */}
          <div className="pt-2">
            <button
              onClick={handleChromeDownload}
              className="inline-flex items-center px-4 py-3 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors w-full justify-center"
            >
              <Chrome className="h-5 w-5 mr-2" />
              Download Chrome Browser
              <ExternalLink className="h-4 w-4 ml-2" />
            </button>
          </div>

          <p className="text-xs text-red-600">
            Once you've installed Chrome, please return to this page to access the Constitution Builder.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SafariBrowserBlock;
