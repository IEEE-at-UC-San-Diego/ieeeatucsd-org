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
      "import.meta.env.LOGTO_APP_ID": JSON.stringify(process.env.LOGTO_APP_ID),
      "import.meta.env.LOGTO_APP_SECRET": JSON.stringify(
        process.env.LOGTO_APP_SECRET,
      ),
      "import.meta.env.LOGTO_ENDPOINT": JSON.stringify(
        process.env.LOGTO_ENDPOINT,
      ),
      "import.meta.env.LOGTO_TOKEN_ENDPOINT": JSON.stringify(
        process.env.LOGTO_TOKEN_ENDPOINT,
      ),
      "import.meta.env.LOGTO_API_ENDPOINT": JSON.stringify(
        process.env.LOGTO_API_ENDPOINT,
      ),
    },
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      exclude: [
        // Avoid scanning Node-only scripts that contain require/module usage
        "src/scripts/testFileMigration.ts",
        "src/scripts/runFileMigration.ts",
      ],
    },
  },
});
