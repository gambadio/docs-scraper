/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="@sveltejs/kit" />

declare module 'svelte' {
  export function createEventDispatcher<T extends Record<string, any> = any>(): (
    type: keyof T,
    detail?: T[keyof T]
  ) => void;
}

declare global {
  namespace svelteHTML {
    interface HTMLAttributes<T> {
      'on:click'?: (event: MouseEvent) => void;
      'on:keydown'?: (event: KeyboardEvent) => void;
      'on:change'?: (event: Event) => void;
      role?: string;
      tabindex?: number;
      'aria-label'?: string;
      'aria-labelledby'?: string;
      'aria-describedby'?: string;
      'aria-modal'?: boolean | string;
    }
  }
}
