import { useState, useEffect } from 'react';
import { detectBrowser, type BrowserInfo } from '../utils/browserDetection';

/**
 * Hook for browser detection with client-side hydration safety
 * @returns Browser information object
 */
export const useBrowserDetection = () => {
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo>({
    name: 'Unknown',
    isSafari: false,
    isChrome: false,
    isFirefox: false,
    isEdge: false,
    isSupported: true, // Default to supported on server
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only run browser detection on the client side
    if (typeof window !== 'undefined') {
      const info = detectBrowser();
      setBrowserInfo(info);
    }
    setIsLoading(false);
  }, []);

  return {
    ...browserInfo,
    isLoading,
  };
};

/**
 * Hook specifically for Safari detection
 * @returns Object with Safari detection state
 */
export const useSafariDetection = () => {
  const { isSafari, isLoading } = useBrowserDetection();
  
  return {
    isSafari,
    isLoading,
  };
};
