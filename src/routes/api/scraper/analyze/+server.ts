import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scraperService } from '$lib/server/services/scraperInstance';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return json({ error: 'URL is required' }, { status: 400 });
    }

    const analysis = await scraperService.analyzeDocumentation(url);
    return json(analysis);
  } catch (error: any) {
    console.error('Analysis error:', error);
    return json({ error: error.message }, { status: 500 });
  }
};