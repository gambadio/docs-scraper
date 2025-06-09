import puppeteer from 'puppeteer';
import { load } from 'cheerio';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { join } from 'path';
import archiver from 'archiver';

class ScraperService {
  constructor() {
    this.sessions = new Map();
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  async analyzeDocumentation(url) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = load(response.data);
      const baseUrl = new URL(url).origin;
      const links = [];

      // Common selectors for documentation sidebars
      const sidebarSelectors = [
        'nav a[href]',
        '.sidebar a[href]',
        '.navigation a[href]',
        '.docs-nav a[href]',
        '.menu a[href]',
        '[role="navigation"] a[href]',
        '.toc a[href]',
        '.nav-links a[href]'
      ];

      // Find navigation links
      for (const selector of sidebarSelectors) {
        $(selector).each((i, el) => {
          const href = $(el).attr('href');
          const text = $(el).text().trim();
          
          if (href && text && href !== '#') {
            let fullUrl = href.startsWith('http') ? href : new URL(href, url).href;
            
            // Only include links from the same domain
            if (new URL(fullUrl).origin === baseUrl) {
              links.push({
                url: fullUrl,
                title: text,
                selector: selector
              });
            }
          }
        });

        if (links.length > 0) break; // Use first successful selector
      }

      // Remove duplicates
      const uniqueLinks = links.filter((link, index, self) => 
        index === self.findIndex(l => l.url === link.url)
      );

      return {
        baseUrl,
        totalLinks: uniqueLinks.length,
        links: uniqueLinks.slice(0, 50), // Limit to 50 pages
        detectedSelector: links.length > 0 ? links[0].selector : null
      };

    } catch (error) {
      throw new Error(`Failed to analyze documentation: ${error.message}`);
    }
  }

  async startScraping(baseUrl, links, sessionId = uuidv4()) {
    const session = {
      id: sessionId,
      status: 'running',
      progress: 0,
      total: links.length,
      completed: 0,
      failed: 0,
      pdfs: [],
      startTime: new Date(),
      errors: []
    };

    this.sessions.set(sessionId, session);

    // Start scraping in background
    this.performScraping(session, baseUrl, links).catch(error => {
      console.error('Scraping failed:', error);
      session.status = 'failed';
      session.error = error.message;
    });

    return sessionId;
  }

  async performScraping(session, baseUrl, links) {
    const browser = await this.initBrowser();
    
    try {
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        
        try {
          const page = await browser.newPage();
          await page.setViewport({ width: 1200, height: 800 });
          
          // Navigate to page
          await page.goto(link.url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
          });

          // Wait for content to load
          await page.waitForTimeout(2000);

          // Remove navigation and other elements
          await page.evaluate(() => {
            const selectors = [
              'nav', '.nav', '.navigation', '.sidebar', 
              'header', '.header', 'footer', '.footer',
              '.menu', '.breadcrumb', '.toc-container'
            ];
            
            selectors.forEach(sel => {
              document.querySelectorAll(sel).forEach(el => el.remove());
            });
          });

          // Generate PDF
          const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
              top: '1in',
              right: '1in',
              bottom: '1in',
              left: '1in'
            }
          });

          // Save PDF
          const filename = `${this.sanitizeFilename(link.title || `page-${i + 1}`)}.pdf`;
          const filepath = join(process.cwd(), 'temp', session.id, filename);
          
          await fs.mkdir(join(process.cwd(), 'temp', session.id), { recursive: true });
          await fs.writeFile(filepath, pdfBuffer);

          session.pdfs.push({
            title: link.title,
            filename,
            filepath,
            url: link.url
          });

          await page.close();
          session.completed++;

        } catch (error) {
          console.error(`Failed to scrape ${link.url}:`, error);
          session.failed++;
          session.errors.push({
            url: link.url,
            error: error.message
          });
        }

        session.progress = Math.round((session.completed + session.failed) / session.total * 100);
      }

      session.status = 'completed';
      session.endTime = new Date();

    } catch (error) {
      session.status = 'failed';
      session.error = error.message;
      throw error;
    }
  }

  getProgress(sessionId) {
    return this.sessions.get(sessionId);
  }

  async generateZip(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const buffers = [];

      archive.on('data', (data) => buffers.push(data));
      archive.on('end', () => resolve(Buffer.concat(buffers)));
      archive.on('error', reject);

      // Add PDFs to archive
      session.pdfs.forEach(pdf => {
        archive.file(pdf.filepath, { name: pdf.filename });
      });

      archive.finalize();
    });
  }

  sanitizeFilename(filename) {
    return filename
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50);
  }
}

export default ScraperService;