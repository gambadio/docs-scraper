import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    
    // Proxy the request to the backend Express server
    const response = await fetch('http://localhost:3001/api/scraper/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return json(data, { status: response.status });
    }
    
    return json(data);
  } catch (error: any) {
    console.error('Scraping proxy error:', error);
    return json({ error: 'Failed to connect to backend server' }, { status: 500 });
  }
};