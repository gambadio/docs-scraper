<script lang="ts">
  import { appState } from '../stores/appState';
  import { analyzeUrl } from '../services/api';
  
  let url = '';
  let isLoading = false;
  let error = '';

  async function handleSubmit() {
    if (!url.trim()) {
      error = 'Please enter a valid URL';
      return;
    }

    if (!isValidUrl(url)) {
      error = 'Please enter a valid HTTP/HTTPS URL';
      return;
    }

    isLoading = true;
    error = '';

    try {
      const analysis = await analyzeUrl(url);
      appState.setAnalysis(analysis);
    } catch (err) {
      error = err.message || 'Failed to analyze URL';
    } finally {
      isLoading = false;
    }
  }

  function isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  }
</script>

<div class="url-input-container">
  <div class="hero-section">
    <div class="hero-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
    </div>
    
    <div class="hero-content">
      <h2>Extract Documentation</h2>
      <p>Enter a documentation website URL to automatically discover and scrape all pages into organized PDFs</p>
    </div>
  </div>

  <div class="input-section">
    <div class="input-wrapper">
      <input
        type="url"
        bind:value={url}
        on:keydown={handleKeyDown}
        placeholder="https://docs.example.com"
        class="url-input"
        disabled={isLoading}
      />
      
      <button 
        class="analyze-btn"
        class:loading={isLoading}
        on:click={handleSubmit}
        disabled={isLoading}
      >
        {#if isLoading}
          <div class="spinner"></div>
          <span>Analyzing...</span>
        {:else}
          <span>Analyze Site</span>
        {/if}
      </button>
    </div>

    {#if error}
      <div class="error-message">
        {error}
      </div>
    {/if}
  </div>

  <div class="features">
    <div class="feature">
      <div class="feature-icon feature-icon-red">🔍</div>
      <h4>Smart Detection</h4>
      <p>Automatically finds navigation links and page structure</p>
    </div>
    
    <div class="feature">
      <div class="feature-icon feature-icon-blue">📄</div>
      <h4>Clean PDFs</h4>
      <p>Extracts content without navigation clutter</p>
    </div>
    
    <div class="feature">
      <div class="feature-icon feature-icon-yellow">⚡</div>
      <h4>Batch Processing</h4>
      <p>Downloads multiple pages efficiently in parallel</p>
    </div>
  </div>
</div>

<style>
  .url-input-container {
    max-width: 800px;
    margin: 0 auto;
  }

  .hero-section {
    position: relative;
    text-align: center;
    padding: 3rem 0;
    overflow: hidden;
  }

  .hero-shapes {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
  }

  .shape {
    position: absolute;
    border-radius: 4px;
    opacity: 0.1;
  }

  .shape-1 {
    width: 80px;
    height: 80px;
    background: #E53E3E;
    top: 20%;
    left: 10%;
    transform: rotate(15deg);
    animation: float 6s ease-in-out infinite;
  }

  .shape-2 {
    width: 60px;
    height: 60px;
    background: #3182CE;
    top: 60%;
    right: 15%;
    transform: rotate(-20deg);
    animation: float 8s ease-in-out infinite reverse;
  }

  .shape-3 {
    width: 40px;
    height: 40px;
    background: #D69E2E;
    bottom: 30%;
    left: 20%;
    transform: rotate(45deg);
    animation: float 7s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(var(--rotate)); }
    50% { transform: translateY(-20px) rotate(var(--rotate)); }
  }

  .hero-content {
    position: relative;
    z-index: 1;
  }

  .hero-content h2 {
    font-size: 2.5rem;
    font-weight: 800;
    color: #1a202c;
    margin-bottom: 1rem;
    letter-spacing: -0.03em;
  }

  .hero-content p {
    font-size: 1.125rem;
    color: #4a5568;
    max-width: 600px;
    margin: 0 auto;
  }

  .input-section {
    margin-bottom: 4rem;
  }

  .input-wrapper {
    display: flex;
    gap: 0;
    max-width: 600px;
    margin: 0 auto;
    background: white;
    border-radius: 12px;
    padding: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    border: 2px solid transparent;
    transition: border-color 0.3s ease;
  }

  .input-wrapper:focus-within {
    border-color: #3182CE;
  }

  .url-input {
    flex: 1;
    border: none;
    padding: 1rem 1.25rem;
    font-size: 1rem;
    background: transparent;
    outline: none;
    border-radius: 8px;
  }

  .url-input::placeholder {
    color: #a0aec0;
  }

  .analyze-btn {
    background: #3182CE;
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    white-space: nowrap;
  }

  .analyze-btn:hover:not(:disabled) {
    background: #2c5aa0;
    transform: translateY(-1px);
  }

  .analyze-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
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
    margin-top: 1rem;
    text-align: center;
    border: 1px solid #feb2b2;
  }

  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
  }

  .feature {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .feature:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  }

  .feature-icon {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    margin: 0 auto 1rem;
  }

  .feature-icon-red { background: #fed7d7; }
  .feature-icon-blue { background: #bee3f8; }
  .feature-icon-yellow { background: #faf089; }

  .feature h4 {
    font-size: 1.125rem;
    font-weight: 700;
    color: #1a202c;
    margin-bottom: 0.5rem;
  }

  .feature p {
    color: #4a5568;
    font-size: 0.875rem;
    margin: 0;
  }

  @media (max-width: 768px) {
    .hero-content h2 {
      font-size: 2rem;
    }

    .input-wrapper {
      flex-direction: column;
      gap: 0.5rem;
    }

    .analyze-btn {
      justify-content: center;
    }

    .features {
      grid-template-columns: 1fr;
    }
  }
</style>