import { writable } from 'svelte/store';

export interface Link {
  url: string;
  title: string;
}

export interface Analysis {
  baseUrl: string;
  links: Link[];
  screenshot: string;
}

export interface Progress {
  status: 'running' | 'completed' | 'failed';
  progress: number;
  completed: number;
  failed: number;
  total: number;
  error?: string;
}

export interface AppState {
  step: 'input' | 'analysis' | 'scraping';
  analysis: Analysis | null;
  sessionId: string | null;
  progress: Progress | null;
  totalPages: number;
}

function createAppState() {
  const { subscribe, set, update } = writable<AppState>({
    step: 'input',
    analysis: null,
    sessionId: null,
    progress: null,
    totalPages: 0
  });

  return {
    subscribe,
    setAnalysis: (analysis: Analysis) => update(state => ({
      ...state,
      step: 'analysis',
      analysis
    })),
    startScraping: (sessionId: string, totalPages: number) => update(state => ({
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
    updateProgress: (progress: Progress) => update(state => ({
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