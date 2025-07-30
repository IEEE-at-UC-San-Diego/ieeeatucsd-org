/**
 * Tests for browser detection utilities
 */

import { detectBrowser, isSafari, isBrowserSupported, getBrowserName } from '../browserDetection';

describe('Browser Detection', () => {
  describe('detectBrowser', () => {
    it('should detect Chrome correctly', () => {
      const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const result = detectBrowser(chromeUA);
      
      expect(result.name).toBe('Chrome');
      expect(result.isChrome).toBe(true);
      expect(result.isSafari).toBe(false);
      expect(result.isSupported).toBe(true);
      expect(result.version).toBe('120');
    });

    it('should detect Safari correctly (excluding Chrome)', () => {
      const safariUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15';
      const result = detectBrowser(safariUA);
      
      expect(result.name).toBe('Safari');
      expect(result.isSafari).toBe(true);
      expect(result.isChrome).toBe(false);
      expect(result.isSupported).toBe(false);
      expect(result.version).toBe('17');
    });

    it('should detect Firefox correctly', () => {
      const firefoxUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0';
      const result = detectBrowser(firefoxUA);
      
      expect(result.name).toBe('Firefox');
      expect(result.isFirefox).toBe(true);
      expect(result.isSafari).toBe(false);
      expect(result.isSupported).toBe(true);
      expect(result.version).toBe('120');
    });

    it('should detect Edge correctly', () => {
      const edgeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      const result = detectBrowser(edgeUA);
      
      expect(result.name).toBe('Edge');
      expect(result.isEdge).toBe(true);
      expect(result.isChrome).toBe(false);
      expect(result.isSupported).toBe(true);
      expect(result.version).toBe('120');
    });

    it('should detect Internet Explorer correctly', () => {
      const ieUA = 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko';
      const result = detectBrowser(ieUA);
      
      expect(result.name).toBe('Internet Explorer');
      expect(result.isSupported).toBe(false);
    });

    it('should handle unknown browsers', () => {
      const unknownUA = 'SomeUnknownBrowser/1.0';
      const result = detectBrowser(unknownUA);
      
      expect(result.name).toBe('Unknown');
      expect(result.isSupported).toBe(false);
    });
  });

  describe('isSafari', () => {
    // Note: These tests would need to mock navigator.userAgent in a real test environment
    it('should return false when navigator is undefined', () => {
      // This test simulates server-side rendering
      const originalNavigator = global.navigator;
      delete (global as any).navigator;
      
      const result = isSafari();
      expect(result).toBe(false);
      
      // Restore navigator
      global.navigator = originalNavigator;
    });
  });

  describe('isBrowserSupported', () => {
    it('should return true when navigator is undefined (server-side)', () => {
      const originalNavigator = global.navigator;
      delete (global as any).navigator;
      
      const result = isBrowserSupported();
      expect(result).toBe(true);
      
      // Restore navigator
      global.navigator = originalNavigator;
    });
  });

  describe('getBrowserName', () => {
    it('should return correct browser names', () => {
      const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      expect(getBrowserName(chromeUA)).toBe('Chrome');
      
      const safariUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15';
      expect(getBrowserName(safariUA)).toBe('Safari');
    });
  });
});
