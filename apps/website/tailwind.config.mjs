/** @type {import('tailwindcss').Config} */
import preset from "@ieeeatucsd/config/tailwind";

const ibmPlexSans = [
  "var(--font-ibm-plex-sans)",
  "ui-sans-serif",
  "system-ui",
  "sans-serif",
];

export default {
  presets: [preset],
  content: [
    "./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
    "../../node_modules/.pnpm/@heroui+theme@*/node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ibmPlexSans,
        display: ibmPlexSans,
        mono: ibmPlexSans,
      },
    },
  },
};
