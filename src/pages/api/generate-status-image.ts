import type { APIRoute } from 'astro';

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
      const circleRadius = 22;
      const lineY = height / 2;
      const totalWidth = width * 0.8; // Use 80% of width
      const startX = width * 0.1; // Start at 10% from left
      const stepWidth = totalWidth / (statuses.length - 1);
      
             let svgElements = '';
       
       // Generate background line (behind circles) - decreased height
       svgElements += `<line x1="${startX}" y1="${lineY + 1}" x2="${startX + totalWidth}" y2="${lineY + 1}" stroke="#e2e8f0" stroke-width="4" opacity="0.6"/>`;
       
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
         
         svgElements += `<line x1="${startX}" y1="${lineY + 1}" x2="${progressEndX}" y2="${lineY + 1}" stroke="${progressColor}" stroke-width="3" opacity="0.9"/>`;
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
        svgElements += `<circle cx="${x}" cy="${y}" r="${circleRadius}" fill="${backgroundColor}" stroke="white" stroke-width="3" filter="url(#shadow)"/>`;
        
        // Icon text - properly centered with dominant-baseline
        svgElements += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="bold" fill="${textColor}">${statusIcons[statusName]}</text>`;
        
        // Label text
        svgElements += `<text x="${x}" y="${y + circleRadius + 18}" text-anchor="middle" dominant-baseline="central" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="${labelColor}">${statusLabels[statusName]}</text>`;
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
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
            </filter>
          </defs>
          
          <!-- Title -->
          <text x="${width/2}" y="25" text-anchor="middle" dominant-baseline="central" font-size="16" font-weight="700" fill="#1e293b">Request Progress</text>
          
          ${svgElements}
        </svg>
      `;
    }

    const svg = generateSVGProgressBar(status);

    console.log('✅ SVG status image generated successfully');

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
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