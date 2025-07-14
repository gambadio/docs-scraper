const API_BASE: string = 'http://localhost:3001/api';

export async function analyzeUrl(url: string, forceAi: boolean = false): Promise<any> {
  const response = await fetch(`${API_BASE}/scraper/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, forceAi }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to analyze URL');
  }

  return response.json();
}

export async function startScraping(baseUrl: string, links: string[]): Promise<{ sessionId: string }> {
  const sessionId = generateSessionId();
  
  const response = await fetch(`${API_BASE}/scraper/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      baseUrl,
      links,
      sessionId
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start scraping');
  }

  const result = await response.json();
  return { ...result, sessionId };
}

export async function getProgress(sessionId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/scraper/progress/${sessionId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get progress');
  }

  return response.json();
}

export async function downloadPdfs(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/scraper/download/${sessionId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to download PDFs');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `docs-${sessionId}.zip`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}