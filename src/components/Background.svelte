<script lang="ts">
  import { onMount } from 'svelte';

  interface Shape {
    type: 'circle' | 'rect' | 'triangle';
    color: string;
    x: number;
    y: number;
    size: number;
    rotation: number;
    opacity: number;
  }

  let shapes: Shape[] = [];

  onMount(() => {
    shapes = [
      // Main composition based on the new image
      { type: 'circle', color: 'var(--bauhaus-yellow)', x: 12, y: 18, size: 28, rotation: 0, opacity: 0.7 },
      { type: 'rect', color: 'var(--bauhaus-blue)', x: 80, y: 85, size: 22, rotation: -25, opacity: 0.9 },
      { type: 'triangle', color: 'var(--bauhaus-red)', x: 82, y: 90, size: 18, rotation: 160, opacity: 0.8 },

      // Subtle background elements
      { type: 'triangle', color: 'var(--bauhaus-yellow)', x: 50, y: 22, size: 8, rotation: 0, opacity: 0.4 },
      { type: 'rect', color: 'var(--bauhaus-light-gray)', x: 70, y: 30, size: 12, rotation: 90, opacity: 0.8 },
      { type: 'rect', color: 'var(--bauhaus-light-gray)', x: 30, y: 45, size: 15, rotation: 90, opacity: 0.8 },
      { type: 'circle', color: 'var(--bauhaus-red)', x: 65, y: 60, size: 5, rotation: 0, opacity: 0.2 },
      { type: 'circle', color: 'var(--bauhaus-blue)', x: 35, y: 62, size: 6, rotation: 0, opacity: 0.15 },
      
      // Bottom elements
      { type: 'circle', color: 'var(--bauhaus-light-gray)', x: 88, y: 95, size: 4, rotation: 0, opacity: 0.7 },
      { type: 'circle', color: 'var(--bauhaus-red)', x: 20, y: 92, size: 9, rotation: 0, opacity: 0.3 },
    ];
  });
</script>

<div class="background-container">
  {#each shapes as shape}
    <div
      class="shape {shape.type}"
      style="
        --shape-bg: {shape.color};
        --x: {shape.x}vw;
        --y: {shape.y}vh;
        --size: {shape.size}vmin;
        --rotation: {shape.rotation}deg;
        --opacity: {shape.opacity};
      "
    ></div>
  {/each}
</div>

<style>
  .background-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: -1;
    overflow: hidden;
  }

  .shape {
    position: absolute;
    background-color: var(--shape-bg);
    top: var(--y);
    left: var(--x);
    width: var(--size);
    height: var(--size);
    transform: translate(-50%, -50%) rotate(var(--rotation));
    opacity: var(--opacity);
    mix-blend-mode: multiply;
  }

  .shape.circle {
    border-radius: 50%;
  }

  .shape.triangle {
    background-color: transparent;
    width: 0;
    height: 0;
    border-left: calc(var(--size) / 2) solid transparent;
    border-right: calc(var(--size) / 2) solid transparent;
    border-bottom: var(--size) solid var(--shape-bg);
  }
</style>