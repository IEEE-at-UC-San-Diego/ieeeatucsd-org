import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { Constitution, ConstitutionSection } from '../types/firestore';
import { calculateTotalPages } from './printUtils';

export interface PDFExportOptions {
  quality: number;
  scale: number;
  useCORS: boolean;
  backgroundColor: string;
  removeContainer: boolean;
}

export const defaultPDFOptions: PDFExportOptions = {
  quality: 1.0,
  scale: 2, // Higher scale for better quality
  useCORS: true,
  backgroundColor: '#ffffff',
  removeContainer: false
};

export class PixelPerfectPDFExporter {
  private constitution: Constitution | null;
  private sections: ConstitutionSection[];
  private options: PDFExportOptions;
  private onProgress?: (progress: number, status: string) => void;

  constructor(
    constitution: Constitution | null,
    sections: ConstitutionSection[],
    options: Partial<PDFExportOptions> = {},
    onProgress?: (progress: number, status: string) => void
  ) {
    this.constitution = constitution;
    this.sections = sections;
    this.options = { ...defaultPDFOptions, ...options };
    this.onProgress = onProgress;
  }

  /**
   * Exports the constitution to PDF by capturing each page as rendered
   */
  async exportToPDF(): Promise<void> {
    try {
      this.reportProgress(0, 'Initializing PDF export...');
      
      const totalPages = calculateTotalPages(this.sections, true);
      const pdf = new jsPDF('portrait', 'pt', 'letter'); // 8.5" x 11" = 612 x 792 pt
      
      // Create a temporary preview container for capturing
      const captureContainer = await this.createCaptureContainer();
      
      try {
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          this.reportProgress((pageNum - 1) / totalPages * 100, `Capturing page ${pageNum} of ${totalPages}...`);
          
          // Render the specific page
          await this.renderPage(captureContainer, pageNum);
          
          // Wait for any images or fonts to load
          await this.waitForContentLoad();
          
          // Capture the page
          const canvas = await this.capturePage(captureContainer);
          
          // Add page to PDF (except for first page)
          if (pageNum > 1) {
            pdf.addPage();
          }
          
          // Add the captured image to PDF
          await this.addCanvasToPDF(pdf, canvas);
        }
        
        this.reportProgress(95, 'Generating PDF file...');
        
        // Generate filename with timestamp
        const filename = `IEEE_UCSD_Constitution_${new Date().toISOString().split('T')[0]}_v${this.constitution?.version || 1}.pdf`;
        
        // Save the PDF
        pdf.save(filename);
        
        this.reportProgress(100, 'PDF export completed successfully!');
        
      } finally {
        // Clean up the temporary container
        this.cleanupCaptureContainer(captureContainer);
      }
      
    } catch (error) {
      console.error('PDF export failed:', error);
      this.reportProgress(0, 'PDF export failed. Please try again.');
      throw error;
    }
  }

  /**
   * Creates a temporary container for capturing pages
   */
  private async createCaptureContainer(): Promise<HTMLElement> {
    const container = document.createElement('div');
    container.id = 'pdf-capture-container';
    container.style.cssText = `
      position: fixed;
      top: -10000px;
      left: -10000px;
      width: 8.5in;
      height: 11in;
      background: white;
      z-index: -1000;
      font-family: Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.6;
      padding: 1in;
      box-sizing: border-box;
      overflow: hidden;
    `;
    
    document.body.appendChild(container);
    return container;
  }

  /**
   * Renders a specific page in the capture container
   */
  private async renderPage(container: HTMLElement, pageNum: number): Promise<void> {
    return new Promise((resolve) => {
      // Find the existing preview component
      const previewElement = document.querySelector('.constitution-document');
      
      if (!previewElement) {
        throw new Error('Constitution preview not found');
      }

      // Create a temporary React root to render the page
      import('react-dom/client').then(({ createRoot }) => {
        import('react').then((React) => {
          import('../components/ConstitutionPreview').then(({ default: ConstitutionPreview }) => {
            
            const root = createRoot(container);
            
            // Render just the specific page content
            root.render(
              React.createElement(ConstitutionPreview, {
                constitution: this.constitution,
                sections: this.sections,
                onPrint: () => {},
                currentPage: pageNum,
                onPageChange: () => {},
                // Special prop to indicate PDF capture mode
                pdfCaptureMode: true
              })
            );
            
            // Wait for render to complete
            setTimeout(() => {
              resolve();
            }, 100);
          });
        });
      });
    });
  }

  /**
   * Waits for images and fonts to load
   */
  private async waitForContentLoad(): Promise<void> {
    return new Promise((resolve) => {
      // Wait for images to load
      const images = document.querySelectorAll('#pdf-capture-container img');
      let loadedImages = 0;
      const totalImages = images.length;

      if (totalImages === 0) {
        setTimeout(resolve, 50); // Small delay for fonts
        return;
      }

      const checkImageLoad = () => {
        loadedImages++;
        if (loadedImages >= totalImages) {
          setTimeout(resolve, 50); // Small delay for fonts
        }
      };

      images.forEach((img) => {
        if (img.complete) {
          checkImageLoad();
        } else {
          img.addEventListener('load', checkImageLoad);
          img.addEventListener('error', checkImageLoad);
        }
      });
    });
  }

  /**
   * Captures a page using html2canvas
   */
  private async capturePage(container: HTMLElement): Promise<HTMLCanvasElement> {
    const pageElement = container.querySelector('.constitution-page');
    
    if (!pageElement) {
      throw new Error('Constitution page element not found');
    }

    return html2canvas(pageElement as HTMLElement, {
      scale: this.options.scale,
      useCORS: this.options.useCORS,
      backgroundColor: this.options.backgroundColor,
      width: 612, // 8.5 inches at 72 DPI
      height: 792, // 11 inches at 72 DPI
      foreignObjectRendering: true,
      imageTimeout: 15000,
      removeContainer: this.options.removeContainer,
      logging: false,
      allowTaint: true,
      onclone: (clonedDoc) => {
        // Ensure fonts are loaded in cloned document
        const style = clonedDoc.createElement('style');
        style.textContent = `
          * { font-family: Arial, sans-serif !important; }
          .constitution-page { 
            font-family: Arial, sans-serif !important;
            font-size: 12pt !important;
            line-height: 1.6 !important;
          }
        `;
        clonedDoc.head.appendChild(style);
      }
    });
  }

  /**
   * Adds a canvas to the PDF
   */
  private async addCanvasToPDF(pdf: jsPDF, canvas: HTMLCanvasElement): Promise<void> {
    const imgData = canvas.toDataURL('image/png', this.options.quality);
    
    // PDF dimensions in points (72 DPI)
    const pdfWidth = 612; // 8.5 inches
    const pdfHeight = 792; // 11 inches
    
    // Calculate scaling to fit the page exactly
    const canvasAspectRatio = canvas.width / canvas.height;
    const pdfAspectRatio = pdfWidth / pdfHeight;
    
    let imgWidth = pdfWidth;
    let imgHeight = pdfHeight;
    let xOffset = 0;
    let yOffset = 0;
    
    // Maintain aspect ratio while fitting the page
    if (canvasAspectRatio > pdfAspectRatio) {
      imgHeight = pdfWidth / canvasAspectRatio;
      yOffset = (pdfHeight - imgHeight) / 2;
    } else {
      imgWidth = pdfHeight * canvasAspectRatio;
      xOffset = (pdfWidth - imgWidth) / 2;
    }
    
    pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight, undefined, 'FAST');
  }

  /**
   * Cleans up the temporary capture container
   */
  private cleanupCaptureContainer(container: HTMLElement): void {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }

  /**
   * Reports progress to the callback
   */
  private reportProgress(progress: number, status: string): void {
    if (this.onProgress) {
      this.onProgress(Math.round(progress), status);
    }
  }
}

/**
 * Convenience function for quick PDF export
 */
export const exportConstitutionToPDF = async (
  constitution: Constitution | null,
  sections: ConstitutionSection[],
  options?: Partial<PDFExportOptions>,
  onProgress?: (progress: number, status: string) => void
): Promise<void> => {
  const exporter = new PixelPerfectPDFExporter(constitution, sections, options, onProgress);
  return exporter.exportToPDF();
}; 