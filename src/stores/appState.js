import { writable } from 'svelte/store';

function createAppState() {
  const { subscribe, set, update } = writable({
    step: 'input', // 'input' | 'analysis' | 'scraping'
    analysis: null,
    sessionId: null,
    progress: null,
    totalPages: 0
  });

  return {
    subscribe,
    setAnalysis: (analysis) => update(state => ({
      ...state,
      step: 'analysis',
      analysis
    })),
    startScraping: (sessionId, totalPages) => update(state => ({
      ...state,
      step: 'scraping',
      sessionId,
      totalPages,
      progress: {
        status: 'running',
        progress: 0,
        completed: 0,
        failed: 0,
        total: totalPages
      }
    })),
    updateProgress: (progress) => update(state => ({
      ...state,
      progress
    })),
    reset: () => set({
      step: 'input',
      analysis: null,
      sessionId: null,
      progress: null,
      totalPages: 0
    })
  };
}

export const appState = createAppState();