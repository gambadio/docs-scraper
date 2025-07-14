import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const { sessionId } = params;
    
    // Proxy the request to the backend Express server
    const response = await fetch(`http://localhost:3001/api/scraper/progress/${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      return json(data, { status: response.status });
    }
    
    return json(data);
  } catch (error: any) {
    console.error('Progress proxy error:', error);
    return json({ error: 'Failed to connect to backend server' }, { status: 500 });
  }
};