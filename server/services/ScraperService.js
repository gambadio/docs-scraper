/**************************************************************************
 * ScraperService — robust Puppeteer-extra service
 * Works on macOS / Linux / Windows, Node ≥18, Puppeteer ≥22
 **************************************************************************/

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { load } from 'cheerio';
import axios from 'axios';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

export default class ScraperService {
  /* --------------------------------------------------  ctor / state  */
  constructor() {
    this.sessions            = new Map();
    this.browser             = null;
    this.browserLaunchPromise = null;
  }

  /* --------------------------------------------------  PUBLIC API  */

  /** Analyse the sidebar of a docs site and return link metadata */
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

      const sidebarSelectors = [
        'nav a[href]',
        '.sidebar a[href]',
        '.navigation a[href]',
        '.docs-nav a[href]',
        '[role="navigation"] a[href]',
        '.toc a[href]',
        '.menu a[href]',
        '.left-sidebar a[href]',
        'aside a[href]'
      ];

      let links = [];
      for (const sel of sidebarSelectors) {
        $(sel).each((_, el) => {
          const href = $(el).attr('href');
          const text = $(el).text().trim();
          if (!href || href === '#') return;

          const full = href.startsWith('http') ? href : new URL(href, url).href;
          if (new URL(full).origin !== base) return;

          links.push({ url: full, title: text || '(untitled)' });
        });
        if (links.length) break; // stop on first selector that worked
      }

      links = [...new Map(links.map(l => [l.url, l])).values()]; // dedupe

      return {
        baseUrl  : base,
        totalLinks: links.length,
        links    : links.slice(0, 50) // cap for sanity
      };
    } catch (err) {
      throw new Error(`Failed to analyse documentation: ${err.message}`);
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }

  /** Kick off a background scraping job */
  startScraping(baseUrl, links, sessionId = uuidv4()) {
    const session = {
      id       : sessionId,
      status   : 'running',
      progress : 0,
      total    : links.length,
      completed: 0,
      failed   : 0,
      pdfs     : [],
      errors   : [],
      startTime: new Date()
    };
    this.sessions.set(sessionId, session);
    this._scrapeLoop(session, baseUrl, links)
        .catch(err => { session.status = 'failed'; session.error = err.message; });
    return sessionId;
  }

  getProgress(id)          { return this.sessions.get(id); }
  async closeBrowser()      { if (this.browser?.isConnected()) await this.browser.close(); }
  async generateZip(id)     { return this._zipSession(id); }

  /* --------------------------------------------------  PRIVATE  */

  /* ----------  Browser bootstrap with multi-step fallback  ---------- */
  async _getBrowser() {
    if (this.browser && this.browser.isConnected()) return this.browser;
    if (this.browserLaunchPromise)                   return this.browserLaunchPromise;

    this.browserLaunchPromise = this._launchBrowser();
    try {
      this.browser = await this.browserLaunchPromise;
      return this.browser;
    } finally {
      this.browserLaunchPromise = null;
    }
  }

  async _launchBrowser() {
    // 1. Ensure there is a Chrome/Chromium binary we can use
    const localChromePath =
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      process.env.CHROME_EXECUTABLE_PATH   ||
      guessChromeExecutable();

    const commonArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080'
    ];

    /* -----  First attempt: “safe” flags only  ----- */
    try {
      return await puppeteer.launch({
        headless : true,
        executablePath: localChromePath,
        args     : commonArgs,
        timeout  : 60_000,
        defaultViewport: null,
        handleSIGHUP: false,
        handleSIGINT: false,
        handleSIGTERM: false
      });
    } catch (safeErr) {
      console.warn('[Puppeteer] Safe launch failed, retrying with stealth flags…');
      /* -----  Second attempt: full stealth (can crash on some macOS builds)  ----- */
      try {
        return await puppeteer.launch({
          headless : 'new',
          executablePath: localChromePath,
          args: [
            ...commonArgs,
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-web-security'
          ],
          timeout: 60_000,
          defaultViewport: null,
          ignoreDefaultArgs: ['--enable-automation'],
          handleSIGHUP: false,
          handleSIGINT: false,
          handleSIGTERM: false
        });
      } catch (stealthErr) {
        console.error('────────────────────────────────────────────────────────');
        console.error('🚨  Puppeteer could NOT launch Chrome.');
        console.error('     Safe launch error   :', safeErr.message);
        console.error('     Stealth launch error:', stealthErr.message);
        console.error('────────────────────────────────────────────────────────');
        throw new Error(
          'Chrome failed to start. ' +
          'Make sure a recent Chrome/Chromium is installed or set CHROME_EXECUTABLE_PATH.'
        );
      }
    }
  }

  /* ----------  Scraping loop → PDF per page  ---------- */
  async _scrapeLoop(session, baseUrl, links) {
    const browser = await this._getBrowser();
    for (const [idx, link] of links.entries()) {
      let page;
      try {
        page = await browser.newPage();
        await page.setUserAgent(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36'
        );

        await page.goto(link.url, { waitUntil: 'networkidle2', timeout: 45_000 });
        await page.evaluate(() => {
          // Strip nav/footers for cleaner PDF
          ['nav','header','footer','.sidebar','.toc','.breadcrumb']
            .forEach(sel => document.querySelectorAll(sel).forEach(e => e.remove()));
        });

        const pdfBuffer = await page.pdf({
          printBackground: true,
          format: 'A4',
          margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' }
        });

        const dir  = join(process.cwd(), 'temp', session.id);
        await fs.mkdir(dir, { recursive: true });
        const fname = this._slugify(link.title || `page-${idx+1}`) + '.pdf';
        const path  = join(dir, fname);
        await fs.writeFile(path, pdfBuffer);

        session.pdfs.push({ title: link.title, filename: fname, filepath: path });
        session.completed++;
      } catch (err) {
        session.failed++;
        session.errors.push({ url: link.url, error: err.message });
      } finally {
        session.progress = Math.round(
          (session.completed + session.failed) / session.total * 100
        );
        if (page) await page.close().catch(() => {});
      }
    }
    session.status  = 'completed';
    session.endTime = new Date();
  }

  /* ----------  Zip helper  ---------- */
  _zipSession(id) {
    const session = this.sessions.get(id);
    if (!session) throw new Error('Session not found');

    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks  = [];
      archive.on('data',  d => chunks.push(d));
      archive.on('end',   () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      session.pdfs.forEach(pdf => archive.file(pdf.filepath, { name: pdf.filename }));
      archive.finalize();
    });
  }

  /* ----------  Utils  ---------- */
  _slugify(str) {
    return str
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50);
  }
}

/* ****************************************************
 * Helper: guessChromeExecutable() — returns a path or null
 **************************************************** */
function guessChromeExecutable() {
  const macPaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ];
  const linuxPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ];
  const winPaths = [
    `${process.env['PROGRAMFILES']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`
  ];

  const candidates = process.platform === 'darwin' ? macPaths
                   : process.platform === 'win32'  ? winPaths
                   : linuxPaths;

  for (const p of candidates) if (existsSync(p)) return p;
  return null; // Puppeteer will fall back to its own download (if present)
}
