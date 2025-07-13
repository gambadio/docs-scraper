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
import { execSync } from 'child_process';

puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

export default class ScraperService {
  constructor() {
    this.sessions             = new Map();
    this.browser              = null;
    this.browserLaunchPromise = null;
    this.ai                   = new SelectorAI();
  }

  /* =============================  PUBLIC  ============================= */

  /** Analyse docs page and discover navigation links */
  async analyzeDocumentation(url) {
    let browser;
    let page;

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
      await page.waitForTimeout(2000);

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
    } catch (err) {
      console.error('Analysis error details:', err);
      // Try to recover by relaunching browser
      if (err.message.includes('socket hang up') || err.message.includes('Protocol error')) {
        this.browser = null;
        this.browserLaunchPromise = null;
      }
      throw new Error(`Failed to analyze URL: ${err.message}`);
    } finally {
      if (page) {
        await page.close().catch((err) => {
          console.error('Error closing page:', err);
        });
      }
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
  async closeBrowser() {
    if (this.browser?.isConnected()) {
      await this.browser.close();
      this.browser = null;
      this.browserLaunchPromise = null;
    }
  }
  async generateZip(id)     { return this._zipSession(id); }

  /* =======================  INTERNAL HELPERS  ======================== */

  async _getBrowser() {
    // Check if browser is still connected
    if (this.browser?.isConnected()) return this.browser;
    
    // If already launching, wait for it
    if (this.browserLaunchPromise) return this.browserLaunchPromise;

    const launch = async () => {
      try {
        // Close any existing browser instance
        if (this.browser) {
          await this.browser.close().catch(() => {});
          this.browser = null;
        }

        const chromePath = await this._findChrome();
        const args = [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--window-size=1920,1080',
          '--disable-accelerated-2d-canvas',
          '--single-process', // Help with resource constraints
          '--no-zygote' // Disable zygote process (Linux)
        ];
        
        console.log('Launching browser with executable:', chromePath || 'Puppeteer default');
        
        const launchOptions = {
          headless: 'new',
          args,
          defaultViewport: null,
          timeout: 60_000,
          handleSIGHUP: false,
          handleSIGINT: false,
          handleSIGTERM: false,
          protocolTimeout: 180_000,
          dumpio: false
        };

        // Only set executablePath if we found Chrome
        if (chromePath) {
          launchOptions.executablePath = chromePath;
        }

        const browser = await puppeteer.launch(launchOptions);
        
        // Set up disconnect handler
        browser.on('disconnected', () => {
          console.log('Browser disconnected');
          this.browser = null;
        });
        
        console.log('Browser launched successfully');
        return browser;
      } catch (err) {
        console.error('Failed to launch browser:', err.message);
        
        // Provide helpful error messages
        if (err.message.includes('Failed to launch the browser process')) {
          console.error('\n❌ Chrome/Chromium executable not found or failed to start.');
          console.error('Try one of the following solutions:\n');
          console.error('1. Install Google Chrome: https://www.google.com/chrome/');
          console.error('2. Set CHROME_EXECUTABLE_PATH environment variable to your Chrome path');
          console.error('3. Run: npm install puppeteer --save (to download Chromium automatically)');
          console.error('4. On Linux, install dependencies: sudo apt-get install chromium-browser');
          console.error('5. On macOS with Homebrew: brew install --cask google-chrome\n');
        }
        
        this.browserLaunchPromise = null;
        throw err;
      }
    };

    this.browserLaunchPromise = launch();
    this.browser = await this.browserLaunchPromise;
    this.browserLaunchPromise = null;
    return this.browser;
  }

  async _findChrome() {
    // First check environment variable
    if (process.env.CHROME_EXECUTABLE_PATH && existsSync(process.env.CHROME_EXECUTABLE_PATH)) {
      console.log('Using Chrome from CHROME_EXECUTABLE_PATH:', process.env.CHROME_EXECUTABLE_PATH);
      return process.env.CHROME_EXECUTABLE_PATH;
    }

    // Platform-specific paths
    const platform = process.platform;
    let candidates = [];

    if (platform === 'darwin') {
      // macOS
      candidates = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        process.env.HOME + '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      ];

      // Try to find Chrome using mdfind (Spotlight)
      try {
        const result = execSync('mdfind "kMDItemCFBundleIdentifier == \'com.google.Chrome\'"', { encoding: 'utf8' }).trim();
        if (result) {
          candidates.unshift(result.split('\n')[0] + '/Contents/MacOS/Google Chrome');
        }
      } catch (e) {
        // mdfind failed, continue with hardcoded paths
      }
    } else if (platform === 'win32') {
      // Windows
      const programFiles = [
        process.env['PROGRAMFILES'],
        process.env['PROGRAMFILES(X86)'],
        process.env['LOCALAPPDATA']
      ].filter(Boolean);

      for (const base of programFiles) {
        candidates.push(
          `${base}\\Google\\Chrome\\Application\\chrome.exe`,
          `${base}\\Google\\Chrome Beta\\Application\\chrome.exe`,
          `${base}\\Google\\Chrome Dev\\Application\\chrome.exe`,
          `${base}\\Google\\Chrome SxS\\Application\\chrome.exe`,
          `${base}\\Chromium\\Application\\chrome.exe`,
          `${base}\\Microsoft\\Edge\\Application\\msedge.exe`,
          `${base}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`
        );
      }
    } else {
      // Linux
      candidates = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome-beta',
        '/usr/bin/google-chrome-dev',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/brave-browser',
        '/usr/bin/microsoft-edge',
        '/snap/bin/chromium',
        '/usr/local/bin/google-chrome',
        '/opt/google/chrome/google-chrome',
        '/opt/google/chrome/chrome',
      ];

      // Try which command
      try {
        const whichResult = execSync('which google-chrome chromium chromium-browser 2>/dev/null', { encoding: 'utf8' }).trim();
        if (whichResult) {
          candidates.unshift(...whichResult.split('\n').filter(Boolean));
        }
      } catch (e) {
        // which failed, continue with hardcoded paths
      }
    }

    // Check puppeteer's bundled chromium
    try {
      const puppeteerChromium = execSync('node -e "console.log(require(\'puppeteer\').executablePath())"', { encoding: 'utf8' }).trim();
      if (puppeteerChromium && existsSync(puppeteerChromium)) {
        console.log('Found Puppeteer\'s bundled Chromium:', puppeteerChromium);
        return puppeteerChromium;
      }
    } catch (e) {
      console.log('Puppeteer bundled Chromium not found');
    }

    // Find first existing path
    for (const path of candidates) {
      if (path && existsSync(path)) {
        console.log('Found Chrome at:', path);
        return path;
      }
    }

    console.log('No Chrome executable found in common locations');
    console.log('Falling back to Puppeteer default (will download if needed)');
    return undefined; // Let Puppeteer handle it
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