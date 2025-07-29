import puppeteer, { Browser, Page } from "puppeteer";
import type { Constitution, ConstitutionSection } from "../types/firestore";
import { calculateTotalPages, generatePrintHTML } from "./printUtils";

export interface PuppeteerPDFOptions {
  quality: number;
  scale: number;
  format: "A4" | "Letter";
  margin: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  printBackground: boolean;
  compression: "none" | "low" | "medium" | "high";
  dpi: number;
}

export const defaultPuppeteerOptions: PuppeteerPDFOptions = {
  quality: 100,
  scale: 2,
  format: "Letter",
  margin: {
    top: "1in",
    right: "1in",
    bottom: "1in",
    left: "1in",
  },
  printBackground: true,
  compression: "medium",
  dpi: 300,
};

export class PuppeteerPDFExporter {
  private constitution: Constitution | null;
  private sections: ConstitutionSection[];
  private options: PuppeteerPDFOptions;
  private onProgress?: (progress: number, status: string) => void;
  private browser: Browser | null = null;

  constructor(
    constitution: Constitution | null,
    sections: ConstitutionSection[],
    options: Partial<PuppeteerPDFOptions> = {},
    onProgress?: (progress: number, status: string) => void,
  ) {
    this.constitution = constitution;
    this.sections = sections;
    this.options = { ...defaultPuppeteerOptions, ...options };
    this.onProgress = onProgress;
  }

  /**
   * Main export function that captures high-resolution screenshots and generates PDF
   */
  async exportToPDF(): Promise<void> {
    try {
      this.reportProgress(0, "Initializing Puppeteer browser...");

      // Launch browser with optimized settings for PDF capture
      this.browser = await puppeteer.launch({
        headless: "new", // Use new headless mode for better performance
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          `--force-device-scale-factor=${this.options.scale}`,
        ],
        defaultViewport: {
          width: 850, // 8.5 inches at 100 DPI
          height: 1100, // 11 inches at 100 DPI
          deviceScaleFactor: this.options.scale,
        },
      });

      const page = await this.browser.newPage();

      // Set high DPI for crisp rendering
      await page.setViewport({
        width: 850,
        height: 1100,
        deviceScaleFactor: this.options.scale,
      });

      this.reportProgress(10, "Preparing document content...");

      // Generate the complete HTML content
      const htmlContent = generatePrintHTML(this.constitution, this.sections);

      // Set the content
      await page.setContent(htmlContent, {
        waitUntil: ["networkidle0", "domcontentloaded"],
        timeout: 30000,
      });

      // Ensure print media styles are applied
      await page.emulateMediaType("print");

      this.reportProgress(30, "Waiting for fonts and images to load...");

      // Wait for fonts and images to load
      await this.waitForContentLoad(page);

      this.reportProgress(50, "Capturing high-resolution screenshots...");

      // Generate PDF with Puppeteer's native PDF generation for highest quality
      const pdfBuffer = await this.generatePDF(page);

      this.reportProgress(90, "Preparing PDF for download...");

      // Create download and trigger print dialog
      await this.downloadAndOpenPrintDialog(pdfBuffer);

      this.reportProgress(100, "PDF export completed successfully!");
    } catch (error) {
      console.error("Puppeteer PDF export failed:", error);
      this.reportProgress(0, "PDF export failed. Please try again.");
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    }
  }

  /**
   * Alternative method: Screenshot-based PDF for maximum quality control
   */
  async exportToScreenshotPDF(): Promise<void> {
    try {
      this.reportProgress(0, "Initializing screenshot-based export...");

      this.browser = await puppeteer.launch({
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          `--force-device-scale-factor=${this.options.scale}`,
        ],
        defaultViewport: {
          width: Math.round(8.5 * this.options.dpi), // 8.5 inches at specified DPI
          height: Math.round(11 * this.options.dpi), // 11 inches at specified DPI
          deviceScaleFactor: 1,
        },
      });

      const page = await this.browser.newPage();

      this.reportProgress(10, "Setting up page for screenshots...");

      const totalPages = calculateTotalPages(this.sections, true);
      const screenshots: Buffer[] = [];

      // Prepare HTML content with individual page rendering
      const htmlContent = generatePrintHTML(this.constitution, this.sections);
      await page.setContent(htmlContent, {
        waitUntil: ["networkidle0", "domcontentloaded"],
        timeout: 30000,
      });

      await this.waitForContentLoad(page);

      this.reportProgress(30, "Capturing individual page screenshots...");

      // Capture each page individually for maximum quality
      const pageElements = await page.$$(".constitution-page");

      for (let i = 0; i < pageElements.length; i++) {
        const pageElement = pageElements[i];

        this.reportProgress(
          30 + (i / pageElements.length) * 50,
          `Capturing page ${i + 1} of ${pageElements.length}...`,
        );

        // Scroll the page into view
        await pageElement.scrollIntoView();
        await page.waitForTimeout(100); // Small delay for rendering

        // Capture high-resolution screenshot of individual page
        const screenshot = await pageElement.screenshot({
          type: "png",
          omitBackground: false,
          captureBeyondViewport: false,
          clip: undefined, // Full element
        });

        screenshots.push(screenshot);
      }

      this.reportProgress(80, "Assembling PDF from screenshots...");

      // Convert screenshots to PDF using jsPDF for precise control
      const pdfBuffer = await this.createPDFFromScreenshots(screenshots);

      this.reportProgress(95, "Preparing PDF for download...");

      await this.downloadAndOpenPrintDialog(pdfBuffer);

      this.reportProgress(100, "Screenshot-based PDF export completed!");
    } catch (error) {
      console.error("Screenshot PDF export failed:", error);
      this.reportProgress(0, "Screenshot PDF export failed. Please try again.");
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    }
  }

  /**
   * Wait for all content to load properly
   */
  private async waitForContentLoad(page: Page): Promise<void> {
    // Wait for images to load
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images, (img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve, reject) => {
            img.addEventListener("load", resolve);
            img.addEventListener("error", resolve); // Continue even if image fails
            setTimeout(resolve, 5000); // Timeout after 5 seconds
          });
        }),
      );
    });

    // Wait for fonts to load
    await page.evaluateHandle(() => {
      return document.fonts.ready;
    });

    // Additional small delay for final rendering
    await page.waitForTimeout(500);
  }

  /**
   * Generate PDF using Puppeteer's native PDF generation
   */
  private async generatePDF(page: Page): Promise<Buffer> {
    return page.pdf({
      format: this.options.format.toLowerCase() as "letter" | "a4",
      margin: this.options.margin,
      printBackground: this.options.printBackground,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      scale: 1, // We already applied scaling via deviceScaleFactor
      timeout: 60000,
    });
  }

  /**
   * Create PDF from screenshot buffers using jsPDF for precise control
   */
  private async createPDFFromScreenshots(
    screenshots: Buffer[],
  ): Promise<Buffer> {
    const { jsPDF } = await import("jspdf");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "in",
      format: [8.5, 11],
      compress: this.options.compression !== "none",
    });

    for (let i = 0; i < screenshots.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      // Convert buffer to base64 data URL
      const base64Image = `data:image/png;base64,${screenshots[i].toString("base64")}`;

      // Add image to PDF with precise dimensions
      pdf.addImage(
        base64Image,
        "PNG",
        0, // x
        0, // y
        8.5, // width in inches
        11, // height in inches
        undefined,
        this.getCompressionLevel(),
      );
    }

    // Return PDF as buffer
    const pdfArrayBuffer = pdf.output("arraybuffer");
    return Buffer.from(pdfArrayBuffer);
  }

  /**
   * Get compression level based on options
   */
  private getCompressionLevel(): "FAST" | "MEDIUM" | "SLOW" {
    switch (this.options.compression) {
      case "low":
        return "FAST";
      case "medium":
        return "MEDIUM";
      case "high":
        return "SLOW";
      default:
        return "MEDIUM";
    }
  }

  /**
   * Download PDF and automatically open print dialog
   */
  private async downloadAndOpenPrintDialog(pdfBuffer: Buffer): Promise<void> {
    // Create blob from buffer
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });

    // Create object URL
    const url = URL.createObjectURL(blob);

    // Generate filename with timestamp
    const filename = `IEEE_UCSD_Constitution_${new Date().toISOString().split("T")[0]}_v${this.constitution?.version || 1}.pdf`;

    try {
      // Method 1: Try to open in new window for printing
      const printWindow = window.open(url, "_blank");

      if (printWindow) {
        printWindow.onload = () => {
          // Auto-trigger print dialog
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };

        // Also create download link as fallback
        this.createDownloadLink(url, filename);
      } else {
        // Fallback: Direct download if popup blocked
        this.createDownloadLink(url, filename);
      }
    } catch (error) {
      // Ultimate fallback: Direct download
      this.createDownloadLink(url, filename);
    }

    // Clean up URL after a delay
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60000); // 1 minute cleanup
  }

  /**
   * Create download link for PDF
   */
  private createDownloadLink(url: string, filename: string): void {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
 * Convenience functions for different export methods
 */
export const exportConstitutionWithPuppeteer = async (
  constitution: Constitution | null,
  sections: ConstitutionSection[],
  options?: Partial<PuppeteerPDFOptions>,
  onProgress?: (progress: number, status: string) => void,
): Promise<void> => {
  const exporter = new PuppeteerPDFExporter(
    constitution,
    sections,
    options,
    onProgress,
  );
  return exporter.exportToPDF();
};

export const exportConstitutionWithScreenshots = async (
  constitution: Constitution | null,
  sections: ConstitutionSection[],
  options?: Partial<PuppeteerPDFOptions>,
  onProgress?: (progress: number, status: string) => void,
): Promise<void> => {
  const exporter = new PuppeteerPDFExporter(
    constitution,
    sections,
    options,
    onProgress,
  );
  return exporter.exportToScreenshotPDF();
};

/**
 * Background processing utility for large documents
 */
export class BackgroundPDFProcessor {
  private workers: Map<string, Worker> = new Map();

  async processInBackground(
    taskId: string,
    constitution: Constitution | null,
    sections: ConstitutionSection[],
    options: Partial<PuppeteerPDFOptions> = {},
    onProgress?: (progress: number, status: string) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create worker for background processing
      const workerCode = `
        self.onmessage = async function(e) {
          const { constitution, sections, options } = e.data;
          
          try {
            // Import required modules (this would need to be adapted for actual worker environment)
            const { PuppeteerPDFExporter } = await import('./puppeteerPdfExport.js');
            
            const exporter = new PuppeteerPDFExporter(
              constitution, 
              sections, 
              options,
              (progress, status) => {
                self.postMessage({ type: 'progress', progress, status });
              }
            );
            
            await exporter.exportToPDF();
            self.postMessage({ type: 'complete' });
            
          } catch (error) {
            self.postMessage({ type: 'error', error: error.message });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: "application/javascript" });
      const worker = new Worker(URL.createObjectURL(blob));

      worker.onmessage = (e) => {
        const { type, progress, status, error } = e.data;

        switch (type) {
          case "progress":
            if (onProgress) onProgress(progress, status);
            break;
          case "complete":
            this.workers.delete(taskId);
            worker.terminate();
            resolve();
            break;
          case "error":
            this.workers.delete(taskId);
            worker.terminate();
            reject(new Error(error));
            break;
        }
      };

      worker.onerror = (error) => {
        this.workers.delete(taskId);
        worker.terminate();
        reject(error);
      };

      this.workers.set(taskId, worker);

      // Start processing
      worker.postMessage({ constitution, sections, options });
    });
  }

  cancelTask(taskId: string): void {
    const worker = this.workers.get(taskId);
    if (worker) {
      worker.terminate();
      this.workers.delete(taskId);
    }
  }

  cancelAllTasks(): void {
    this.workers.forEach((worker) => worker.terminate());
    this.workers.clear();
  }
}
