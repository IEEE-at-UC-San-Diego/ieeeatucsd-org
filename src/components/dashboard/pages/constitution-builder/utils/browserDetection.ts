/**
 * Browser detection utilities for the dashboard
 */

export interface BrowserInfo {
  name: string;
  version?: string;
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  isEdge: boolean;
  isSupported: boolean;
}

/**
 * Detects the current browser with improved accuracy
 * @param userAgent - The user agent string (defaults to navigator.userAgent)
 * @returns Browser information object
 */
export const detectBrowser = (userAgent?: string): BrowserInfo => {
  const ua = userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  
  // Initialize browser info
  const browserInfo: BrowserInfo = {
    name: 'Unknown',
    isSafari: false,
    isChrome: false,
    isFirefox: false,
    isEdge: false,
    isSupported: false,
  };

  // Chrome detection (must come before Safari since Chrome contains "Safari" in UA)
  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    browserInfo.name = 'Chrome';
    browserInfo.isChrome = true;
    browserInfo.isSupported = true;
    
    const chromeMatch = ua.match(/Chrome\/(\d+)/);
    if (chromeMatch) {
      browserInfo.version = chromeMatch[1];
    }
  }
  // Edge detection (Chromium-based Edge)
  else if (ua.includes('Edg')) {
    browserInfo.name = 'Edge';
    browserInfo.isEdge = true;
    browserInfo.isSupported = true;
    
    const edgeMatch = ua.match(/Edg\/(\d+)/);
    if (edgeMatch) {
      browserInfo.version = edgeMatch[1];
    }
  }
  // Safari detection (must come after Chrome/Edge)
  else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    browserInfo.name = 'Safari';
    browserInfo.isSafari = true;
    browserInfo.isSupported = false; // Safari has compatibility issues
    
    const safariMatch = ua.match(/Version\/(\d+)/);
    if (safariMatch) {
      browserInfo.version = safariMatch[1];
    }
  }
  // Firefox detection
  else if (ua.includes('Firefox')) {
    browserInfo.name = 'Firefox';
    browserInfo.isFirefox = true;
    browserInfo.isSupported = true;
    
    const firefoxMatch = ua.match(/Firefox\/(\d+)/);
    if (firefoxMatch) {
      browserInfo.version = firefoxMatch[1];
    }
  }
  // Internet Explorer / Legacy Edge
  else if (ua.includes('MSIE') || ua.includes('Trident')) {
    browserInfo.name = 'Internet Explorer';
    browserInfo.isSupported = false;
  }

  return browserInfo;
};

/**
 * Checks if the current browser is Safari
 * @returns true if the browser is Safari
 */
export const isSafari = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return detectBrowser().isSafari;
};

/**
 * Checks if the current browser is supported for the constitution builder
 * @returns true if the browser is supported
 */
export const isBrowserSupported = (): boolean => {
  if (typeof navigator === 'undefined') return true; // Assume supported on server
  return detectBrowser().isSupported;
};

/**
 * Gets a user-friendly browser name
 * @param userAgent - Optional user agent string
 * @returns User-friendly browser name
 */
export const getBrowserName = (userAgent?: string): string => {
  return detectBrowser(userAgent).name;
};

/**
 * Gets the Chrome download URL
 * @returns Chrome download URL
 */
export const getChromeDownloadUrl = (): string => {
  return 'https://www.google.com/chrome/';
};
