# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a documentation scraper web application that converts online documentation into downloadable PDFs. It uses SvelteKit as a full-stack framework, utilizing Puppeteer for web scraping and PDF generation.

## Architecture

**SvelteKit Structure:**
1. Frontend routes in `src/routes/` 
2. API endpoints in `src/routes/api/scraper/`
3. Components in `src/lib/components/`
4. State management via Svelte stores (`src/lib/stores/appState.ts`)
5. Server-side services in `src/lib/server/services/`

**Core Services:**
- `ScraperService.ts`: Handles URL analysis, PDF generation, and ZIP packaging
- `SelectorAI.ts`: AI-powered selector extraction for navigation links
- Uses Puppeteer with stealth plugin for rendering and Cheerio for HTML parsing
- Sessions stored in-memory with UUID identifiers

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Type checking
npm run check

# Preview production build
npm run preview
```

## Key Implementation Details

**URL Analysis Logic:**
- Searches for documentation navigation using selectors: `nav a`, `.sidebar a`, `.docs-sidebar a`, etc.
- Filters links to same domain, limiting to 50 results
- Located in `src/lib/server/services/ScraperService.ts:analyzeDocumentation()`

**PDF Generation:**
- Removes navigation elements before rendering (nav, header, footer, sidebars)
- Uses Puppeteer's page.pdf() with A4 format
- Error handling for individual page failures
- Located in `src/lib/server/services/ScraperService.ts:_scrapePage()`

**Session Management:**
- In-memory storage using Map with UUID keys
- Sessions contain: urls array, progress tracking, ZIP file path
- No persistence between server restarts

## Common Tasks

**Adding new navigation selectors:**
Edit the selectors array in `src/lib/server/services/ScraperService.ts:analyzeDocumentation()`

**Modifying PDF generation options:**
Update the `page.pdf()` options in `src/lib/server/services/ScraperService.ts:_scrapePage()`

**Changing the UI flow:**
The main workflow is managed in `src/routes/+page.svelte` with state transitions in `src/lib/stores/appState.ts`

**API error handling:**
All API errors should follow the SvelteKit pattern in `src/routes/api/scraper/*/+server.ts` - return json() with appropriate status codes

## Testing

Currently no test framework is configured. Consider adding:
- Vitest for unit tests
- Playwright for E2E tests
- Mock Puppeteer for scraping logic tests