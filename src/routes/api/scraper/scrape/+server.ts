import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scraperService } from '$lib/server/services/scraperInstance';
import { v4 as uuidv4 } from 'uuid';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { baseUrl, urls } = await request.json();
    
    if (!baseUrl || !urls || !Array.isArray(urls)) {
      return json({ error: 'Invalid request parameters' }, { status: 400 });
    }

    const sessionId = uuidv4();
    
    // Start scraping in background
    scraperService.startScraping(baseUrl, urls, sessionId);
    
    return json({ 
      message: 'Scraping started',
      sessionId,
      totalPages: urls.length 
    });
  } catch (error: any) {
    console.error('Scraping error:', error);
    return json({ error: error.message }, { status: 500 });
  }
};