import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { load } from 'cheerio';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { join } from 'path';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { SelectorAI } from './SelectorAI.js';
import { execSync } from 'child_process';

puppeteer.use(StealthPlugin());

class ScraperService {
  sessions;
  browser;
  browserLaunchPromise;
  ai;

  constructor() {
    this.sessions = new Map();
    this.browser = null;
    this.browserLaunchPromise = null;
    this.ai = new SelectorAI();
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

      return { 
        baseUrl: url, 
        links: clean.slice(0, 50), 
        total: clean.length,
        aiAvailable: clean.length === 0 || clean.length < 5
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
    for (let i = 0; i < urls.length; i++) {
      session.progress.current = i + 1;
      try {
        await this._scrapePage(urls[i], tempDir, i);
        session.progress.completed++;
      } catch (error) {
        console.error(`Failed to scrape ${urls[i]}:`, error.message);
        session.progress.failed++;
        session.progress.errors.push({ url: urls[i], error: error.message });
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
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });
      await page.evaluate(() => {
        const toRemove = document.querySelectorAll('nav, header, footer, .sidebar, .navigation, .menu');
        toRemove.forEach(el => el.remove());
      });
      const title = await page.title();
      const filename = `${String(index + 1).padStart(3, '0')}-${this._sanitizeFilename(title)}.pdf`;
      const filepath = join(outputDir, filename);
      await page.pdf({
        path: filepath, format: 'A4', printBackground: true,
        margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
      });
      console.log(`✓ Scraped: ${title}`);
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