import type { RequestHandler } from './$types';
import { scraperService } from '$lib/server/services/scraperInstance';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const { sessionId } = params;
    const zipBuffer = await scraperService.generateZip(sessionId);
    
    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="docs-${sessionId}.zip"`
      }
    });
  } catch (error: any) {
    console.error('Download error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};