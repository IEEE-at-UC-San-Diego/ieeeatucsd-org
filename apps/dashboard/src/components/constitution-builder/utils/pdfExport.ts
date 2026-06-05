/**
 * PDF Export Utilities for Constitution Builder
 *
 * Generates a standalone HTML document from the constitution data and opens
 * it in a new browser window, then triggers the native print dialog so the
 * user can "Save as PDF". This matches the old dashboard's approach.
 */

import { Constitution, ConstitutionSection } from "../types";
import { generatePrintHTML } from "./printUtils";

/**
 * Opens a new browser window with the fully-rendered constitution HTML
 * and triggers the print dialog so the user can save as PDF.
 */
export const exportConstitutionToPdf = (
  constitution: Constitution | null,
  sections: ConstitutionSection[],
): void => {
  const htmlContent = generatePrintHTML(constitution, sections);

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert(
      "Unable to open print window. Please allow popups for this site and try again.",
    );
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
  };

  // Wait for the logo image to load before triggering print
  const checkReady = () => {
    try {
      const img = printWindow.document.querySelector(
        'img[alt="IEEE Logo"]',
      ) as HTMLImageElement | null;
      if (img && !img.complete) {
        img.onload = () => setTimeout(triggerPrint, 200);
        img.onerror = () => setTimeout(triggerPrint, 200);
        setTimeout(triggerPrint, 3000); // fallback timeout
      } else {
        setTimeout(triggerPrint, 500);
      }
    } catch {
      setTimeout(triggerPrint, 500);
    }
  };

  setTimeout(checkReady, 300);
};

/**
 * Legacy wrapper — kept for backward compatibility.
 */
export const exportToPdf = exportConstitutionToPdf;

/**
 * Generates a filename for the exported PDF
 */
export const generatePdfFilename = (
  organizationName: string,
  version: number,
): string => {
  const sanitizedOrgName = organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${sanitizedOrgName}-constitution-v${version}.pdf`;
};

/**
 * Checks if the current browser supports PDF export via print
 */
export const supportsPdfExport = (): boolean => {
  return typeof window.print === "function";
};
