// @ts-check
import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

import mdx from "@astrojs/mdx";

import react from "@astrojs/react";

import expressiveCode from "astro-expressive-code";

import node from "@astrojs/node";

import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [tailwind(), expressiveCode(), react(), icon(), mdx()],

  adapter: node({
    mode: "standalone",
  }),

  // Define environment variables that should be available to client components
  vite: {
    define: {
      "import.meta.env.PUBLIC_LOGTO_APP_ID": JSON.stringify(
        process.env.PUBLIC_LOGTO_APP_ID,
      ),
      "import.meta.env.PUBLIC_LOGTO_APP_SECRET": JSON.stringify(
        process.env.PUBLIC_LOGTO_APP_SECRET,
      ),
      "import.meta.env.PUBLIC_LOGTO_ENDPOINT": JSON.stringify(
        process.env.PUBLIC_LOGTO_ENDPOINT,
      ),
      "import.meta.env.PUBLIC_LOGTO_TOKEN_ENDPOINT": JSON.stringify(
        process.env.PUBLIC_LOGTO_TOKEN_ENDPOINT,
      ),
      "import.meta.env.PUBLIC_LOGTO_API_ENDPOINT": JSON.stringify(
        process.env.PUBLIC_LOGTO_API_ENDPOINT,
      ),
    },
  },
});
