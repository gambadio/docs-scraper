import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const { sessionId } = params;
    
    // Proxy the request to the backend Express server
    const response = await fetch(`http://localhost:3001/api/scraper/download/${sessionId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json();
      return new Response(JSON.stringify(errorData), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Get the zip file as a buffer
    const zipBuffer = await response.arrayBuffer();
    
    // Forward the response with appropriate headers
    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': response.headers.get('Content-Disposition') || `attachment; filename="docs-${sessionId}.zip"`
      }
    });
  } catch (error: any) {
    console.error('Download proxy error:', error);
    return new Response(JSON.stringify({ error: 'Failed to connect to backend server' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};