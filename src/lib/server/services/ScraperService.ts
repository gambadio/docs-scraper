/**********************************************************************
 * ScraperService — robust Puppeteer scraper with AI fallback
 *********************************************************************/
import puppeteer from 'puppeteer-extra';
import type { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { load } from 'cheerio';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { SelectorAI } from './SelectorAI';
import { execSync } from 'child_process';

// @ts-ignore
puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

interface Link {
  url: string;
  title: string;
}

interface Session {
  urls: string[];
  progress: {
    current: number;
    total: number;
    completed: number;
    failed: number;
    status: 'in_progress' | 'completed' | 'failed';
    errors: Array<{ url: string; error: string }>;
  };
  pdfPath?: string;
  zipPath?: string;
}

export class ScraperService {
  private sessions: Map<string, Session>;
  private browser: Browser | null;
  private browserLaunchPromise: Promise<Browser> | null;
  private ai: SelectorAI;

  constructor() {
    this.sessions             = new Map();
    this.browser              = null;
    this.browserLaunchPromise = null;
    this.ai                   = new SelectorAI();
  }

  /* =============================  PUBLIC  ============================= */

  /** Analyse docs page and discover navigation links */
  async analyzeDocumentation(url: string) {
    let browser: Browser | undefined;
    let page: Page | undefined;

    try {
      browser = await this._getBrowser();
      page = await browser.newPage();
      
      // Configure page
      await page.setViewport({ width: 1600, height: 1200 });
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36'
      );
      
      // Enable request interception to handle errors
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        request.continue();
      });
      
      console.log('Navigating to:', url);
      
      // Use domcontentloaded to avoid frame detachment issues
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 45_000 
      });
      
      // Wait a bit for dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      const html = await page.content();
      const $    = load(html);
      const base = new URL(url).origin;

      /* ----------  pass 1: heuristic CSS selectors  ---------- */
      const SELS = [
        'nav a[href]',
        '.sidebar a[href]',
        '.docs-sidebar a[href]',
        '[role="navigation"] a[href]',
        'aside a[href]',
        '.toc a[href]',
        '.menu a[href]'
      ];

      let links: Link[] = [];
      for (const sel of SELS) {
        $(sel).each((_, el) => {
          const href = $(el).attr('href');
          if (!href || href === '#') return;
          const abs = href.startsWith('http') ? href : new URL(href, url).href;
          if (new URL(abs).origin !== base) return;
          links.push({ url: abs, title: $(el).text().trim() || '(untitled)' });
        });
        if (links.length) break;
      }

      /* ----------  pass 2: LLM fallback  ---------- */
      if (links.length === 0) {
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

      /* ----------  cleanup  ---------- */
      const seen = new Set<string>();
      const clean = links.filter(({ url }) => {
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
      });

      return {
        baseUrl: url,
        links: clean.slice(0, 50),
        total: clean.length
      };

    } catch (error: any) {
      console.error('Analysis error:', error);
      throw new Error(`Failed to analyze documentation: ${error.message}`);
    } finally {
      if (page && !page.isClosed()) {
        await page.close().catch(() => {});
      }
    }
  }

  /** Start async scraping process */
  async startScraping(baseUrl: string, urls: string[], sessionId: string) {
    const session: Session = {
      urls,
      progress: {
        current: 0,
        total: urls.length,
        completed: 0,
        failed: 0,
        status: 'in_progress',
        errors: []
      }
    };

    this.sessions.set(sessionId, session);

    // Run async
    this._processScraping(sessionId, baseUrl, urls).catch(error => {
      console.error('Fatal scraping error:', error);
      session.progress.status = 'failed';
    });
  }

  /** Get progress for a session */
  getProgress(sessionId: string) {
    return this.sessions.get(sessionId)?.progress || null;
  }

  /** Create ZIP of PDFs for download */
  async generateZip(sessionId: string): Promise<Buffer> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.pdfPath) {
      throw new Error('Session not found or PDFs not ready');
    }

    const pdfFiles = await fs.readdir(session.pdfPath);
    const zipPath = join(session.pdfPath, 'documentation.zip');

    return new Promise((resolve, reject) => {
      const output = require('fs').createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', async () => {
        try {
          const buffer = await fs.readFile(zipPath);
          resolve(buffer);
        } catch (error) {
          reject(error);
        }
      });

      archive.on('error', reject);
      archive.pipe(output);

      for (const file of pdfFiles) {
        if (file.endsWith('.pdf')) {
          archive.file(join(session.pdfPath!, file), { name: file });
        }
      }

      archive.finalize();
    });
  }

  /* =============================  PRIVATE  ============================= */

  /** Main scraping loop */
  private async _processScraping(sessionId: string, baseUrl: string, urls: string[]) {
    const session = this.sessions.get(sessionId)!;
    const tempDir = join(process.cwd(), 'temp', sessionId);
    await fs.mkdir(tempDir, { recursive: true });

    session.pdfPath = tempDir;

    for (let i = 0; i < urls.length; i++) {
      session.progress.current = i + 1;

      try {
        await this._scrapePage(urls[i], tempDir, i);
        session.progress.completed++;
      } catch (error: any) {
        console.error(`Failed to scrape ${urls[i]}:`, error.message);
        session.progress.failed++;
        session.progress.errors.push({
          url: urls[i],
          error: error.message
        });
      }
    }

    session.progress.status = session.progress.failed === urls.length ? 'failed' : 'completed';
  }

  /** Scrape single page */
  private async _scrapePage(url: string, outputDir: string, index: number) {
    let page: Page | undefined;

    try {
      const browser = await this._getBrowser();
      page = await browser.newPage();

      await page.setViewport({ width: 1280, height: 1024 });
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });

      // Remove nav elements before PDF
      await page.evaluate(() => {
        const toRemove = document.querySelectorAll('nav, header, footer, .sidebar, .navigation, .menu');
        toRemove.forEach(el => el.remove());
      });

      const title = await page.title();
      const filename = `${String(index + 1).padStart(3, '0')}-${this._sanitizeFilename(title)}.pdf`;
      const filepath = join(outputDir, filename);

      await page.pdf({
        path: filepath,
        format: 'A4',
        printBackground: true,
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

  /** Get or launch browser instance */
  private async _getBrowser(): Promise<Browser> {
    if (!this.browserLaunchPromise) {
      this.browserLaunchPromise = this._launchBrowser();
    }
    return this.browserLaunchPromise;
  }

  /** Launch Puppeteer browser */
  private async _launchBrowser(): Promise<Browser> {
    try {
      // First, try to get Chrome path from Puppeteer
      const puppeteerExecutablePath = execSync('npx puppeteer browsers where chrome', { encoding: 'utf8' }).trim();
      
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: puppeteerExecutablePath || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage'
        ]
      });

      this.browser = browser;

      // Graceful shutdown
      process.once('SIGINT', () => this._cleanup());
      process.once('SIGTERM', () => this._cleanup());

      return browser;
    } catch (error: any) {
      console.error('Failed to launch browser:', error);
      throw new Error(`Browser launch failed: ${error.message}`);
    }
  }

  /** Cleanup browser and temp files */
  private async _cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.browserLaunchPromise = null;
    }
  }

  /** Sanitize filename */
  private _sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50);
  }

  /** Parse filename to get index */
  private _filenameToIndex(filename: string): number {
    const match = filename.match(/^(\d+)-/);
    return match ? parseInt(match[1], 10) : 999;
  }
}