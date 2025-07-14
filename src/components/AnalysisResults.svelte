<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Analysis, Link } from '../stores/appState';

  export let analysis: Analysis | null = null;

  let selectedLinks: string[] = [];
  $: if (analysis?.links) {
    selectedLinks = analysis.links.map(link => link.url);
  }

  const dispatch = createEventDispatcher();

  function toggleLink(url: string) {
    if (selectedLinks.includes(url)) {
      selectedLinks = selectedLinks.filter(u => u !== url);
    } else {
      selectedLinks = [...selectedLinks, url];
    }
  }

  function startScraping() {
    dispatch('startScraping', { links: selectedLinks });
  }
  
  function selectAll() {
    if (analysis) {
      selectedLinks = analysis.links.map(link => link.url);
    }
  }

  function deselectAll() {
    selectedLinks = [];
  }
</script>

{#if analysis}
<div class="page-container">
  <div class="summary-section">
    <div class="summary-content">
      <h2>I've found some stuff.</h2>
      <p class="site-url">Looks like we're scraping <a href={analysis.baseUrl} target="_blank">{analysis.baseUrl}</a></p>
      
      <div class="stats">
        <div class="stat">
          <span class="number">{analysis.links.length}</span>
          <span class="label">things to grab</span>
        </div>
        <div class="stat">
          <span class="number selected">{selectedLinks.length}</span>
          <span class="label">things you want</span>
        </div>
      </div>
  
      <button class="start-btn secondary" on:click={startScraping} disabled={selectedLinks.length === 0}>
        Let's get scraping! ({selectedLinks.length})
      </button>
    </div>
    <div class="summary-bg-shape"></div>
  </div>

  <div class="links-section">
    <div class="links-header">
      <h3>Pick your poison</h3>
      <div class="selection-controls">
        <button on:click={selectAll}>Select All</button>
        <button on:click={deselectAll}>Deselect All</button>
        <button class="primary" on:click={() => dispatch('reset')}>Start Over</button>
      </div>
    </div>
    <div class="links-list-wrapper">
      <div class="links-list">
        {#each analysis.links as link (link.url)}
          <label class="link-item" class:selected={selectedLinks.includes(link.url)}>
            <div class="checkbox-wrapper">
              <input
                type="checkbox"
                checked={selectedLinks.includes(link.url)}
                on:change={() => toggleLink(link.url)}
              />
              <div class="custom-checkbox">
                {#if selectedLinks.includes(link.url)}
                  <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                {/if}
              </div>
            </div>
            <div class="link-info">
              <p class="link-title">{link.title || "No title, how mysterious..."}</p>
              <p class="link-url">{link.url}</p>
            </div>
            <div class="page-count">
              <span>{link.url.split('/').length - 3}</span>
            </div>
          </label>
        {/each}
      </div>
    </div>
  </div>
</div>
{/if}

<style>
  .page-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--bauhaus-card);
  }

  /* Summary Section */
  .summary-section {
    background-color: var(--bauhaus-yellow);
    padding: 2rem 3rem;
    border-bottom: 4px solid var(--bauhaus-black);
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .summary-content {
    position: relative;
    z-index: 1;
  }
  .summary-content h2 {
    margin-bottom: 0.5rem;
  }
  .site-url {
    margin-bottom: 2rem;
  }
  .site-url a {
    color: var(--bauhaus-black);
    font-weight: bold;
  }

  .stats {
    display: flex;
    justify-content: center;
    gap: 4rem;
    margin-bottom: 2.5rem;
  }
  .stat .number {
    font-size: clamp(4rem, 10vw, 6rem);
    line-height: 1;
  }
  .stat .label {
    font-family: var(--font-display);
    font-size: 1.2rem;
    opacity: 0.8;
  }
  .stat .number.selected {
    color: var(--bauhaus-blue);
  }
  
  .start-btn {
    padding: 1rem 2.5rem;
    font-size: 1.2rem;
  }

  /* Links Section */
  .links-section {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 2rem 3rem;
  }
  .links-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-shrink: 0;
  }
  .links-header h3 {
    color: var(--bauhaus-black);
  }
  .selection-controls {
    display: flex;
    gap: 1rem;
  }
  .selection-controls button {
    font-size: 0.9rem;
    padding: 0.6em 1.2em;
  }

  .links-list-wrapper {
    flex-grow: 1;
    overflow-y: auto;
    margin: 0 -1rem; /* Hide scrollbar visually */
    padding: 0 1rem;
  }

  /* Custom Checkbox */
  .checkbox-wrapper {
    position: relative;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
  }
  .link-item input[type="checkbox"] {
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }
  .custom-checkbox {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: 4px solid var(--bauhaus-black);
    border-radius: 4px;
    background: var(--bauhaus-white);
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  .link-item:hover .custom-checkbox {
    background: var(--bauhaus-light-gray);
  }
  .link-item.selected .custom-checkbox {
    background: var(--bauhaus-blue);
  }
  .custom-checkbox svg {
    width: 24px;
    height: 24px;
    fill: var(--bauhaus-white);
    transform: scale(0);
    transition: transform 0.1s ease-out;
  }
  .link-item.selected .custom-checkbox svg {
    transform: scale(1);
  }

  /* Link Item */
  .links-list {
    display: grid;
    gap: 1rem;
  }
  .link-item {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 1rem;
    cursor: pointer;
    border: 4px solid var(--bauhaus-black);
    border-radius: 8px;
    background-color: var(--bauhaus-card);
    color: var(--text-dark);
    transition: background-color 0.15s ease;
  }
  .link-item:hover {
    background-color: var(--bauhaus-light-gray);
  }
  .link-item.selected {
    background-color: var(--bauhaus-blue);
    color: var(--text-light);
  }
  .link-info {
    flex-grow: 1;
    text-align: left;
  }
  .link-title {
    font-family: var(--font-display);
    color: inherit;
    margin: 0;
  }
  .link-url {
    font-size: 0.8rem;
    opacity: 0.6;
    margin: 0;
    word-break: break-all;
  }
  .page-count {
    background-color: var(--bauhaus-red);
    color: var(--text-light);
    font-size: 1rem;
    font-family: var(--font-display);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 4px solid var(--bauhaus-black);
    flex-shrink: 0;
  }
</style>