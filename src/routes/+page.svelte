<script lang="ts">
  import UrlInput from '$lib/components/UrlInput.svelte';
  import AnalysisResults from '$lib/components/AnalysisResults.svelte';
  import ScrapingProgress from '$lib/components/ScrapingProgress.svelte';
  import { appState } from '$lib/stores/appState';

  let progressInterval: ReturnType<typeof setInterval>;

  async function handleUrlSubmit(event: CustomEvent) {
    try {
      const response = await fetch('/api/scraper/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: event.detail.url })
      });
      
      if (!response.ok) throw new Error('Failed to analyze URL');
      
      const analysis = await response.json();
      appState.setAnalysis(analysis);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAiAnalysis() {
    if (!$appState.analysis) return;
    try {
      const response = await fetch('/api/scraper/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: $appState.analysis.baseUrl,
          forceAi: true 
        })
      });
      
      if (!response.ok) throw new Error('Failed to analyze URL with AI');
      
      const analysis = await response.json();
      appState.setAnalysis(analysis);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleStartScraping(event: CustomEvent) {
    if (!$appState.analysis) return;
    try {
      const response = await fetch('/api/scraper/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          baseUrl: $appState.analysis.baseUrl, 
          urls: event.detail.links 
        })
      });
      
      if (!response.ok) throw new Error('Failed to start scraping');
      
      const session = await response.json();
      appState.startScraping(session.sessionId, event.detail.links.length);
      
      progressInterval = setInterval(async () => {
        if (!$appState.sessionId) return;
        
        const progressResponse = await fetch(`/api/scraper/progress/${$appState.sessionId}`);
        if (!progressResponse.ok) return;
        
        const newProgress = await progressResponse.json();
        appState.updateProgress(newProgress);
        
        if (newProgress.status === 'completed' || newProgress.status === 'failed') {
          clearInterval(progressInterval);
        }
      }, 2000);

    } catch (err) {
      console.error(err);
    }
  }

  function handleReset() {
    appState.reset();
    if (progressInterval) clearInterval(progressInterval);
  }

  async function handleDownload() {
    if (!$appState.sessionId) return;
    try {
      window.location.href = `/api/scraper/download/${$appState.sessionId}`;
    } catch (err) {
      console.error(err);
    }
  }
</script>

<main>
  {#if $appState.step === 'input'}
    <UrlInput on:submit={handleUrlSubmit} />
  {:else if $appState.step === 'analysis'}
    <AnalysisResults
      analysis={$appState.analysis}
      on:startScraping={handleStartScraping}
      on:reset={handleReset}
      on:aiAnalysis={handleAiAnalysis}
    />
  {:else if $appState.step === 'scraping'}
    <ScrapingProgress
      progress={$appState.progress}
      baseUrl={$appState.analysis?.baseUrl || ''}
      on:download={handleDownload}
      on:reset={handleReset}
    />
  {/if}
</main>

<style>
  main {
    width: 100%;
    min-height: 100vh;
  }
</style>