<script lang="ts">
  import type { Progress } from '../stores/appState';
  import { createEventDispatcher } from 'svelte';

  export let progress: Progress | null = null;
  export let baseUrl: string = '';

  const dispatch = createEventDispatcher();

  function handleDownload() {
    dispatch('download');
  }

  function handleReset() {
    dispatch('reset');
  }
</script>

{#if progress}
  <div class="page-wrapper {progress.status}">
    
    {#if progress.status === 'running'}
      <div class="running-wrapper">
        <h2 class="running-title">THE MACHINES ARE WORKING</h2>
        <div class="progress-ui">
          <svg class="progress-ring" viewBox="0 0 100 100">
            <circle class="bg" cx="50" cy="50" r="45" />
            <circle class="fg" cx="50" cy="50" r="45" style="stroke-dasharray: {2 * Math.PI * 45}; stroke-dashoffset: {2 * Math.PI * 45 * (1 - progress.progress / 100)};" />
          </svg>
          <div class="progress-text">
            <span>{progress.progress}</span>%
          </div>
        </div>
        <p class="running-subtitle">Grabbing bits and bytes from...<br/>{baseUrl}</p>
      </div>

    {:else if progress.status === 'completed'}
      <div class="completed-wrapper">
        <div class="graphic-placeholder">
          <!--
            Placeholder for a fun vector graphic.
            I recommend adding a triumphant or cool SVG illustration here.
            For example, a robot holding a stack of papers, or a stylized factory producing documents.
            It should be colorful and match the Bauhaus theme.
            Example: <img src="/triumphant-robot.svg" alt="Scraping Complete!">
          -->
          <svg class="placeholder-svg" viewBox="0 0 100 100">
            <rect x="10" y="10" width="80" height="80" stroke-width="4" />
            <path d="M30 70 L 50 40 L 70 70 Z" stroke-width="4" />
            <circle cx="50" cy="30" r="10" stroke-width="4" />
          </svg>
          <span>Your awesome graphic here!</span>
        </div>
        <h2>Success! It is done.</h2>
        <p>{progress.completed} pages are now yours for the taking.</p>
        <div class="action-buttons">
          <button on:click={handleDownload} class="secondary">Download ZIP</button>
          <button on:click={handleReset}>Scrape Again</button>
        </div>
      </div>

    {:else if progress.status === 'failed'}
      <div class="failed-wrapper">
        <div class="failed-icon">!</div>
        <h2>Houston, we have a problem.</h2>
        <p>{progress.error || 'Something went very, very wrong. The internet goblins strike again.'}</p>
        <button on:click={handleReset} class="primary">Let's Go Again</button>
      </div>
    {/if}

  </div>
{/if}

<style>
  .page-wrapper {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
    text-align: center;
  }

  /* Running State */
  .running {
    background-color: var(--bauhaus-bg);
    color: var(--bauhaus-white);
  }
  .running-wrapper {
    position: relative;
  }
  .running-title {
    font-size: clamp(1.5rem, 5vw, 2rem);
    color: var(--bauhaus-white);
    opacity: 0.5;
    margin-bottom: 2rem;
    position: relative;
  }
  .progress-ui {
    position: relative;
    width: clamp(250px, 40vw, 400px);
    margin: 0 auto;
  }
  .progress-ring {
    transform: rotate(-90deg);
  }
  .progress-ring circle {
    fill: transparent;
    stroke-width: 8;
  }
  .progress-ring .bg {
    stroke: rgba(255,255,255,0.1);
  }
  .progress-ring .fg {
    stroke: var(--bauhaus-yellow);
    stroke-linecap: round;
    transition: stroke-dashoffset 0.3s;
  }
  .progress-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-family: var(--font-display);
    font-size: clamp(4rem, 10vw, 6rem);
    color: var(--bauhaus-white);
  }
  .progress-text span {
    animation: text-throb 1s ease-in-out infinite;
  }
  @keyframes text-throb {
    50% { opacity: 0.8; transform: scale(1.02); }
  }
  .running-subtitle {
    margin-top: 2rem;
    color: var(--bauhaus-white);
    opacity: 0.6;
    position: relative;
    line-height: 1.4;
  }

  /* Completed State */
  .completed {
    background-color: var(--bauhaus-card);
    color: var(--bauhaus-black);
  }
  .completed-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }
  .graphic-placeholder {
    width: 200px;
    height: 150px;
    border: 4px dashed var(--bauhaus-light-gray);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--bauhaus-light-gray);
    font-weight: bold;
  }
  .placeholder-svg {
    width: 50%;
    height: 50%;
    fill: none;
    stroke: var(--bauhaus-light-gray);
  }
  .completed-wrapper h2 {
    font-size: clamp(2.5rem, 8vw, 5rem);
  }
  .action-buttons {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }

  /* Failed State */
  .failed {
    background-color: var(--bauhaus-red);
    color: var(--bauhaus-white);
  }
  .failed-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }
  .failed-icon {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    border: 8px solid var(--bauhaus-white);
    font-size: 4rem;
    font-family: var(--font-display);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: shake 0.5s;
  }
  @keyframes shake {
    10%, 90% { transform: translate3d(-1px, 0, 0); }
    20%, 80% { transform: translate3d(2px, 0, 0); }
    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
    40%, 60% { transform: translate3d(4px, 0, 0); }
  }
  .failed-wrapper h2 {
    color: var(--bauhaus-white);
  }
  .failed-wrapper p {
    color: var(--bauhaus-white);
    opacity: 0.9;
  }
</style>