import type { Constitution, ConstitutionSection } from '../types/firestore';

export interface EnhancedPDFOptions {
  quality: number;
  scale: number;
  format: 'A4' | 'Letter';
  margin: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  printBackground: boolean;
  compression: 'none' | 'low' | 'medium' | 'high';
  dpi: number;
  method: 'native' | 'screenshots';
}

export const defaultEnhancedOptions: EnhancedPDFOptions = {
  quality: 100,
  scale: 2,
  format: 'Letter',
  margin: {
    top: '1in',
    right: '1in',
    bottom: '1in',
    left: '1in'
  },
  printBackground: true,
  compression: 'medium',
  dpi: 300,
  method: 'native'
};

export class EnhancedPDFExporter {
  private constitution: Constitution | null;
  private sections: ConstitutionSection[];
  private options: EnhancedPDFOptions;
  private onProgress?: (progress: number, status: string) => void;
  private abortController: AbortController | null = null;

  constructor(
    constitution: Constitution | null,
    sections: ConstitutionSection[],
    options: Partial<EnhancedPDFOptions> = {},
    onProgress?: (progress: number, status: string) => void
  ) {
    this.constitution = constitution;
    this.sections = sections;
    this.options = { ...defaultEnhancedOptions, ...options };
    this.onProgress = onProgress;
  }

  /**
   * Main export function that uses server-side Puppeteer
   */
  async exportToPDF(): Promise<void> {
    this.abortController = new AbortController();

    try {
      this.reportProgress(0, 'Preparing PDF export request...');

      const endpoint = this.options.method === 'screenshots' 
        ? '/api/export-pdf-puppeteer' 
        : '/api/export-pdf-puppeteer';
      
      const method = this.options.method === 'screenshots' ? 'PUT' : 'POST';

      this.reportProgress(10, 'Sending request to server...');

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          constitution: this.constitution,
          sections: this.sections,
          options: this.options
        }),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('PDF export failed:', errorData);
        throw new Error(errorData.error || `Server error: ${response.status} - ${errorData.details || 'Unknown error'}`);
      }

      this.reportProgress(70, 'Receiving PDF from server...');

      // Get the PDF blob
      const pdfBlob = await response.blob();

      if (pdfBlob.size === 0) {
        throw new Error('Received empty PDF from server');
      }

      this.reportProgress(90, 'Preparing PDF for download and print...');

      // Create object URL and trigger download + print dialog
      await this.handlePDFDownloadAndPrint(pdfBlob);
      
      this.reportProgress(100, 'PDF export completed successfully!');
      
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.reportProgress(0, 'PDF export cancelled');
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Enhanced PDF export failed:', error);
        this.reportProgress(0, `PDF export failed: ${errorMessage}`);
      throw error;
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Export with real-time progress tracking
   */
  async exportWithProgress(): Promise<void> {
    this.abortController = new AbortController();

    try {
      this.reportProgress(0, 'Initializing enhanced PDF export...');

      // Simulate more granular progress for better UX
      const progressSteps = [
        { progress: 5, status: 'Validating document structure...' },
        { progress: 15, status: 'Launching high-resolution browser...' },
        { progress: 25, status: 'Loading fonts and assets...' },
        { progress: 40, status: 'Rendering pages at high DPI...' },
        { progress: 60, status: 'Capturing screenshots...' },
        { progress: 80, status: 'Assembling PDF document...' },
        { progress: 95, status: 'Optimizing file size...' }
      ];

      // Show initial progress steps
      for (const step of progressSteps.slice(0, 3)) {
        this.reportProgress(step.progress, step.status);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const endpoint = this.options.method === 'screenshots' 
        ? '/api/export-pdf-puppeteer' 
        : '/api/export-pdf-puppeteer';
      
      const method = this.options.method === 'screenshots' ? 'PUT' : 'POST';

      // Continue with server processing
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          constitution: this.constitution,
          sections: this.sections,
          options: this.options
        }),
        signal: this.abortController.signal
      });

      // Show remaining progress steps
      for (const step of progressSteps.slice(3)) {
        this.reportProgress(step.progress, step.status);
        await new Promise(resolve => setTimeout(resolve, 150));
      }

             if (!response.ok) {
         const errorData = await response.json().catch(() => ({}));
         console.error('PDF export failed:', errorData);
         throw new Error(errorData.error || `Server error: ${response.status} - ${errorData.details || 'Unknown error'}`);
       }

       const pdfBlob = await response.blob();
      await this.handlePDFDownloadAndPrint(pdfBlob);

      this.reportProgress(100, 'Enhanced PDF export completed!');

    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.reportProgress(0, 'PDF export cancelled');
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Enhanced PDF export failed:', error);
        this.reportProgress(0, `Export failed: ${errorMessage}`);
        throw error;
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Handle PDF download and automatic print dialog launch
   */
  private async handlePDFDownloadAndPrint(pdfBlob: Blob): Promise<void> {
    const url = URL.createObjectURL(pdfBlob);
    const filename = this.generateFilename();

    try {
      // Method 1: Open in new window with print dialog
      const printWindow = window.open('', '_blank');
      
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${filename}</title>
            <style>
              body { margin: 0; padding: 0; }
              embed { width: 100vw; height: 100vh; }
            </style>
          </head>
          <body>
            <embed src="${url}" type="application/pdf" />
            <script>
              // Auto-trigger print dialog when PDF loads
              window.addEventListener('load', function() {
                setTimeout(function() {
                  window.print();
                }, 1000);
              });
            </script>
          </body>
          </html>
        `);
        
        printWindow.document.close();
      }

      // Method 2: Create download link as fallback
      await this.createDownloadLink(url, filename);

      // Method 3: Try to open PDF in iframe and print (for browsers that support it)
      if (this.supportsEmbeddedPDFPrint()) {
        await this.tryEmbeddedPDFPrint(url);
      }

    } catch (error) {
      console.warn('Some PDF display methods failed:', error);
      // Ensure download still works
      await this.createDownloadLink(url, filename);
    }

    // Clean up URL after delay
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 120000); // 2 minutes cleanup
  }

  /**
   * Try embedded PDF print for supported browsers
   */
  private async tryEmbeddedPDFPrint(url: string): Promise<void> {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-1000px';
      iframe.style.left = '-1000px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.src = url;

      iframe.onload = () => {
        try {
          setTimeout(() => {
            iframe.contentWindow?.print();
            setTimeout(() => {
              document.body.removeChild(iframe);
              resolve();
            }, 2000);
          }, 1000);
        } catch (error) {
          document.body.removeChild(iframe);
          resolve();
        }
      };

      iframe.onerror = () => {
        document.body.removeChild(iframe);
        resolve();
      };

      document.body.appendChild(iframe);
    });
  }

  /**
   * Check if browser supports embedded PDF printing
   */
  private supportsEmbeddedPDFPrint(): boolean {
    // Check for common browsers that support PDF embedding
    const userAgent = navigator.userAgent.toLowerCase();
    return (
      userAgent.includes('chrome') || 
      userAgent.includes('edge') || 
      userAgent.includes('firefox')
    ) && !userAgent.includes('mobile');
  }

  /**
   * Create download link
   */
  private async createDownloadLink(url: string, filename: string): Promise<void> {
    return new Promise((resolve) => {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      link.target = '_blank';
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        resolve();
      }, 100);
    });
  }

  /**
   * Try fallback export method when Puppeteer fails
   */
  private async tryFallbackExport(): Promise<void> {
    this.reportProgress(10, 'Trying fallback export method...');
    
    try {
      const response = await fetch('/api/export-pdf-fallback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          constitution: this.constitution,
          sections: this.sections,
          options: this.options
        }),
        signal: this.abortController?.signal
      });

      if (!response.ok) {
        throw new Error('Fallback export also failed');
      }

      this.reportProgress(70, 'Receiving fallback HTML...');
      const htmlBlob = await response.blob();

      this.reportProgress(90, 'Opening fallback document...');
      const url = URL.createObjectURL(htmlBlob);
      
      // Open HTML in new window for printing
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 1000);
        };
      }

      // Also create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = this.generateFilename().replace('.pdf', '.html');
      link.click();

      this.reportProgress(100, 'Fallback export completed!');

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60000);

    } catch (error) {
      throw new Error('Both primary and fallback export methods failed');
    }
  }

  /**
   * Generate filename with metadata
   */
  private generateFilename(): string {
    const date = new Date().toISOString().split('T')[0];
    const version = this.constitution?.version || 1;
    const method = this.options.method === 'screenshots' ? '_HiRes' : '';
    const quality = this.options.dpi > 200 ? '_HighDPI' : '';
    
    return `IEEE_UCSD_Constitution_${date}_v${version}${method}${quality}.pdf`;
  }

  /**
   * Cancel current export operation
   */
  cancelExport(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Report progress to callback
   */
  private reportProgress(progress: number, status: string): void {
    if (this.onProgress) {
      this.onProgress(Math.round(progress), status);
    }
  }
}

/**
 * Convenience functions for different export methods
 */
export const exportWithEnhancedPDF = async (
  constitution: Constitution | null,
  sections: ConstitutionSection[],
  options?: Partial<EnhancedPDFOptions>,
  onProgress?: (progress: number, status: string) => void
): Promise<void> => {
  const exporter = new EnhancedPDFExporter(constitution, sections, options, onProgress);
  return exporter.exportToPDF();
};

export const exportWithHighResScreenshots = async (
  constitution: Constitution | null,
  sections: ConstitutionSection[],
  options?: Partial<EnhancedPDFOptions>,
  onProgress?: (progress: number, status: string) => void
): Promise<void> => {
  const enhancedOptions = { ...options, method: 'screenshots' as const };
  const exporter = new EnhancedPDFExporter(constitution, sections, enhancedOptions, onProgress);
  return exporter.exportWithProgress();
};

export const exportWithProgressiveEnhancement = async (
  constitution: Constitution | null,
  sections: ConstitutionSection[],
  options?: Partial<EnhancedPDFOptions>,
  onProgress?: (progress: number, status: string) => void
): Promise<void> => {
  const exporter = new EnhancedPDFExporter(constitution, sections, options, onProgress);
  return exporter.exportWithProgress();
};

/**
 * PDF Quality preset configurations
 */
export const PDFQualityPresets = {
  standard: {
    quality: 85,
    scale: 1.5,
    dpi: 150,
    compression: 'medium' as const,
    method: 'native' as const
  },
  high: {
    quality: 95,
    scale: 2,
    dpi: 300,
    compression: 'low' as const,
    method: 'native' as const
  },
  premium: {
    quality: 100,
    scale: 3,
    dpi: 600,
    compression: 'none' as const,
    method: 'screenshots' as const
  },
  print: {
    quality: 100,
    scale: 2,
    dpi: 300,
    compression: 'low' as const,
    method: 'screenshots' as const
  }
}; 