# Docs Scraper

Docs Scraper is a web application that allows users to scrape online documentation, convert the pages to PDF, and download them as a single ZIP archive. It uses a SvelteKit frontend for the user interface and a separate Node.js/Express backend to handle the scraping logic.

## Project Architecture

The project is a monorepo-style application with two main components:

1.  **SvelteKit Frontend (`/src`)**: A modern web interface built with SvelteKit and Vite. It provides the user interface for inputting a URL, viewing the analysis of scraped links, and tracking the progress of the scraping job.
2.  **Node.js Backend (`/server`)**: An Express server responsible for all the heavy lifting. It uses Puppeteer to control a headless Chrome instance for web scraping and an AI service (OpenRouter) to intelligently identify navigation links when standard heuristics fail.

### Key Technologies

*   **Frontend**: SvelteKit, Vite, TypeScript
*   **Backend**: Node.js, Express, Puppeteer, Cheerio
*   **AI**: OpenRouter API (using `openai/gpt-4.1-mini`)
*   **Development**: Concurrently, Nodemon, TypeScript

---

## How It Works

The application follows a multi-step process to scrape and package documentation:

1.  **URL Analysis**: The user provides a starting URL for a documentation website. The backend navigates to this URL, analyzes the page content, and attempts to identify all navigation links.
    *   **Heuristic Pass**: It first uses a set of common CSS selectors (`nav a`, `.sidebar a`, etc.) to find navigation links.
    *   **AI Fallback**: If the heuristic pass fails, it sends the page's HTML to the OpenRouter AI service, which returns either a single CSS selector for the navigation container or a direct list of links.

2.  **Scraping**: Once the links are identified, the backend begins a scraping process that runs in the background. It visits each URL, removes unnecessary elements (headers, footers, sidebars), and saves the main content as a PDF.

3.  **Progress Tracking**: The frontend polls the backend to get real-time progress updates on the scraping job, including the number of pages completed, failed attempts, and any errors.

4.  **Download**: After the scraping is complete, the backend bundles all the generated PDFs into a single ZIP file, which the user can then download.

---

## Project Structure

```
/
├── server/                  # Node.js/Express backend
│   ├── services/            # Backend services
│   │   ├── ScraperService.js  # Core Puppeteer scraping logic
│   │   └── SelectorAI.js      # AI-powered link extraction
│   ├── routes/              # Express API routes
│   │   └── scraper.js
│   └── index.js             # Express server entry point
│
├── src/                     # SvelteKit frontend
│   ├── lib/
│   │   ├── components/      # Svelte components
│   │   ├── server/          # SvelteKit server-side code
│   │   │   └── services/    # Frontend-facing services
│   │   └── stores/          # Svelte stores for state management
│   └── routes/              # SvelteKit page and API routes
│
├── public/                  # Static assets
├── svelte.config.js         # SvelteKit configuration
├── vite.config.ts           # Vite configuration
└── package.json             # Project dependencies and scripts
```

---

## Setup and Development

### Prerequisites

*   Node.js (v18 or higher recommended)
*   An `OPENROUTER_API_KEY` for the AI service

### Installation

1.  Clone the repository.
2.  Create a `.env` file in the root of the project and add your OpenRouter API key:
    ```
    OPENROUTER_API_KEY=your_api_key_here
    ```
3.  Install the dependencies:
    ```bash
    npm install
    ```
    This will also trigger the `postinstall` script, which downloads the appropriate Chrome browser for Puppeteer.

### Running the Application

To run both the frontend and backend servers concurrently in development mode, use:

```bash
npm run dev
```

This command does the following:
*   Starts the Node.js backend server with `nodemon` for automatic restarts on file changes. The backend runs on `http://localhost:3001`.
*   Starts the SvelteKit frontend development server with Vite. The frontend is available at `http://localhost:5173`.

### Available Scripts

*   `npm run dev`: Starts both frontend and backend servers.
*   `npm run client`: Starts only the frontend server.
*   `npm run server`: Starts only the backend server.
*   `npm run build`: Builds the SvelteKit application for production.
*   `npm run preview`: Previews the production build.
*   `npm run check`: Runs Svelte Check and the TypeScript compiler to validate types.

---

## API Endpoints

The backend exposes the following API endpoints under the `/api/scraper` route:

*   `POST /api/scraper/analyze`: Analyzes a URL to find navigation links.
    *   **Body**: `{ "url": "string" }`
*   `POST /api/scraper/scrape`: Starts the scraping process for a given list of links.
    *   **Body**: `{ "baseUrl": "string", "links": ["url1", "url2"], "sessionId": "string" }`
*   `GET /api/scraper/progress/:sessionId`: Gets the progress of a scraping session.
*   `GET /api/gpi/scraper/download/:sessionId`: Downloads the final ZIP archive.
