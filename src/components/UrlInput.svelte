<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();

  let url = '';
  let isLoading = false;
  let error = '';
  let showMinigame = false;

  const funnyPlaceholders = [
    "https://docs.isuck.com",
    "https://bauhaus-rules.com/docs",
    "https://give-me-the-frickin-docs.com",
    "https://scrape-me-daddy.com"
  ];
  let placeholder = funnyPlaceholders[0];

  function isValidUrl(string: string) {
    try {
      const newUrl = new URL(string);
      return newUrl.protocol === 'http:' || newUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function handleSubmit() {
    if (isLoading) return;
    if (!url.trim() || !isValidUrl(url)) {
      error = 'URL is borked. Please provide a real one.';
      return;
    }
    error = '';
    isLoading = true;
    // Fake delay to show loading state
    setTimeout(() => {
      dispatch('submit', { url });
      isLoading = false;
    }, 1500);
  }

  function toggleMinigame() {
    showMinigame = !showMinigame;
  }

  // Cycle through placeholders
  setInterval(() => {
    placeholder = funnyPlaceholders[Math.floor(Math.random() * funnyPlaceholders.length)];
  }, 3000);
</script>

<div class="page-wrapper">
  <header class="main-header">
    <div class="logo">
      <svg width="44" height="34" viewBox="0 0 44 34" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="20" height="34" fill="#D92D20"/>
        <rect x="24" width="20" height="34" fill="#0D69F2"/>
      </svg>
      <span>DocScraper</span>
    </div>
    <div class="header-fun-zone">
      <span class="fun-text">Bored?</span>
      <button on:click={toggleMinigame} class="secondary">Play a Game!</button>
    </div>
  </header>

  <main class="content-area">
    <div class="intro-text">
      <h1>Let's Snatch Some Docs</h1>
      <p>Feed me a URL. I'll chew it up and spit out some sweet, sweet PDFs. No questions asked. Except for the URL. I need that.</p>
    </div>

    <div class="input-container">
      <div class="input-wrapper">
        <input
          type="url"
          bind:value={url}
          on:keydown={(e) => e.key === 'Enter' && handleSubmit()}
          {placeholder}
          disabled={isLoading}
        />
        <button
          type="button"
          class="go-button"
          on:click={handleSubmit}
          class:loading={isLoading}
          disabled={isLoading}
          aria-label="Submit URL"
        >
          {#if isLoading}
            <div class="spinner">
              <div class="dot1"></div>
              <div class="dot2"></div>
              <div class="dot3"></div>
            </div>
          {:else}
            <span>GO!</span>
          {/if}
        </button>
      </div>
    </div>
    {#if error}
      <p class="error-message">{error}</p>
    {/if}
  </main>

  {#if showMinigame}
    <div class="minigame-placeholder">
      <h2>Placeholder for Minigame</h2>
      <p>Imagine a fun Bauhaus-themed minigame here. Maybe you stack geometric shapes, or play a simple arcade game. This is where you would add your interactive element.</p>
      <p><strong>To implement this:</strong> You could create a new Svelte component (e.g., `Minigame.svelte`) and import it here. The game logic would live inside that component.</p>
      <button on:click={toggleMinigame}>Close Game</button>
    </div>
  {/if}

  <footer class="main-footer">
    <p>Made with geometric love & too much coffee.</p>
    <div class="footer-shapes">
      <div class="shape-sm red"></div>
      <div class="shape-sm yellow"></div>
      <div class="shape-sm blue"></div>
    </div>
  </footer>
</div>

<style>
  /* Page Layout & Shapes */
  .page-wrapper {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding: 2rem 3rem;
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
  }

  /* Header */
  .main-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-bottom: 5vh;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-family: var(--font-display);
    font-size: 1.8rem;
    font-weight: 900;
  }
  .header-fun-zone {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .fun-text {
    font-family: var(--font-sans);
    font-weight: 700;
    opacity: 0.7;
  }

  /* Main Content */
  .content-area {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
  }
  .intro-text h1 {
    margin-bottom: 1rem;
  }
  .intro-text p {
    margin-bottom: 3rem;
  }

  /* Input Area */
  .input-container {
    width: 100%;
    max-width: 700px;
  }
  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    border: 4px solid var(--bauhaus-black);
    border-radius: 16px;
    background-color: var(--bauhaus-white);
    overflow: hidden;
  }
  input {
    flex-grow: 1;
    border: none;
    padding: 1.2rem 1.5rem;
    font-size: 1.2rem;
    background-color: transparent;
    color: var(--bauhaus-black);
    font-family: var(--font-sans);
    outline: none;
    height: 60px;
    box-sizing: border-box;
  }
  input:focus {
    outline: none;
  }
  .go-button {
    height: 60px;
    padding: 0 1.5rem;
    background: var(--bauhaus-yellow);
    color: var(--bauhaus-black);
    border: none;
    border-left: 4px solid var(--bauhaus-black);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 900;
    text-transform: uppercase;
    cursor: pointer;
    transition: background-color 0.15s ease;
    flex-shrink: 0;
  }
  .go-button:hover {
    background: var(--bauhaus-red);
    color: var(--bauhaus-white);
  }
  .go-button.loading {
    background: var(--bauhaus-blue);
    color: var(--bauhaus-white);
  }
  .error-message {
    color: var(--bauhaus-red);
    font-weight: bold;
    margin-top: 1rem;
    min-height: 1.5rem;
  }

  /* Spinner Animation */
  .spinner {
    margin: 0 auto;
    width: 40px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-around;
  }
  .spinner > div {
    width: 10px;
    height: 10px;
    background-color: var(--bauhaus-white);
    border-radius: 100%;
    display: inline-block;
    animation: sk-bouncedelay 1.4s infinite ease-in-out both;
  }
  .spinner .dot1 { animation-delay: -0.32s; }
  .spinner .dot2 { animation-delay: -0.16s; }
  @keyframes sk-bouncedelay {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1.0); }
  }

  /* Minigame Placeholder */
  .minigame-placeholder {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 500px;
    background: var(--bauhaus-card);
    border: 4px solid var(--bauhaus-black);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 10px 10px 0 var(--bauhaus-black);
    z-index: 100;
    text-align: center;
  }

  /* Footer */
  .main-footer {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 2rem;
    margin-top: 5vh;
    border-top: 4px solid var(--bauhaus-black);
  }
  .footer-shapes { display: flex; gap: 0.5rem; }
  .shape-sm { width: 20px; height: 20px; }
  .shape-sm.red { background: var(--bauhaus-red); }
  .shape-sm.yellow { background: var(--bauhaus-yellow); }
  .shape-sm.blue { background: var(--bauhaus-blue); }
</style>