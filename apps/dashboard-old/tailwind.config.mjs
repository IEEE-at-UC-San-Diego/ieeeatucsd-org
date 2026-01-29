/** @type {import('tailwindcss').Config} */
import preset from "@ieeeatucsd/config/tailwind";

export default {
  presets: [preset],
  content: [
    "./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
    // HeroUI theme paths - support both local Bun hoisting and Docker layouts
    // Bun local dev (hoisted to .bun/ directory)
    "../../node_modules/.bun/@heroui+theme*/node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
    // Docker/standard npm layouts
    "../../node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
};
