import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scraperService } from '$lib/server/services/scraperInstance';

export const GET: RequestHandler = async ({ params }) => {
  const { sessionId } = params;
  const progress = scraperService.getProgress(sessionId);
  
  if (!progress) {
    return json({ error: 'Session not found' }, { status: 404 });
  }
  
  return json(progress);
};