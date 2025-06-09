import express from 'express';
import ScraperService from '../services/ScraperService.js';

const router = express.Router();
const scraperService = new ScraperService();

// Analyze URL and discover navigation links
router.post('/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const analysis = await scraperService.analyzeDocumentation(url);
    res.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start scraping process
router.post('/scrape', async (req, res) => {
  try {
    const { baseUrl, links, sessionId } = req.body;
    
    if (!baseUrl || !links || !Array.isArray(links)) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }

    // Start scraping in background
    scraperService.startScraping(baseUrl, links, sessionId);
    
    res.json({ 
      message: 'Scraping started',
      sessionId,
      totalPages: links.length 
    });
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get scraping progress
router.get('/progress/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const progress = scraperService.getProgress(sessionId);
  
  if (!progress) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json(progress);
});

// Download PDFs
router.get('/download/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const zipBuffer = await scraperService.generateZip(sessionId);
    
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="docs-${sessionId}.zip"`
    });
    
    res.send(zipBuffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;