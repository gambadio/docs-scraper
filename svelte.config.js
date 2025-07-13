// svelte.config.js
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),

  kit: {
    // builds a plain Node server in /build so you can still mount
    // your custom Express routes in production if you like
    adapter: adapter(),

    // optional but handy
    alias: {
      $lib       : 'src/lib',
      $components: 'src/lib/components'
    }
  }
};