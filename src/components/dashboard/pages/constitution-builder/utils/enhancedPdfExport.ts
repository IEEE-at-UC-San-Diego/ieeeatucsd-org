import type {
  Constitution,
  ConstitutionSection,
} from "../../../shared/types/firestore";

export interface EnhancedPDFOptions {
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
  method: "native" | "screenshots";
}

export interface EnhancedPDFExportOptions {
  quality?: number;
  scale?: number;
  dpi?: number;
  captureMethod?: "canvas" | "hybrid" | "screen";
  preserveFonts?: boolean;
  optimizeImages?: boolean;
  enableAntialiasing?: boolean;
  memoryLimit?: number;
  format?: "A4" | "Letter";
  margin?: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  printBackground?: boolean;
  compression?: "none" | "low" | "medium" | "high";
  method?: "native" | "screenshots";
}

export const defaultEnhancedOptions: EnhancedPDFOptions = {
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
  method: "native",
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
    onProgress?: (progress: number, status: string) => void,
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
      this.reportProgress(0, "Preparing PDF export request...");

      const endpoint =
        this.options.method === "screenshots"
          ? "/api/export-pdf-puppeteer"
          : "/api/export-pdf-puppeteer";

      const method = this.options.method === "screenshots" ? "PUT" : "POST";

      this.reportProgress(10, "Sending request to server...");

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          constitution: this.constitution,
          sections: this.sections,
          options: this.options,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("PDF export failed:", errorData);
        throw new Error(
          errorData.error ||
            `Server error: ${response.status} - ${errorData.details || "Unknown error"}`,
        );
      }

      this.reportProgress(70, "Receiving PDF from server...");

      // Get the PDF blob
      const pdfBlob = await response.blob();

      if (pdfBlob.size === 0) {
        throw new Error("Received empty PDF from server");
      }

      this.reportProgress(90, "Preparing PDF for download and print...");

      // Create object URL and trigger download + print dialog
      await this.handlePDFDownloadAndPrint(pdfBlob);

      this.reportProgress(100, "PDF export completed successfully!");
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        this.reportProgress(0, "PDF export cancelled");
      } else {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Enhanced PDF export failed:", error);
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
      this.reportProgress(0, "Initializing enhanced PDF export...");

      // Simulate more granular progress for better UX
      const progressSteps = [
        { progress: 5, status: "Validating document structure..." },
        { progress: 15, status: "Launching high-resolution browser..." },
        { progress: 25, status: "Loading fonts and assets..." },
        { progress: 40, status: "Rendering pages at high DPI..." },
        { progress: 60, status: "Capturing screenshots..." },
        { progress: 80, status: "Assembling PDF document..." },
        { progress: 95, status: "Optimizing file size..." },
      ];

      // Show initial progress steps
      for (const step of progressSteps.slice(0, 3)) {
        this.reportProgress(step.progress, step.status);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const endpoint =
        this.options.method === "screenshots"
          ? "/api/export-pdf-puppeteer"
          : "/api/export-pdf-puppeteer";

      const method = this.options.method === "screenshots" ? "PUT" : "POST";

      // Continue with server processing
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          constitution: this.constitution,
          sections: this.sections,
          options: this.options,
        }),
        signal: this.abortController.signal,
      });

      // Show remaining progress steps
      for (const step of progressSteps.slice(3)) {
        this.reportProgress(step.progress, step.status);
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("PDF export failed:", errorData);
        throw new Error(
          errorData.error ||
            `Server error: ${response.status} - ${errorData.details || "Unknown error"}`,
        );
      }

      const pdfBlob = await response.blob();
      await this.handlePDFDownloadAndPrint(pdfBlob);

      this.reportProgress(100, "Enhanced PDF export completed!");
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        this.reportProgress(0, "PDF export cancelled");
      } else {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Enhanced PDF export failed:", error);
        this.reportProgress(0, `Export failed: ${errorMessage}`);
        throw error;
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Handle PDF print dialog launch
   */
  private async handlePDFDownloadAndPrint(pdfBlob: Blob): Promise<void> {
    const url = URL.createObjectURL(pdfBlob);

    try {
      // Try to open PDF in new window and trigger print dialog
      await this.openPrintDialog(url);
    } catch (error) {
      console.warn("PDF print dialog failed, falling back to download:", error);
      // Fallback to download if popup is blocked
      await this.createDownloadLink(url, this.generateFilename());
    }

    // Clean up URL after delay
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 30000); // 30 seconds cleanup
  }

  /**
   * Create download link as fallback
   */
  private async createDownloadLink(
    url: string,
    filename: string,
  ): Promise<void> {
    return new Promise((resolve) => {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        resolve();
      }, 100);
    });
  }

  /**
   * Open PDF in new window and trigger print dialog
   */
  private async openPrintDialog(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Open PDF in new window
        const printWindow = window.open(
          url,
          "_blank",
          "width=800,height=600,scrollbars=yes,resizable=yes",
        );

        if (!printWindow) {
          reject(
            new Error(
              "Failed to open print window. Please check popup blocker settings.",
            ),
          );
          return;
        }

        // Wait for PDF to load, then trigger print dialog
        printWindow.onload = () => {
          setTimeout(() => {
            try {
              if (printWindow && !printWindow.closed) {
                printWindow.print();
              }
              resolve();
            } catch (error) {
              console.warn(
                "Auto-print failed, user can manually print:",
                error,
              );
              resolve(); // Still resolve as window opened successfully
            }
          }, 1000); // Wait 1 second for PDF to fully load
        };

        // Handle window close/error events
        printWindow.onerror = () => {
          console.warn("Print window encountered an error");
          resolve(); // Still resolve as we've done our best
        };

        // Handle case where onload doesn't fire
        setTimeout(() => {
          if (printWindow && !printWindow.closed) {
            try {
              printWindow.print();
              resolve();
            } catch (error) {
              console.warn(
                "Auto-print failed, user can manually print:",
                error,
              );
              resolve();
            }
          } else if (!printWindow || printWindow.closed) {
            // Window was closed or blocked
            resolve();
          }
        }, 3000); // Fallback after 3 seconds
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate filename with metadata
   */
  private generateFilename(): string {
    const date = new Date().toISOString().split("T")[0];
    const version = this.constitution?.version || 1;
    const method = this.options.method === "screenshots" ? "_HiRes" : "";
    const quality = this.options.dpi > 200 ? "_HighDPI" : "";

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
  onProgress?: (progress: number, status: string) => void,
): Promise<void> => {
  const exporter = new EnhancedPDFExporter(
    constitution,
    sections,
    options,
    onProgress,
  );
  return exporter.exportToPDF();
};

export const exportWithHighResScreenshots = async (
  constitution: Constitution | null,
  sections: ConstitutionSection[],
  options?: Partial<EnhancedPDFOptions>,
  onProgress?: (progress: number, status: string) => void,
): Promise<void> => {
  const enhancedOptions = { ...options, method: "screenshots" as const };
  const exporter = new EnhancedPDFExporter(
    constitution,
    sections,
    enhancedOptions,
    onProgress,
  );
  return exporter.exportWithProgress();
};

export const exportWithProgressiveEnhancement = async (
  constitution: Constitution | null,
  sections: ConstitutionSection[],
  options?: Partial<EnhancedPDFOptions>,
  onProgress?: (progress: number, status: string) => void,
): Promise<void> => {
  const exporter = new EnhancedPDFExporter(
    constitution,
    sections,
    options,
    onProgress,
  );
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
    compression: "medium" as const,
    method: "native" as const,
  },
  high: {
    quality: 95,
    scale: 2,
    dpi: 300,
    compression: "low" as const,
    method: "native" as const,
  },
  premium: {
    quality: 100,
    scale: 3,
    dpi: 600,
    compression: "none" as const,
    method: "screenshots" as const,
  },
  print: {
    quality: 100,
    scale: 2,
    dpi: 300,
    compression: "low" as const,
    method: "screenshots" as const,
  },
};

/**
 * Main export function for enhanced PDF
 */
export const exportConstitutionToEnhancedPDF = async (
  constitution: Constitution | null,
  sections: ConstitutionSection[],
  options?: Partial<EnhancedPDFExportOptions>,
  onProgress?: (progress: number, status: string) => void,
): Promise<void> => {
  const exporter = new EnhancedPDFExporter(
    constitution,
    sections,
    options,
    onProgress,
  );
  return exporter.exportToPDF();
};

/**
 * Get optimal export options based on browser capabilities
 */
export const getOptimalExportOptions = async (): Promise<
  Partial<EnhancedPDFExportOptions>
> => {
  // Detect browser capabilities
  const hasScreenCapture = "getDisplayMedia" in navigator.mediaDevices;
  const hasWebGPU = "gpu" in navigator;
  const isHighDPI = window.devicePixelRatio > 1;

  // Get memory info if available
  const memory = (performance as any).memory;
  const availableMemory = memory ? memory.jsHeapSizeLimit / (1024 * 1024) : 512; // MB

  return {
    quality: 1.0,
    scale: isHighDPI ? 2 : 3,
    dpi: 300,
    captureMethod: hasScreenCapture ? "screen" : "canvas",
    preserveFonts: true,
    optimizeImages: true,
    enableAntialiasing: true,
    memoryLimit: Math.min(availableMemory * 0.5, 512), // Use 50% of available memory, max 512MB
  };
};
