<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { appState } from '../stores/appState';
  import { getProgress, downloadPdfs } from '../services/api';
  
  let progressInterval;
  let isDownloading = false;
  
  $: sessionId = $appState.sessionId;
  $: progress = $appState.progress;

  onMount(() => {
    if (sessionId) {
      updateProgress();
      progressInterval = setInterval(updateProgress, 2000);
    }
  });

  onDestroy(() => {
    if (progressInterval) {
      clearInterval(progressInterval);
    }
  });

  async function updateProgress() {
    try {
      const newProgress = await getProgress(sessionId);
      appState.updateProgress(newProgress);
      
      if (newProgress.status === 'completed' || newProgress.status === 'failed') {
        clearInterval(progressInterval);
      }
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  }

  async function handleDownload() {
    if (progress?.status !== 'completed') return;
    
    isDownloading = true;
    try {
      await downloadPdfs(sessionId);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      isDownloading = false;
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'running': return '#3182CE';
      case 'completed': return '#38A169';
      case 'failed': return '#E53E3E';
      default: return '#718096';
    }
  }
</script>

<div class="progress-container">
  <div class="progress-header">
    <div class="status-indicator" style="background-color: {getStatusColor(progress?.status)}"></div>
    <h2>
      {#if progress?.status === 'running'}
        Scraping in Progress...
      {:else if progress?.status === 'completed'}
        Scraping Complete!
      {:else if progress?.status === 'failed'}
        Scraping Failed
      {:else}
        Processing...
      {/if}
    </h2>
  </div>

  {#if progress}
    <div class="progress-card">
      <div class="progress-stats">
        <div class="stat-group">
          <div class="stat">
            <span class="stat-value">{progress.completed || 0}</span>
            <span class="stat-label">Completed</span>
          </div>
          <div class="stat">
            <span class="stat-value">{progress.failed || 0}</span>
            <span class="stat-label">Failed</span>
          </div>
          <div class="stat">
            <span class="stat-value">{progress.total || 0}</span>
            <span class="stat-label">Total</span>
          </div>
        </div>

        <div class="progress-bar-container">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              style="width: {progress.progress || 0}%; background-color: {getStatusColor(progress.status)}"
            ></div>
          </div>
          <span class="progress-text">{progress.progress || 0}%</span>
        </div>
      </div>

      {#if progress.status === 'completed'}
        <div class="completion-section">
          <div class="success-icon">✅</div>
          <h3>All Done!</h3>
          <p>Successfully scraped {progress.completed} pages. Your PDFs are ready for download.</p>
          
          <button 
            class="download-btn"
            class:loading={isDownloading}
            on:click={handleDownload}
            disabled={isDownloading}
          >
            {#if isDownloading}
              <div class="spinner"></div>
              <span>Preparing Download...</span>
            {:else}
              <span>📥 Download All PDFs</span>
            {/if}
          </button>
        </div>
      {:else if progress.status === 'failed'}
        <div class="error-section">
          <div class="error-icon">❌</div>
          <h3>Scraping Failed</h3>
          <p>{progress.error || 'An unexpected error occurred during scraping.'}</p>
          
          {#if progress.errors && progress.errors.length > 0}
            <details class="error-details">
              <summary>View Error Details ({progress.errors.length} errors)</summary>
              <div class="error-list">
                {#each progress.errors as error}
                  <div class="error-item">
                    <div class="error-url">{error.url}</div>
                    <div class="error-message">{error.error}</div>
                  </div>
                {/each}
              </div>
            </details>
          {/if}
        </div>
      {:else if progress.status === 'running'}
        <div class="running-section">
          <div class="loading-animation">
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
          </div>
          <p>Scraping pages and generating PDFs... This may take a few minutes.</p>
        </div>
      {/if}

      {#if progress.pdfs && progress.pdfs.length > 0}
        <div class="files-section">
          <h4>Generated Files ({progress.pdfs.length})</h4>
          <div class="files-list">
            {#each progress.pdfs as pdf}
              <div class="file-item">
                <div class="file-icon">📄</div>
                <div class="file-info">
                  <div class="file-name">{pdf.filename}</div>
                  <div class="file-url">{pdf.url}</div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .progress-container {
    max-width: 800px;
    margin: 0 auto;
  }

  .progress-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .status-indicator {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }

  .progress-header h2 {
    font-size: 1.75rem;
    font-weight: 800;
    color: #1a202c;
    margin: 0;
  }

  .progress-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    padding: 2rem;
  }

  .progress-stats {
    margin-bottom: 2rem;
  }

  .stat-group {
    display: flex;
    justify-content: space-around;
    margin-bottom: 2rem;
  }

  .stat {
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 2rem;
    font-weight: 800;
    color: #1a202c;
    line-height: 1;
  }

  .stat-label {
    font-size: 0.875rem;
    color: #718096;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
  }

  .progress-bar-container {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .progress-bar {
    flex: 1;
    height: 12px;
    background: #f1f5f9;
    border-radius: 6px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    transition: width 0.5s ease;
    border-radius: 6px;
  }

  .progress-text {
    font-weight: 600;
    color: #4a5568;
    font-size: 0.875rem;
    min-width: 3rem;
    text-align: right;
  }

  .completion-section,
  .error-section,
  .running-section {
    text-align: center;
    padding: 2rem 0;
    border-top: 1px solid #e2e8f0;
    margin-top: 2rem;
  }

  .success-icon,
  .error-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .completion-section h3,
  .error-section h3 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .completion-section h3 {
    color: #38A169;
  }

  .error-section h3 {
    color: #E53E3E;
  }

  .completion-section p,
  .error-section p,
  .running-section p {
    color: #4a5568;
    margin-bottom: 2rem;
  }

  .download-btn {
    background: #38A169;
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
  }

  .download-btn:hover:not(:disabled) {
    background: #2f855a;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(56, 161, 105, 0.3);
  }

  .download-btn:disabled {
    opacity: 0.7;
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

  .loading-animation {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .loading-dot {
    width: 12px;
    height: 12px;
    background: #3182CE;
    border-radius: 50%;
    animation: bounce 1.4s ease-in-out infinite both;
  }

  .loading-dot:nth-child(1) { animation-delay: -0.32s; }
  .loading-dot:nth-child(2) { animation-delay: -0.16s; }

  @keyframes bounce {
    0%, 80%, 100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }

  .error-details {
    text-align: left;
    margin-top: 1rem;
  }

  .error-details summary {
    cursor: pointer;
    font-weight: 600;
    color: #E53E3E;
    margin-bottom: 1rem;
  }

  .error-list {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #fed7d7;
    border-radius: 8px;
  }

  .error-item {
    padding: 1rem;
    border-bottom: 1px solid #fed7d7;
  }

  .error-item:last-child {
    border-bottom: none;
  }

  .error-url {
    font-weight: 600;
    color: #1a202c;
    margin-bottom: 0.25rem;
    word-break: break-all;
  }

  .error-message {
    color: #c53030;
    font-size: 0.875rem;
  }

  .files-section {
    border-top: 1px solid #e2e8f0;
    margin-top: 2rem;
    padding-top: 2rem;
  }

  .files-section h4 {
    font-size: 1.125rem;
    font-weight: 700;
    color: #1a202c;
    margin-bottom: 1rem;
  }

  .files-list {
    max-height: 300px;
    overflow-y: auto;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    border-radius: 8px;
    transition: background-color 0.2s ease;
  }

  .file-item:hover {
    background: #f8fafc;
  }

  .file-icon {
    font-size: 1.5rem;
  }

  .file-info {
    flex: 1;
  }

  .file-name {
    font-weight: 600;
    color: #1a202c;
    margin-bottom: 0.25rem;
  }

  .file-url {
    font-size: 0.875rem;
    color: #718096;
    word-break: break-all;
  }

  @media (max-width: 768px) {
    .stat-group {
      flex-direction: column;
      gap: 1rem;
    }

    .progress-bar-container {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
</style>