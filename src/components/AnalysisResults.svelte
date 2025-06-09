<script lang="ts">
  import { appState } from '../stores/appState';
  import { startScraping } from '../services/api';
  
  let selectedLinks = [];
  let isStarting = false;
  let error = '';

  $: analysis = $appState.analysis;
  $: if (analysis?.links) {
    selectedLinks = analysis.links.map(link => link.url);
  }

  function toggleLink(url) {
    if (selectedLinks.includes(url)) {
      selectedLinks = selectedLinks.filter(u => u !== url);
    } else {
      selectedLinks = [...selectedLinks, url];
    }
  }

  function toggleAll() {
    if (selectedLinks.length === analysis.links.length) {
      selectedLinks = [];
    } else {
      selectedLinks = analysis.links.map(link => link.url);
    }
  }

  async function startScrapingProcess() {
    if (selectedLinks.length === 0) {
      error = 'Please select at least one page to scrape';
      return;
    }

    isStarting = true;
    error = '';

    try {
      const linksToScrape = analysis.links.filter(link => 
        selectedLinks.includes(link.url)
      );

      const session = await startScraping(analysis.baseUrl, linksToScrape);
      appState.startScraping(session.sessionId, linksToScrape.length);
    } catch (err) {
      error = err.message || 'Failed to start scraping';
    } finally {
      isStarting = false;
    }
  }
</script>

<div class="analysis-container">
  <div class="results-header">
    <div class="site-info">
      <h2>Site Analysis Complete</h2>
      <p class="site-url">{analysis?.baseUrl}</p>
      <div class="stats">
        <div class="stat">
          <span class="stat-number">{analysis?.totalLinks || 0}</span>
          <span class="stat-label">Pages Found</span>
        </div>
        <div class="stat">
          <span class="stat-number">{selectedLinks.length}</span>
          <span class="stat-label">Selected</span>
        </div>
      </div>
    </div>
    
    <div class="action-buttons">
      <button class="select-all-btn" on:click={toggleAll}>
        {selectedLinks.length === analysis?.links?.length ? 'Deselect All' : 'Select All'}
      </button>
      
      <button 
        class="start-btn"
        class:loading={isStarting}
        on:click={startScrapingProcess}
        disabled={isStarting || selectedLinks.length === 0}
      >
        {#if isStarting}
          <div class="spinner"></div>
          <span>Starting...</span>
        {:else}
          <span>Start Scraping ({selectedLinks.length})</span>
        {/if}
      </button>
    </div>
  </div>

  {#if error}
    <div class="error-message">
      {error}
    </div>
  {/if}

  <div class="links-container">
    <div class="links-header">
      <h3>Discovered Pages</h3>
      <p>Select the pages you want to scrape and convert to PDF</p>
    </div>

    <div class="links-list">
      {#each analysis?.links || [] as link, index}
        <div class="link-item" class:selected={selectedLinks.includes(link.url)}>
          <label class="link-checkbox">
            <input
              type="checkbox"
              checked={selectedLinks.includes(link.url)}
              on:change={() => toggleLink(link.url)}
            />
            <span class="checkmark"></span>
          </label>
          
          <div class="link-content">
            <div class="link-title">{link.title}</div>
            <div class="link-url">{link.url}</div>
          </div>
          
          <div class="link-index">{index + 1}</div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .analysis-container {
    max-width: 900px;
    margin: 0 auto;
  }

  .results-header {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    margin-bottom: 2rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
  }

  .site-info h2 {
    font-size: 1.5rem;
    font-weight: 800;
    color: #1a202c;
    margin-bottom: 0.5rem;
  }

  .site-url {
    color: #4a5568;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
    word-break: break-all;
  }

  .stats {
    display: flex;
    gap: 2rem;
  }

  .stat {
    text-align: center;
  }

  .stat-number {
    display: block;
    font-size: 2rem;
    font-weight: 800;
    color: #3182CE;
    line-height: 1;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #718096;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }

  .action-buttons {
    display: flex;
    gap: 1rem;
    flex-direction: column;
    align-items: flex-end;
  }

  .select-all-btn {
    background: #f7fafc;
    color: #4a5568;
    border: 2px solid #e2e8f0;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
  }

  .select-all-btn:hover {
    background: #edf2f7;
    border-color: #cbd5e0;
  }

  .start-btn {
    background: #E53E3E;
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .start-btn:hover:not(:disabled) {
    background: #C53030;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(229, 62, 62, 0.3);
  }

  .start-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-message {
    background: #fed7d7;
    color: #c53030;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 2rem;
    text-align: center;
    border: 1px solid #feb2b2;
  }

  .links-container {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    overflow: hidden;
  }

  .links-header {
    padding: 2rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .links-header h3 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1a202c;
    margin-bottom: 0.5rem;
  }

  .links-header p {
    color: #4a5568;
    margin: 0;
  }

  .links-list {
    max-height: 500px;
    overflow-y: auto;
  }

  .link-item {
    display: flex;
    align-items: center;
    padding: 1rem 2rem;
    border-bottom: 1px solid #f1f5f9;
    transition: background-color 0.2s ease;
    cursor: pointer;
  }

  .link-item:hover {
    background: #f8fafc;
  }

  .link-item.selected {
    background: #ebf8ff;
    border-left: 4px solid #3182CE;
  }

  .link-checkbox {
    display: flex;
    align-items: center;
    margin-right: 1rem;
    cursor: pointer;
  }

  .link-checkbox input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
  }

  .checkmark {
    height: 20px;
    width: 20px;
    background-color: #f7fafc;
    border: 2px solid #e2e8f0;
    border-radius: 4px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .link-checkbox input:checked ~ .checkmark {
    background-color: #3182CE;
    border-color: #3182CE;
  }

  .link-checkbox input:checked ~ .checkmark::after {
    content: "✓";
    color: white;
    font-size: 12px;
    font-weight: bold;
  }

  .link-content {
    flex: 1;
  }

  .link-title {
    font-weight: 600;
    color: #1a202c;
    margin-bottom: 0.25rem;
  }

  .link-url {
    font-size: 0.875rem;
    color: #718096;
    word-break: break-all;
  }

  .link-index {
    width: 32px;
    height: 32px;
    background: #f1f5f9;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 600;
    color: #4a5568;
  }

  .link-item.selected .link-index {
    background: #3182CE;
    color: white;
  }

  @media (max-width: 768px) {
    .results-header {
      flex-direction: column;
      align-items: stretch;
      text-align: center;
    }

    .action-buttons {
      align-items: stretch;
    }

    .stats {
      justify-content: center;
    }

    .link-item {
      padding: 1rem;
    }

    .links-list {
      max-height: 400px;
    }
  }
</style>