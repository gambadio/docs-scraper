# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a documentation scraper web application that converts online documentation into downloadable PDFs. It uses a hybrid architecture with a SvelteKit frontend and a separate Express.js backend, communicating via REST API.

## Architecture

**Hybrid Architecture:**
- **Frontend**: SvelteKit application on port 5173
- **Backend**: Express.js server on port 3001
- **Communication**: Frontend proxies API calls to backend via `/api/scraper/*` routes

**Frontend Structure (SvelteKit):**
1. Page routes in `src/routes/`
2. API proxy routes in `src/routes/api/scraper/`
3. Components in `src/lib/components/`
4. State management via Svelte stores (`src/lib/stores/appState.ts`)

**Backend Structure (Express):**
1. Entry point: `server/index.js`
2. API routes: `server/routes/scraper.js`
3. Core services in `server/services/`:
   - `ScraperService.js`: Puppeteer scraping, PDF generation, ZIP packaging
   - `SelectorAI.js`: AI-powered link extraction via OpenRouter API

**Key Technologies:**
- Web scraping: Puppeteer with stealth plugin
- HTML parsing: Cheerio
- AI integration: OpenRouter API (gpt-4.1-mini)
- Session management: In-memory Map with UUID identifiers
- File packaging: Archiver for ZIP creation

## Development Commands

```bash
# Start both frontend and backend servers
npm run dev

# Run only frontend (SvelteKit/Vite)
npm run client

# Run only backend (Express with nodemon)
npm run server

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking (frontend only)
npm run check

# Install Puppeteer browser (runs automatically on npm install)
npm run postinstall
```

## Environment Configuration

Create a `.env` file in the project root:
```
OPENROUTER_API_KEY=your_api_key_here
```

## Key Implementation Details

**URL Analysis Logic:**
- Standard selector approach in `server/services/ScraperService.js:analyzeDocumentation()`
- Searches using selectors: `nav a`, `.sidebar a`, `.docs-sidebar a`, `.toc a`, etc.
- AI fallback in `server/services/SelectorAI.js` when standard selectors fail
- Filters links to same domain, limits to 50 results

**PDF Generation:**
- Located in `server/services/ScraperService.js:_scrapePage()`
- Removes navigation elements before rendering (nav, header, footer, sidebars)
- Uses Puppeteer's page.pdf() with A4 format and 1-inch margins
- Graceful error handling for individual page failures

**Session Management:**
- In-memory storage using Map with UUID keys
- Sessions tracked in `server/services/ScraperService.js`
- Session data: urls array, progress tracking, ZIP file path
- No persistence between server restarts

**API Endpoints:**
- `POST /api/scraper/analyze` - Analyze URL for navigation links
- `POST /api/scraper/scrape` - Start scraping process
- `GET /api/scraper/progress/:sessionId` - Get scraping progress
- `GET /api/scraper/download/:sessionId` - Download ZIP file

## Common Tasks

**Adding new navigation selectors:**
Edit the `navSelectors` array in `server/services/ScraperService.js:analyzeDocumentation()`

**Modifying PDF generation options:**
Update the `page.pdf()` options in `server/services/ScraperService.js:_scrapePage()`

**Changing AI model or prompts:**
Modify `server/services/SelectorAI.js` - update model name or system/user prompts

**Adjusting scraping concurrency:**
Change `CONCURRENT_LIMIT` in `server/services/ScraperService.js`

**Modifying the UI workflow:**
Main flow in `src/routes/+page.svelte` with state transitions in `src/lib/stores/appState.ts`

**Adding API error handling:**
- Frontend: Handle errors in `src/routes/api/scraper/*/+server.ts`
- Backend: Add error handling in `server/routes/scraper.js`

## Important Notes

- Sessions are ephemeral - lost on server restart
- No authentication on API endpoints
- ZIP files are stored temporarily in `server/temp/` directory
- Frontend API routes are proxies that forward to backend
- Rate limiting depends on target site's tolerance