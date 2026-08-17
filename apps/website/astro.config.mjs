// @ts-check
import { defineConfig, fontProviders } from "astro/config";

import tailwind from "@astrojs/tailwind";

import mdx from "@astrojs/mdx";

import react from "@astrojs/react";

import expressiveCode from "astro-expressive-code";

import node from "@astrojs/node";

import icon from "astro-icon";

import sitemap from "@astrojs/sitemap";

// import AstroPWA from "@vite-pwa/astro";

// During `astro dev`, Vite's module runner inlines SSR modules and chokes on
// react-dom's CommonJS `server.node.js` ("require is not defined"). Only bundle
// React into the SSR build for production, where standalone Docker deploys need
// it. https://astro.build/config
const isDev = process.argv.includes("dev");

// https://astro.build/config
export default defineConfig({
  site: "https://ieeeatucsd.org",
  output: "server",
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    expressiveCode(),
    react(),
    icon(),
    mdx(),
    sitemap({
      filter: (page) =>
        !page.includes("/dashboard/") &&
        !page.includes("/api/") &&
        !page.includes("/accept-invitation/"),
    }),
  ],

  adapter: node({
    mode: "standalone",
  }),

  experimental: {
    fonts: [
      {
        provider: fontProviders.fontsource(),
        name: "IBM Plex Sans",
        cssVariable: "--font-ibm-plex-sans",
        weights: [200, 300, 400, 500, 600, 700],
        styles: ["normal"],
        subsets: ["latin"],
        fallbacks: ["sans-serif"],
      },
    ],
  },

  server: {
    host: true,
    port: process.env.PORT ? Number(process.env.PORT) : 4321,
  },
  // Define environment variables that should be available to client components
  vite: {
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      exclude: [
        "chunk-GP4JL5D5.js",
        // Avoid scanning Node-only scripts that contain require/module usage
      ],
    },
    ssr: {
      // Bundle React into the server build so standalone deploys don't need
      // hoisted workspace node_modules for bare `import 'react'` in renderers.mjs.
      // Skip in dev: the Vite module runner can't execute react-dom's CJS server entry.
      noExternal: isDev ? [] : ["react", "react-dom"],
      optimizeDeps: {
        include: [
          "react",
          "react-dom",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
        ],
      },
    },
  },
});
