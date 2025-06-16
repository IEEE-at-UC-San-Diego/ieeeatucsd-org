import type { APIRoute } from 'astro';
import puppeteer from 'puppeteer';

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = new URL(url).searchParams;
    const status = searchParams.get('status') || 'submitted';
    const width = parseInt(searchParams.get('width') || '600');
    const height = parseInt(searchParams.get('height') || '200');
    const emailOptimized = searchParams.get('email') === 'true'; // New email optimization flag

    console.log('🎨 Generating status image for:', { status, width, height, emailOptimized });

    // Generate status progress bar HTML (email-optimized version for transparent backgrounds)
    function generateEmailOptimizedProgressBar(currentStatus: string): string {
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
      
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: transparent;
              width: ${width * 2}px;
              height: ${height * 2}px;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            .progress-wrapper {
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 40px;
            }
            .progress-title {
              margin: 0 0 40px 0;
              color: #1e293b;
              font-size: 28px;
              font-weight: 700;
              text-align: center;
              text-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .progress-container {
              position: relative;
              width: 100%;
              max-width: 800px;
              height: 120px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .progress-line {
              position: absolute;
              top: calc(50% - 14px); /* Align with center of 56px circles (28px from top) */
              left: 15%;
              right: 15%;
              height: 6px;
              background: linear-gradient(90deg, #e2e8f0 0%, #cbd5e1 100%);
              border-radius: 3px;
              z-index: 1;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .status-items {
              position: relative;
              display: flex;
              justify-content: space-between;
              width: 80%;
              z-index: 2;
              align-items: flex-start;
            }
            .status-item {
              display: flex;
              flex-direction: column;
              align-items: center;
              position: relative;
            }
            .status-circle {
              width: 56px;
              height: 56px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 24px;
              font-weight: bold;
              border: 4px solid white;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              margin-bottom: 12px;
              position: relative;
              z-index: 3;
            }
            .status-label {
              font-size: 16px;
              font-weight: 600;
              text-align: center;
              line-height: 1.2;
              white-space: nowrap;
              text-shadow: 0 1px 2px rgba(0,0,0,0.1);
            }
          </style>
        </head>
        <body>
          <div class="progress-wrapper">
            <h3 class="progress-title">Request Progress</h3>
            <div class="progress-container">
              <div class="progress-line"></div>
              <div class="status-items">
                ${statuses.map((statusName, index) => {
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
                  
                  return `
                    <div class="status-item">
                      <div class="status-circle" style="background: ${backgroundColor}; color: ${textColor};">
                        ${statusIcons[statusName]}
                      </div>
                      <div class="status-label" style="color: ${labelColor};">
                        ${statusLabels[statusName]}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    // Generate status progress bar HTML (based on the email template)
    function generateStatusProgressBarHTML(currentStatus: string): string {
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
      
      let progressBarHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: transparent;
              width: ${(width - 40) * 2}px;
              height: ${(height - 40) * 2}px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .progress-container {
              background: rgba(248, 250, 252, 0.95);
              padding: 60px 40px;
              border-radius: 16px;
              border: 2px solid rgba(226, 232, 240, 0.8);
              width: 100%;
              box-sizing: border-box;
              backdrop-filter: blur(8px);
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            }
            .progress-title {
              margin: 0 0 60px 0;
              color: #1e293b;
              font-size: 32px;
              font-weight: 600;
              text-align: center;
            }
            .progress-table {
              width: 100%;
              max-width: 1000px;
              margin: 0 auto;
              border-collapse: collapse;
              position: relative;
            }
            .progress-line {
              height: 4px;
              background: #e2e8f0;
              position: absolute;
              top: 42px;
              left: 0;
              right: 0;
              z-index: 1;
            }
            .progress-row {
              position: relative;
              z-index: 2;
            }
            .status-cell {
              text-align: center;
              padding: 0;
              vertical-align: top;
              position: relative;
              width: ${100/statuses.length}%;
            }
            .status-content {
              position: relative;
              z-index: 3;
              padding: 10px 0;
            }
            .status-circle {
              width: 64px;
              height: 64px;
              border-radius: 50%;
              text-align: center;
              line-height: 64px;
              font-size: 32px;
              font-weight: bold;
              border: 6px solid rgba(248, 250, 252, 0.95);
              margin: 0 auto 16px auto;
            }
            .status-label {
              font-size: 22px;
              font-weight: 600;
              text-align: center;
              line-height: 1.2;
              white-space: nowrap;
            }
            .connection-cell {
              padding: 0;
              vertical-align: top;
              position: relative;
              width: 40px;
            }
            .connection-line {
              height: 4px;
              position: absolute;
              top: 42px;
              left: 0;
              right: 0;
              z-index: 2;
            }
          </style>
        </head>
        <body>
          <div class="progress-container">
            <h3 class="progress-title">Request Progress</h3>
            <table class="progress-table">
              <tr class="progress-line-row">
                <td colspan="${statuses.length * 2 - 1}" class="progress-line"></td>
              </tr>
              <tr class="progress-row">
      `;
      
      statuses.forEach((status, index) => {
        const isActive = index <= currentIndex;
        const isCurrent = status === currentStatus;
        
        let backgroundColor, textColor, lineColor;
        if (isCurrent) {
          if (status === 'rejected') {
            backgroundColor = '#ef4444';
            textColor = 'white';
            lineColor = '#ef4444';
          } else if (status === 'paid') {
            backgroundColor = '#10b981';
            textColor = 'white';
            lineColor = '#10b981';
          } else if (status === 'in_progress') {
            backgroundColor = '#f59e0b';
            textColor = 'white';
            lineColor = '#f59e0b';
          } else {
            backgroundColor = '#3b82f6';
            textColor = 'white';
            lineColor = '#3b82f6';
          }
        } else if (isActive) {
          backgroundColor = '#e2e8f0';
          textColor = '#475569';
          lineColor = '#cbd5e1';
        } else {
          backgroundColor = '#f8fafc';
          textColor = '#94a3b8';
          lineColor = '#e2e8f0';
        }
        
        // Status circle
        progressBarHtml += `
              <td class="status-cell">
                <div class="status-content">
                  <div class="status-circle" style="
                    background: ${backgroundColor}; 
                    color: ${textColor};
                  ">
                    ${statusIcons[status]}
                  </div>
                  <div class="status-label" style="
                    color: ${isCurrent ? (status === 'rejected' ? '#ef4444' : status === 'paid' ? '#10b981' : status === 'in_progress' ? '#f59e0b' : '#3b82f6') : isActive ? '#475569' : '#94a3b8'};
                  ">
                    ${statusLabels[status]}
                  </div>
                </div>
              </td>
        `;
        
        // Connecting line (except for the last status)
        if (index < statuses.length - 1) {
          const nextIsActive = (index + 1) <= currentIndex;
          const connectionColor = nextIsActive ? lineColor : '#e2e8f0';
          
          progressBarHtml += `
              <td class="connection-cell">
                <div class="connection-line" style="background: ${connectionColor};"></div>
              </td>
          `;
        }
      });
      
      progressBarHtml += `
            </tr>
          </table>
        </div>
      </body>
      </html>
      `;
      
      return progressBarHtml;
    }

    // Choose which HTML to use based on email optimization flag
    const html = emailOptimized ? 
      generateEmailOptimizedProgressBar(status) : 
      generateStatusProgressBarHTML(status);

    // Launch Puppeteer with high quality settings
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--force-device-scale-factor=2' // Higher DPI for better quality
      ]
    });

    const page = await browser.newPage();
    
    // Set high-resolution viewport for better quality
    await page.setViewport({ 
      width: width * 2, // Double resolution for crisp images
      height: height * 2,
      deviceScaleFactor: 2
    });
    
    // Set HTML content
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
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

    console.log('✅ Status image generated successfully');

    return new Response(screenshot, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('❌ Error generating status image:', error);
    return new Response('Error generating image', { status: 500 });
  }
}; 