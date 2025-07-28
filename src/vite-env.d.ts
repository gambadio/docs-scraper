/// <reference types="svelte" />
/// <reference types="vite/client" />

declare namespace svelteHTML {
  interface HTMLAttributes<T> {
    'on:click'?: (event: CustomEvent<any> | MouseEvent) => void;
    'on:keydown'?: (event: KeyboardEvent) => void;
    'on:change'?: (event: Event) => void;
    role?: string;
    tabindex?: number;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
    'aria-modal'?: boolean;
  }
}
