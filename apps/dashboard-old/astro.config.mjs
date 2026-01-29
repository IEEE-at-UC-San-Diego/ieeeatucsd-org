// @ts-check
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";

import tailwind from "@astrojs/tailwind";

import mdx from "@astrojs/mdx";

import react from "@astrojs/react";

import expressiveCode from "astro-expressive-code";

import node from "@astrojs/node";

import icon from "astro-icon";

import sitemap from "@astrojs/sitemap";

// import AstroPWA from "@vite-pwa/astro";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// https://astro.build/config
export default defineConfig({
  site: "https://ieeeatucsd.org",
  output: "server",
  integrations: [
    tailwind({
      applyBaseStyles: true,
    }),
    expressiveCode(),
    react(),
    icon(),
    mdx(),
    sitemap(),
    // PWA support is implemented manually for dashboard-only scope
    // See public/dashboard/sw.js and src/components/dashboard/shared/DashboardHead.astro
  ],

  adapter: node({
    mode: "standalone",
  }),

  server: {
    host: true,
    port: process.env.PORT ? Number(process.env.PORT) : 4321,
  },
  // Define environment variables that should be available to client components
  vite: {
    define: {
      // Firebase client config
      "import.meta.env.PUBLIC_FIREBASE_WEB_API_KEY": JSON.stringify(
        process.env.PUBLIC_FIREBASE_WEB_API_KEY,
      ),
      "import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN": JSON.stringify(
        process.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
      ),
      "import.meta.env.PUBLIC_FIREBASE_PROJECT_ID": JSON.stringify(
        process.env.PUBLIC_FIREBASE_PROJECT_ID,
      ),
      "import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET": JSON.stringify(
        process.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
      ),
      "import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID": JSON.stringify(
        process.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      ),
      "import.meta.env.PUBLIC_FIREBASE_APP_ID": JSON.stringify(
        process.env.PUBLIC_FIREBASE_APP_ID,
      ),
      // Qdrant config (server-side)
      "import.meta.env.QDRANT_URL": JSON.stringify(
        process.env.QDRANT_URL,
      ),
      "import.meta.env.QDRANT_API_KEY": JSON.stringify(
        process.env.QDRANT_API_KEY,
      ),
    },
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      exclude: [
        "chunk-GP4JL5D5.js",
        // Avoid scanning Node-only scripts that contain require/module usage
      ],
    },
  },
});
