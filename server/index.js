import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
// Import scraperRoutes lazily to avoid startup hanging
let scraperRoutes;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../dist')));

// Routes (load scraperRoutes lazily)
app.use('/api/scraper', async (req, res, next) => {
  if (!scraperRoutes) {
    console.log('Loading scraper routes...');
    const scraperModule = await import('./routes/scraper.js');
    scraperRoutes = scraperModule.default;
  }
  scraperRoutes(req, res, next);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Closing server...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    // Only close browser if scraper routes were loaded
    if (scraperRoutes) {
      try {
        const scraperModule = await import('./routes/scraper.js');
        await scraperModule.scraperService.closeBrowser();
        console.log('Browser closed.');
      } catch (error) {
        console.log('Error closing browser:', error.message);
      }
    }
    process.exit(0);
  });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));