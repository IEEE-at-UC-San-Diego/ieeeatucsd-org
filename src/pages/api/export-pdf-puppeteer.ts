import type { APIRoute } from "astro";
import puppeteer from "puppeteer";
import { generatePrintHTML } from "../../components/dashboard/pages/constitution-builder/utils/printUtils";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { constitution, sections, options = {} } = body;

    if (!sections || !Array.isArray(sections)) {
      return new Response(JSON.stringify({ error: "Invalid sections data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Default options
    const pdfOptions = {
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
      dpi: 300,
      ...options,
    };

    // Launch Puppeteer with optimized settings
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
      ],
      // Let CSS @page control the size; avoid pixel viewport scaling
      defaultViewport: null,
      timeout: 60000,
    });

    try {
      const page = await browser.newPage();

      // Use default viewport; CSS + @page drive layout
      // Keep deviceScaleFactor as 1 to avoid shrinking content
      await page.setViewport({
        width: 1280,
        height: 800,
        deviceScaleFactor: 1,
      });

      // Generate the complete HTML content with proper base URL
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NODE_ENV === "production"
          ? "https://ieeeucsd.org"
          : `http://localhost:4321`; // Use the correct Astro dev server port

      const htmlContent = generatePrintHTML(constitution, sections, baseUrl);

      // Set the content
      await page.setContent(htmlContent, {
        waitUntil: ["networkidle0", "domcontentloaded"],
        timeout: 30000,
      });

      // Ensure print media styles are applied
      await page.emulateMediaType("print");

      // Wait for fonts and images to load with extended timeout for logo
      await waitForContentLoad(page);

      // Additional wait specifically for logo image
      await page.evaluate(() => {
        return new Promise((resolve) => {
          const logoImg = document.querySelector(
            'img[alt="IEEE Logo"]',
          ) as HTMLImageElement;
          if (logoImg) {
            if (logoImg.complete && logoImg.naturalWidth > 0) {
              resolve(true);
            } else {
              logoImg.onload = () => resolve(true);
              logoImg.onerror = () => resolve(true); // Continue even if logo fails
              setTimeout(() => resolve(true), 3000); // 3 second timeout
            }
          } else {
            resolve(true);
          }
        });
      });

      // Generate PDF with Puppeteer's native PDF generation
      const pdfBuffer = await page.pdf({
        format: pdfOptions.format.toLowerCase() as "letter" | "a4",
        margin: pdfOptions.margin,
        printBackground: pdfOptions.printBackground,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        // Keep scale at 1 to match CSS @page size; content sizing is controlled by CSS
        scale: 1,
        timeout: 60000,
      });

      // Generate filename
      const filename = `IEEE_UCSD_Constitution_${new Date().toISOString().split("T")[0]}_v${constitution?.version || 1}.pdf`;

      // Return PDF as response
      return new Response(Buffer.from(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": pdfBuffer.length.toString(),
        },
      });
    } finally {
      await browser.close();
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({
        error: "Failed to generate PDF",
        details: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

// Screenshot-based export endpoint
export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { constitution, sections, options = {} } = body;

    if (!sections || !Array.isArray(sections)) {
      return new Response(JSON.stringify({ error: "Invalid sections data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const pdfOptions = {
      quality: 100,
      scale: 2,
      dpi: 300,
      compression: "medium",
      ...options,
    };

    // Launch browser for screenshots
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        `--force-device-scale-factor=${pdfOptions.scale}`,
      ],
      defaultViewport: {
        width: Math.round(8.5 * pdfOptions.dpi), // 8.5 inches at specified DPI
        height: Math.round(11 * pdfOptions.dpi), // 11 inches at specified DPI
        deviceScaleFactor: 1,
      },
    });

    try {
      const page = await browser.newPage();

      // Generate HTML content with proper base URL
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NODE_ENV === "production"
          ? "https://ieeeucsd.org"
          : `http://localhost:4321`; // Use the correct Astro dev server port

      const htmlContent = generatePrintHTML(constitution, sections, baseUrl);
      await page.setContent(htmlContent, {
        waitUntil: ["networkidle0", "domcontentloaded"],
        timeout: 30000,
      });

      // Ensure print media styles are applied
      await page.emulateMediaType("print");

      await waitForContentLoad(page);

      // Capture screenshots of each page
      const pageElements = await page.$$(".constitution-page");
      const screenshots: Buffer[] = [];

      for (let i = 0; i < pageElements.length; i++) {
        const pageElement = pageElements[i];

        // Scroll page into view
        await pageElement.scrollIntoView();
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Capture high-resolution screenshot
        const screenshot = await pageElement.screenshot({
          type: "png",
          omitBackground: false,
          captureBeyondViewport: false,
        });

        screenshots.push(Buffer.from(screenshot));
      }

      // Create PDF from screenshots using jsPDF
      const pdfBuffer = await createPDFFromScreenshots(screenshots, pdfOptions);

      const filename = `IEEE_UCSD_Constitution_${new Date().toISOString().split("T")[0]}_v${constitution?.version || 1}_HiRes.pdf`;

      return new Response(Buffer.from(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": pdfBuffer.length.toString(),
        },
      });
    } finally {
      await browser.close();
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({
        error: "Failed to generate screenshot PDF",
        details: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

/**
 * Wait for all content to load properly
 */
async function waitForContentLoad(page: any): Promise<void> {
  // Log all images found on the page
  const imageInfo = await page.evaluate(() => {
    const images = Array.from(document.images);
    return images.map((img: HTMLImageElement) => ({
      src: img.src,
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    }));
  });

  // Wait for images to load
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.images, (img: HTMLImageElement) => {
        if (img.complete && img.naturalWidth > 0) {
          return Promise.resolve();
        }

        return new Promise((resolve) => {
          img.addEventListener("load", () => {
            resolve(undefined);
          });
          img.addEventListener("error", () => {
            resolve(undefined); // Continue even if image fails
          });
          setTimeout(() => {
            resolve(undefined);
          }, 10000); // Increased timeout to 10 seconds
        });
      }),
    );
  });

  // Wait for fonts to load
  await page.evaluateHandle(() => {
    return document.fonts.ready;
  });

  // Additional delay for final rendering
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

/**
 * Create PDF from screenshot buffers using jsPDF
 */
async function createPDFFromScreenshots(
  screenshots: Buffer[],
  options: any,
): Promise<Buffer> {
  // Import jsPDF dynamically
  const { jsPDF } = await import("jspdf");

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: [8.5, 11],
    compress: options.compression !== "none",
  });

  for (let i = 0; i < screenshots.length; i++) {
    if (i > 0) {
      pdf.addPage();
    }

    // Convert buffer to base64 data URL
    const base64Image = `data:image/png;base64,${screenshots[i].toString("base64")}`;

    // Get compression level
    const compressionLevel = getCompressionLevel(options.compression);

    // Add image to PDF with precise dimensions
    pdf.addImage(
      base64Image,
      "PNG",
      0, // x
      0, // y
      8.5, // width in inches
      11, // height in inches
      undefined,
      compressionLevel,
    );
  }

  // Return PDF as buffer
  const pdfArrayBuffer = pdf.output("arraybuffer");
  return Buffer.from(pdfArrayBuffer);
}

/**
 * Get compression level based on options
 */
function getCompressionLevel(compression: string): "FAST" | "MEDIUM" | "SLOW" {
  switch (compression) {
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
