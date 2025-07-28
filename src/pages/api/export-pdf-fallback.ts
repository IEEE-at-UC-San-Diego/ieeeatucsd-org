import type { APIRoute } from 'astro';
import { generatePrintHTML } from '../../components/dashboard/utils/printUtils';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('Fallback PDF export API called');
    
    const body = await request.json();
    const { constitution, sections, options = {} } = body;

    if (!sections || !Array.isArray(sections)) {
      return new Response(JSON.stringify({ error: 'Invalid sections data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate HTML content with absolute base URL
    const baseUrl = `http://localhost:${process.env.PORT || 4322}`;
    const htmlContent = generatePrintHTML(constitution, sections, baseUrl);
    
    // For fallback, return the HTML content that can be printed directly
    const filename = `IEEE_UCSD_Constitution_${new Date().toISOString().split('T')[0]}_v${constitution?.version || 1}_fallback.html`;

    return new Response(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="${filename}"`,
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Fallback PDF generation error:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Failed to generate fallback PDF',
      details: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}; 