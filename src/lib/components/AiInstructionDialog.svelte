<script lang="ts">
  // @ts-nocheck
  import { createEventDispatcher } from 'svelte';

  export let isOpen: boolean = false;

  let purpose: string = '';
  const dispatch = createEventDispatcher<{
    submit: { purpose: string };
    cancel: void;
  }>();

  function handleSubmit(): void {
    const trimmedPurpose = purpose.trim();
    if (trimmedPurpose.length > 0) {
      dispatch('submit', { purpose: trimmedPurpose });
      purpose = '';
    }
  }

  function handleCancel(): void {
    dispatch('cancel');
    purpose = '';
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    }
  }

  function handleOverlayClick(event: Event): void {
    const mouseEvent = event as MouseEvent;
    // Only close if clicking directly on overlay, not on dialog
    if (mouseEvent.target === mouseEvent.currentTarget) {
      handleCancel();
    }
  }

  function handleOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCancel();
    }
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<!-- @ts-nocheck -->
{#if isOpen}
<div
  class="overlay"
  on:click={handleOverlayClick}
  on:keydown={handleOverlayKeydown}
  role="button"
  tabindex="0"
  aria-label="Close dialog"
>
  <div
    class="dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="dialog-title"
  >
    <h3 id="dialog-title">Help me understand what you're looking for</h3>
    <p>Describe what kind of documentation you want to scrape. This helps me select the most relevant links for your needs.</p>
    
    <textarea
      bind:value={purpose}
      placeholder="e.g., I want to scrape all API documentation, or I need the tutorial sections, or I'm looking for component references..."
      rows="4"
      maxlength="1000"
      aria-label="Describe what documentation you want to scrape"
      aria-describedby="textarea-description"
      on:keydown={handleKeydown}
    />
    <span id="textarea-description" class="sr-only">
      Provide a clear description of the documentation you want to scrape. This helps the AI understand your needs better.
    </span>
    
    <div class="actions">
      <button class="cancel-btn" on:click={handleCancel}>Cancel</button>
      <button class="submit-btn" on:click={handleSubmit} disabled={!purpose.trim()}>
        Analyze with AI
      </button>
    </div>
  </div>
</div>
{/if}

<style>
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog {
    background-color: var(--bauhaus-card);
    border: 4px solid var(--bauhaus-black);
    border-radius: 12px;
    padding: 2rem;
    max-width: 500px;
    width: 90%;
    box-shadow: 8px 8px 0 var(--bauhaus-black);
  }

  h3 {
    margin-bottom: 1rem;
    font-family: var(--font-display);
    color: var(--bauhaus-black);
  }

  p {
    margin-bottom: 1.5rem;
    opacity: 0.8;
  }

  textarea {
    width: 100%;
    padding: 1rem;
    border: 4px solid var(--bauhaus-black);
    border-radius: 8px;
    font-family: inherit;
    font-size: 1rem;
    resize: vertical;
    min-height: 100px;
    background-color: var(--bauhaus-white);
  }

  textarea:focus {
    outline: none;
    border-color: var(--bauhaus-blue);
  }

  .actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
  }

  .cancel-btn, .submit-btn {
    padding: 0.8rem 1.5rem;
    font-size: 1rem;
    border: 4px solid var(--bauhaus-black);
    border-radius: 8px;
    cursor: pointer;
    transition: transform 0.1s;
    font-family: var(--font-display);
  }

  .cancel-btn {
    background-color: var(--bauhaus-light-gray);
    color: var(--bauhaus-black);
  }

  .submit-btn {
    background-color: var(--bauhaus-blue);
    color: var(--text-light);
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cancel-btn:hover:not(:disabled),
  .submit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  .cancel-btn:active,
  .submit-btn:active {
    transform: translateY(0);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .dialog:focus-visible {
    outline: 2px solid var(--bauhaus-blue);
    outline-offset: 2px;
  }
</style>