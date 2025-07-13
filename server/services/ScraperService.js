/**********************************************************************
 * ScraperService — robust Puppeteer scraper with AI fallback
 *********************************************************************/
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { load } from 'cheerio';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import SelectorAI from './SelectorAI.js';

puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

export default class ScraperService {
  constructor() {
    this.sessions             = new Map();
    this.browser              = null;
    this.browserLaunchPromise = null;
    this.ai                    = new SelectorAI();
  }

  /* =============================  PUBLIC  ============================= */

  /** Analyse docs page and discover navigation links */
  async analyzeDocumentation(url) {
    const browser = await this._getBrowser();
    let page;

    try {
      page = await browser.newPage();
      await page.setViewport({ width: 1600, height: 1200 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45_000 });

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

      let links = [];
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
        } else if (result.type === 'links') {
          links = result.value.filter(l => l.url && l.url.startsWith('http'));
        }
      }

      links = [...new Map(links.map(l => [l.url, l])).values()].slice(0, 100);

      return { baseUrl: base, totalLinks: links.length, links };
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }

  /** Kick-off scraping job */
  startScraping(baseUrl, urls, sessionId = uuidv4()) {
    const session = {
      id       : sessionId,
      status   : 'running',
      total    : urls.length,
      progress : 0,
      completed: 0,
      failed   : 0,
      pdfs     : [],
      errors   : [],
      startTime: new Date()
    };
    this.sessions.set(sessionId, session);
    this._scrapeLoop(session, urls).catch(err => {
      session.status = 'failed'; session.error = err.message;
    });
    return sessionId;
  }

  getProgress(id)          { return this.sessions.get(id); }
  async closeBrowser()      { if (this.browser?.isConnected()) await this.browser.close(); }
  async generateZip(id)     { return this._zipSession(id); }

  /* =======================  INTERNAL HELPERS  ======================== */

  async _getBrowser() {
    if (this.browser?.isConnected()) return this.browser;
    if (this.browserLaunchPromise)   return this.browserLaunchPromise;

    const launch = async () => {
      const chrome = guessChrome();
      const args   = [
        '--no-sandbox','--disable-setuid-sandbox',
        '--disable-dev-shm-usage','--window-size=1920,1080'
      ];
      return puppeteer.launch({
        headless: true, executablePath: chrome, args,
        defaultViewport: null, timeout: 60_000,
        handleSIGHUP:false, handleSIGINT:false, handleSIGTERM:false
      });
    };

    this.browserLaunchPromise = launch();
    this.browser = await this.browserLaunchPromise;
    this.browserLaunchPromise = null;
    return this.browser;
  }

  async _scrapeLoop(session, urls) {
    const browser = await this._getBrowser();

    for (const [idx, url] of urls.entries()) {
      let page;
      try {
        page = await browser.newPage();
        await page.setUserAgent(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36'
        );
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45_000 });
        await page.evaluate(() => {
          ['nav','header','footer','.sidebar','.toc','.breadcrumb']
            .forEach(sel => document.querySelectorAll(sel).forEach(e => e.remove()));
        });

        const pdfBuffer = await page.pdf({
          format:'A4', printBackground:true,
          margin:{ top:'1in', right:'1in', bottom:'1in', left:'1in' }
        });

        const dir  = join(process.cwd(), 'temp', session.id);
        await fs.mkdir(dir, { recursive:true });
        const name = this._slugify(`page-${idx+1}`) + '.pdf';
        await fs.writeFile(join(dir, name), pdfBuffer);
        session.pdfs.push({ url, filename:name, filepath:join(dir,name) });
        session.completed++;
      } catch (err) {
        session.failed++; session.errors.push({ url, error: err.message });
      } finally {
        session.progress = Math.round(
          (session.completed+session.failed)/session.total*100
        );
        if (page) await page.close().catch(() => {});
      }
    }
    session.status  = 'completed';
    session.endTime = new Date();
  }

  _zipSession(id) {
    const s = this.sessions.get(id);
    if (!s) throw new Error('Session not found');
    return new Promise((res, rej) => {
      const arch = archiver('zip', { zlib:{level:9} });
      const buf  = [];
      arch.on('data', d => buf.push(d));
      arch.on('end', () => res(Buffer.concat(buf)));
      arch.on('error', rej);
      s.pdfs.forEach(p => arch.file(p.filepath, { name: p.filename }));
      arch.finalize();
    });
  }

  _slugify(str) { return str.replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'-').toLowerCase(); }
}

/* -------------------------------------------------------------------- */
function guessChrome() {
  if (process.env.CHROME_EXECUTABLE_PATH) return process.env.CHROME_EXECUTABLE_PATH;

  const mac = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ];
  const linux = ['/usr/bin/google-chrome','/usr/bin/chromium-browser','/usr/bin/chromium'];
  const win = [
    `${process.env['PROGRAMFILES']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`
  ];
  const cand = process.platform==='darwin'?mac:process.platform==='win32'?win:linux;
  return cand.find(p => existsSync(p)) || undefined; // Puppeteer will download otherwise
}
