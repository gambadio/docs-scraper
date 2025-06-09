<script lang="ts">
  import Header from './components/Header.svelte';
  import UrlInput from './components/UrlInput.svelte';
  import AnalysisResults from './components/AnalysisResults.svelte';
  import ScrapingProgress from './components/ScrapingProgress.svelte';
  import { appState } from './stores/appState';
</script>

<main class="app">
  <Header />
  
  <div class="container">
    {#if $appState.step === 'input'}
      <UrlInput />
    {:else if $appState.step === 'analysis'}
      <AnalysisResults />
    {:else if $appState.step === 'scraping'}
      <ScrapingProgress />
    {/if}
  </div>
</main>

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    min-height: 100vh;
    line-height: 1.6;
  }

  :global(h1, h2, h3, h4, h5, h6) {
    font-weight: 700;
    line-height: 1.2;
    margin: 0 0 1rem 0;
  }

  :global(p) {
    margin: 0 0 1rem 0;
  }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .container {
    flex: 1;
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    width: 100%;
  }

  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }
  }
</style>