/// <reference types="svelte" />
/// <reference types="vite/client" />

declare namespace svelteHTML {
  interface HTMLAttributes<T> {
    'on:click'?: (event: CustomEvent<any> | MouseEvent) => void;
    'on:change'?: (event: Event) => void;
  }
}
