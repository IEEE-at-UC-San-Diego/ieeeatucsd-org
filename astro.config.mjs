// @ts-check
import { defineConfig } from 'astro/config';

import tailwind from '@astrojs/tailwind';

import mdx from '@astrojs/mdx';

import react from '@astrojs/react';

import expressiveCode from 'astro-expressive-code';

import node from '@astrojs/node';

import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), mdx(), react(), expressiveCode(), icon()],

  adapter: node({
    mode: 'standalone'
  })
});