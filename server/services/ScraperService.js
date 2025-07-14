import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { load } from 'cheerio';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { join } from 'path';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { SelectorAI } from './SelectorAI.js';
import { LinkSelectorAI } from './LinkSelectorAI.js';
import { execSync } from 'child_process';

puppeteer.use(StealthPlugin());

class ScraperService {
  sessions;
  browser;
  browserLaunchPromise;
  ai;
  linkSelector;

  constructor() {
    this.sessions = new Map();
    this.browser = null;
    this.browserLaunchPromise = null;
    this.ai = new SelectorAI();
    this.linkSelector = new LinkSelectorAI();
  }

  async analyzeDocumentation(url, forceAi = false) {
    console.log('Analyzing:', url, 'Force AI:', forceAi);
    let page;
    try {
      const browser = await this._getBrowser();
      page = await browser.newPage();
      
      await page.setViewport({ width: 1600, height: 1200 });
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
      );
      
      await page.setRequestInterception(true);
      page.on('request', (request) => request.continue());
      
      console.log('Navigating to:', url);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const html = await page.content();
      const $ = load(html);
      const base = new URL(url).origin;

      const SELS = [
        'nav a[href]', '.sidebar a[href]', '.docs-sidebar a[href]',
        '[role="navigation"] a[href]', 'aside a[href]', '.toc a[href]', '.menu a[href]',
        '.side-nav-item', '.scroll-link', 'a.side-nav-item', 'a.scroll-link',
        '.side-nav-section a[href]', '[class*="nav"] a[href]', '[class*="sidebar"] a[href]'
      ];

      let links = [];
      
      // Use AI if forced or skip regular selectors
      if (!forceAi) {
        for (const sel of SELS) {
          $(sel).each((_, el) => {
            const href = $(el).attr('href');
            if (!href || href === '#') return;
            const abs = href.startsWith('http') ? href : new URL(href, url).href;
            if (new URL(abs).origin !== base) return;
            links.push({ url: abs, title: $(el).text().trim() || '(untitled)' });
          });
        }
      }

      if (links.length === 0 || forceAi) {
        const result = await this.ai.extractNav(html, url);
        if (result.type === 'selector') {
          $(result.value).each((_, el) => {
            const href = $(el).attr('href');
            if (!href || href === '#') return;
            const abs = href.startsWith('http') ? href : new URL(href, url).href;
            if (new URL(abs).origin !== base) return;
            links.push({ url: abs, title: $(el).text().trim() || '(untitled)' });
          });
        } else if (result.type === 'links' && Array.isArray(result.value)) {
          for (const link of result.value) {
            if (!link.url || link.url === '#') continue;
            const abs = link.url.startsWith('http') ? link.url : new URL(link.url, url).href;
            if (new URL(abs).origin !== base) continue;
            links.push({ url: abs, title: link.title || '(untitled)' });
          }
        }
      }

      const seen = new Set();
      const clean = links.filter(({ url }) => {
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
      });

      let finalLinks = clean;
      
      // Apply AI selection if more than 60 links
      if (clean.length > 60) {
        console.log(`Found ${clean.length} links, applying AI selection...`);
        finalLinks = await this.linkSelector.selectImportantLinks(clean);
      }

      return { 
        baseUrl: url, 
        links: finalLinks, 
        total: clean.length,
        aiAvailable: clean.length === 0 || clean.length < 5,
        aiSelectionApplied: clean.length > 60
      };
    } catch (error) {
      console.error('Analysis error:', error);
      throw new Error(`Failed to analyze documentation: ${error.message}`);
    } finally {
      if (page && !page.isClosed()) {
        await page.close().catch(() => {});
      }
    }
  }

  async startScraping(baseUrl, urls, sessionId) {
    const session = {
      urls,
      progress: {
        current: 0, total: urls.length, completed: 0, failed: 0,
        status: 'in_progress', errors: []
      }
    };
    this.sessions.set(sessionId, session);
    this._processScraping(sessionId, baseUrl, urls).catch(error => {
      console.error('Fatal scraping error:', error);
      session.progress.status = 'failed';
    });
  }

  getProgress(sessionId) {
    return this.sessions.get(sessionId)?.progress || null;
  }

  async generateZip(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.pdfPath) {
      throw new Error('Session not found or PDFs not ready');
    }
    const pdfFiles = await fs.readdir(session.pdfPath);
    const zipPath = join(session.pdfPath, 'documentation.zip');
    return new Promise((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', async () => {
        try {
          resolve(await fs.readFile(zipPath));
        } catch (error) {
          reject(error);
        }
      });
      archive.on('error', reject);
      archive.pipe(output);
      for (const file of pdfFiles) {
        if (file.endsWith('.pdf')) {
          archive.file(join(session.pdfPath, file), { name: file });
        }
      }
      archive.finalize();
    });
  }

  async _processScraping(sessionId, baseUrl, urls) {
    const session = this.sessions.get(sessionId);
    const tempDir = join(process.cwd(), 'temp', sessionId);
    await fs.mkdir(tempDir, { recursive: true });
    session.pdfPath = tempDir;
    
    // Track PDFs that need reprocessing
    const failedPdfs = [];
    for (let i = 0; i < urls.length; i++) {
      session.progress.current = i + 1;
      let retries = 0;
      const maxRetries = 2;
      let success = false;
      
      while (retries <= maxRetries && !success) {
        try {
          const pdfSize = await this._scrapePage(urls[i], tempDir, i);
          
          // If PDF is too small, track it for reprocessing
          if (pdfSize < 5000) {
            console.warn(`⚠️  PDF is suspiciously small for ${urls[i]} (${pdfSize} bytes)`);
            failedPdfs.push({ url: urls[i], index: i, size: pdfSize });
          }
          
          session.progress.completed++;
          success = true;
        } catch (error) {
          console.error(`Failed to scrape ${urls[i]} (attempt ${retries + 1}):`, error.message);
          
          if (retries < maxRetries) {
            retries++;
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait before retry
          } else {
            session.progress.failed++;
            session.progress.errors.push({ url: urls[i], error: error.message });
            break;
          }
        }
      }
    }
    
    // Post-process failed PDFs with alternative method
    if (failedPdfs.length > 0) {
      console.log(`\n🔄 Reprocessing ${failedPdfs.length} failed PDFs with alternative method...`);
      for (const failed of failedPdfs) {
        try {
          console.log(`Reprocessing: ${failed.url}`);
          await this._scrapePageAlternative(failed.url, tempDir, failed.index);
          // Update progress if successful
          session.progress.errors = session.progress.errors.filter(e => e.url !== failed.url);
        } catch (error) {
          console.error(`Alternative scraping also failed for ${failed.url}:`, error.message);
        }
      }
    }
    
    session.progress.status = session.progress.failed === urls.length ? 'failed' : 'completed';
  }

  async _scrapePage(url, outputDir, index) {
    let page;
    try {
      const browser = await this._getBrowser();
      page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 1024 });
      
      // Set user agent to avoid bot detection
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
      );
      
      // Navigate with multiple wait conditions
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
      
      // Wait for common content selectors
      try {
        await page.waitForSelector('main, article, .content, .docs-content, [role="main"], .markdown-body, .documentation-content, .api-content', { 
          timeout: 5000 
        });
      } catch (e) {
        // If no main content found, wait a bit anyway
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Special handling for known documentation frameworks
      const pageUrl = new URL(url);
      if (pageUrl.hostname.includes('openai.com')) {
        // OpenAI docs use React and need more time
        await new Promise(resolve => setTimeout(resolve, 5000));
        try {
          await page.waitForSelector('.docs-body, .api-content', { timeout: 5000 });
        } catch (e) {}
      }
      
      // Additional wait to ensure dynamic content loads
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if page has meaningful content
      const contentInfo = await page.evaluate(() => {
        const body = document.body;
        const text = body ? body.innerText.trim() : '';
        const mainContent = document.querySelector('main, article, .content, .docs-content, [role="main"]');
        const mainText = mainContent ? mainContent.innerText.trim() : '';
        return {
          bodyLength: text.length,
          mainLength: mainText.length,
          hasMain: !!mainContent,
          firstChars: text.substring(0, 200)
        };
      });
      
      console.log(`Content check for ${url}:`, {
        bodyLength: contentInfo.bodyLength,
        mainLength: contentInfo.mainLength,
        hasMain: contentInfo.hasMain
      });
      
      if (contentInfo.bodyLength < 100) {
        console.warn(`Page appears empty: ${url}`);
        console.warn(`First 200 chars: "${contentInfo.firstChars}"`);
        // Try waiting more for dynamic content
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // Remove navigation elements
      await page.evaluate(() => {
        const toRemove = document.querySelectorAll('nav, header, footer, .sidebar, .navigation, .menu, .navbar, aside');
        toRemove.forEach(el => el.remove());
      });
      
      const title = await page.title() || 'Untitled';
      const filename = `${String(index + 1).padStart(3, '0')}-${this._sanitizeFilename(title)}.pdf`;
      const filepath = join(outputDir, filename);
      
      await page.pdf({
        path: filepath, 
        format: 'A4', 
        printBackground: true,
        margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
        preferCSSPageSize: true
      });
      
      // Verify PDF was created and has content
      const stats = await fs.stat(filepath);
      if (stats.size < 5000) { // Less than 5KB is suspiciously small
        console.warn(`PDF seems too small (${stats.size} bytes): ${title}`);
      }
      
      console.log(`✓ Scraped: ${title} (${stats.size} bytes)`);
      return stats.size;
    } catch (error) {
      throw error;
    } finally {
      if (page && !page.isClosed()) {
        await page.close().catch(() => {});
      }
    }
  }

  async _getBrowser() {
    if (!this.browserLaunchPromise) {
      this.browserLaunchPromise = this._launchBrowser();
    }
    return this.browserLaunchPromise;
  }

  async _launchBrowser() {
    try {
      const puppeteerExecutablePath = execSync('npx puppeteer browsers where chrome', { encoding: 'utf8' }).trim();
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: puppeteerExecutablePath || undefined,
        args: [
          '--no-sandbox', '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage'
        ]
      });
      this.browser = browser;
      process.once('SIGINT', () => this._cleanup());
      process.once('SIGTERM', () => this._cleanup());
      return browser;
    } catch (error) {
      console.error('Failed to launch browser:', error);
      throw new Error(`Browser launch failed: ${error.message}`);
    }
  }

  async _cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.browserLaunchPromise = null;
    }
  }

  async _scrapePageAlternative(url, outputDir, index) {
    let page;
    try {
      const browser = await this._getBrowser();
      page = await browser.newPage();
      
      // Larger viewport for better rendering
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Set user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
      );
      
      // Force screen media type instead of print
      await page.emulateMediaType('screen');
      
      // Navigate and wait for everything
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });
      
      // Wait for fonts and styles to load
      await page.evaluateHandle('document.fonts.ready');
      
      // Scroll through the page to trigger lazy loading
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 500;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            
            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              window.scrollTo(0, 0); // Scroll back to top
              resolve();
            }
          }, 100);
        });
      });
      
      // Wait after scrolling
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Force all content to be visible and remove print-specific hiding
      await page.addStyleTag({
        content: `
          * { 
            visibility: visible !important; 
            display: initial !important;
            opacity: 1 !important;
          }
          @media print {
            * { 
              visibility: visible !important;
              display: initial !important; 
              opacity: 1 !important;
            }
          }
          /* Hide only navigation elements */
          nav, header, footer, .sidebar, .navigation, .menu, .navbar, aside {
            display: none !important;
          }
          /* Ensure main content is visible */
          main, article, .content, .docs-content, [role="main"] {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
        `
      });
      
      // Additional wait for rendering
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const title = await page.title() || 'Untitled';
      const filename = `${String(index + 1).padStart(3, '0')}-${this._sanitizeFilename(title)}.pdf`;
      const filepath = join(outputDir, filename);
      
      // Generate PDF with screen media type
      await page.pdf({
        path: filepath,
        format: 'A4',
        printBackground: true,
        margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        scale: 0.8 // Slightly smaller scale to fit more content
      });
      
      const stats = await fs.stat(filepath);
      console.log(`✅ Successfully reprocessed: ${title} (${stats.size} bytes)`);
      
      return stats.size;
    } catch (error) {
      throw error;
    } finally {
      if (page && !page.isClosed()) {
        await page.close().catch(() => {});
      }
    }
  }

  _sanitizeFilename(name) {
    return name
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50);
  }

  _filenameToIndex(filename) {
    const match = filename.match(/^(\d+)-/);
    return match ? parseInt(match[1], 10) : 999;
  }
}

export default ScraperService;