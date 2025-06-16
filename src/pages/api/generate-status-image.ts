import type { APIRoute } from 'astro';
import puppeteer from 'puppeteer';

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = new URL(url).searchParams;
    const status = searchParams.get('status') || 'submitted';
    const width = parseInt(searchParams.get('width') || '500');
    const height = parseInt(searchParams.get('height') || '150');

    console.log('🎨 Generating SVG status image for:', { status, width, height });

    // Generate SVG status progress bar
    function generateSVGProgressBar(currentStatus: string): string {
      const statusOrder = ['submitted', 'under_review', 'approved', 'in_progress', 'paid'];
      const rejectedStatus = ['submitted', 'under_review', 'rejected'];
      
      const isRejected = currentStatus === 'rejected';
      const statuses = isRejected ? rejectedStatus : statusOrder;
      
      const statusIcons: Record<string, string> = {
        submitted: '→',
        under_review: '?', 
        approved: '✓',
        rejected: '✗',
        in_progress: '○',
        paid: '$'
      };
      
      const statusLabels: Record<string, string> = {
        submitted: 'Submitted',
        under_review: 'Under Review',
        approved: 'Approved', 
        rejected: 'Rejected',
        in_progress: 'In Progress',
        paid: 'Paid'
      };
      
             const currentIndex = statuses.indexOf(currentStatus);
       const circleRadius = 44; // Double for 2x resolution
       const lineY = height;
       const totalWidth = width * 1.6; // Double for 2x resolution (80% of doubled width)
       const startX = width * 0.2; // Double for 2x resolution (10% of doubled width)
       const stepWidth = totalWidth / (statuses.length - 1);
      
             let svgElements = '';
       
               // Generate background line (behind circles) - doubled for 2x resolution
        svgElements += `<line x1="${startX}" y1="${lineY + 2}" x2="${startX + totalWidth}" y2="${lineY + 2}" stroke="#e2e8f0" stroke-width="8" opacity="0.6"/>`;
        
        // Generate progress line up to current status
        if (currentIndex >= 0) {
          const progressEndX = startX + (currentIndex * stepWidth);
          let progressColor = '#3b82f6'; // Default blue
          
          // Set progress color based on current status
          if (currentStatus === 'rejected') {
            progressColor = '#ef4444';
          } else if (currentStatus === 'paid') {
            progressColor = '#10b981';
          } else if (currentStatus === 'in_progress') {
            progressColor = '#f59e0b';
          }
          
          svgElements += `<line x1="${startX}" y1="${lineY + 2}" x2="${progressEndX}" y2="${lineY + 2}" stroke="${progressColor}" stroke-width="6" opacity="0.9"/>`;
        }
       
       // Generate status circles and labels
      statuses.forEach((statusName, index) => {
        const x = startX + (index * stepWidth);
        const y = lineY;
        const isActive = index <= currentIndex;
        const isCurrent = statusName === currentStatus;
        
        let backgroundColor, textColor;
        if (isCurrent) {
          if (statusName === 'rejected') {
            backgroundColor = '#ef4444';
            textColor = 'white';
          } else if (statusName === 'paid') {
            backgroundColor = '#10b981';
            textColor = 'white';
          } else if (statusName === 'in_progress') {
            backgroundColor = '#f59e0b';
            textColor = 'white';
          } else {
            backgroundColor = '#3b82f6';
            textColor = 'white';
          }
        } else if (isActive) {
          backgroundColor = '#e2e8f0';
          textColor = '#475569';
        } else {
          backgroundColor = '#f8fafc';
          textColor = '#94a3b8';
        }
        
        const labelColor = isCurrent ? 
          (statusName === 'rejected' ? '#ef4444' : 
           statusName === 'paid' ? '#10b981' : 
           statusName === 'in_progress' ? '#f59e0b' : '#3b82f6') :
          isActive ? '#475569' : '#94a3b8';
        
                 // Circle with shadow effect
         svgElements += `<circle cx="${x}" cy="${y}" r="${circleRadius}" fill="${backgroundColor}" stroke="white" stroke-width="6" filter="url(#shadow)"/>`;
         
         // Icon text - properly centered with dominant-baseline (doubled font size)
         svgElements += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="36" font-weight="bold" fill="${textColor}">${statusIcons[statusName]}</text>`;
         
         // Label text (doubled font size)
         svgElements += `<text x="${x}" y="${y + circleRadius + 36}" text-anchor="middle" dominant-baseline="central" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="600" fill="${labelColor}">${statusLabels[statusName]}</text>`;
      });
      
             return `
         <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
           <defs>
             <style>
               text { 
                 font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
               }
             </style>
             <!-- Drop shadow filter -->
             <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
               <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.3"/>
             </filter>
           </defs>
           
           <!-- Title (doubled font size) -->
           <text x="${width}" y="50" text-anchor="middle" dominant-baseline="central" font-size="32" font-weight="700" fill="#1e293b">Request Progress</text>
           
           ${svgElements}
         </svg>
       `;
    }

    const svg = generateSVGProgressBar(status);

    console.log('✅ SVG generated, converting to PNG with Puppeteer...');

    // Convert SVG to PNG using Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Overcome limited resource problems
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // For limited memory environments
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-sync',
        '--no-default-browser-check',
        '--force-device-scale-factor=2' // Higher DPI for better quality
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, // Allow custom Chromium path
    });

    console.log('🚀 Puppeteer browser launched successfully');

    const page = await browser.newPage();
    
    // Set high-resolution viewport for better quality
    await page.setViewport({ 
      width: width * 2, // Double resolution for crisp images
      height: height * 2,
      deviceScaleFactor: 2
    });
    
    console.log('📄 Setting SVG content...');
    
    // Create HTML wrapper for the SVG
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            margin: 0;
            padding: 0;
            background: transparent;
            width: ${width * 2}px;
            height: ${height * 2}px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          svg {
            width: ${width * 2}px;
            height: ${height * 2}px;
          }
        </style>
      </head>
      <body>
        ${svg.replace(`width="${width}" height="${height}"`, `width="${width * 2}" height="${height * 2}"`)}
      </body>
      </html>
    `;
    
    // Set HTML content
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    console.log('📸 Taking screenshot...');
    
    // Take high-quality screenshot with transparent background
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
      omitBackground: true, // Transparent background
      clip: {
        x: 0,
        y: 0,
        width: width * 2,
        height: height * 2
      }
    });
    
    await browser.close();
    console.log('🔒 Browser closed successfully');

    console.log('✅ PNG image generated successfully from SVG');

    return new Response(screenshot, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('❌ Error generating SVG status image:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Return more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate status image', 
        details: errorMessage,
        timestamp: new Date().toISOString()
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}; 