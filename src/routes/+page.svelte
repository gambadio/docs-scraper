<script lang="ts">
  import UrlInput from '$lib/components/UrlInput.svelte';
  import AnalysisResults from '$lib/components/AnalysisResults.svelte';
  import ScrapingProgress from '$lib/components/ScrapingProgress.svelte';
  import { appState } from '$lib/stores/appState';
  import { analyzeUrl, startScraping, getProgress, downloadPdfs } from '../services/api';

  let progressInterval: ReturnType<typeof setInterval>;

  async function handleUrlSubmit(event: CustomEvent) {
    try {
      const analysis = await analyzeUrl(event.detail.url);
      appState.setAnalysis(analysis);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAiAnalysis() {
    if (!$appState.analysis) return;
    try {
      const analysis = await analyzeUrl($appState.analysis.baseUrl, true);
      appState.setAnalysis(analysis);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleStartScraping(event: CustomEvent) {
    if (!$appState.analysis) return;
    try {
      const session = await startScraping($appState.analysis.baseUrl, event.detail.links);
      appState.startScraping(session.sessionId, event.detail.links.length);
      
      progressInterval = setInterval(async () => {
        if (!$appState.sessionId) return;
        
        try {
          const newProgress = await getProgress($appState.sessionId);
          appState.updateProgress(newProgress);
          
          if (newProgress.status === 'completed' || newProgress.status === 'failed') {
            clearInterval(progressInterval);
          }
        } catch (err) {
          console.error('Progress update error:', err);
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
      await downloadPdfs($appState.sessionId);
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