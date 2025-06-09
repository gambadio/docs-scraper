<script lang="ts">
  import { appState } from '../stores/appState';
  
  function resetApp() {
    appState.reset();
  }
</script>

<header class="header">
  <div class="header-content">
    <div class="brand">
      <div class="logo">
        <div class="logo-shape logo-red"></div>
        <div class="logo-shape logo-blue"></div>
        <div class="logo-shape logo-yellow"></div>
      </div>
      <h1>DocScraper</h1>
    </div>
    
    {#if $appState.step !== 'input'}
      <button class="reset-btn" on:click={resetApp}>
        <span>New Scrape</span>
      </button>
    {/if}
  </div>
</header>

<style>
  .header {
    background: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.25rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .logo {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }

  .logo-shape {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    transform: rotate(45deg);
    transition: transform 0.3s ease;
  }

  .logo-red { background: #E53E3E; }
  .logo-blue { background: #3182CE; }
  .logo-yellow { background: #D69E2E; }

  .brand:hover .logo-shape {
    transform: rotate(45deg) scale(1.1);
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 800;
    color: #1a202c;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .reset-btn {
    background: #E53E3E;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 0.875rem;
  }

  .reset-btn:hover {
    background: #C53030;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(229, 62, 62, 0.3);
  }

  @media (max-width: 768px) {
    .header-content {
      padding: 1rem;
    }
    
    h1 {
      font-size: 1.25rem;
    }
    
    .reset-btn {
      padding: 0.5rem 1rem;
      font-size: 0.8rem;
    }
  }
</style>