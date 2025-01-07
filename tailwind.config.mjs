/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  safelist: [
    "col-span-1",
    "col-span-2",
    "col-span-3",
    "col-span-4",
    "animate-delay-100",
    "animate-delay-300",
    "animate-delay-500",
    "animate-delay-700"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 0 0.5vw 0.1vw rgba(255, 255, 255, 0.3), 0 0 1vw 0.5vw rgba(255, 255, 255, 0.1)",
      },
      colors: {
        ieee: {
          yellow: "#F3C135",
          black: "#0A0E1A",
          "blue-100": "#88BFEC",
          "blue-300": "#233363",
        },

        // Project Page Card colors
        project_card_bg: "#0d1324",
      },
      backgroundImage: {
        "gradient-radial":
          "radial-gradient(circle at 0% 0%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [
    require("tailwindcss-motion"),
    require("tailwindcss-animated"),
    function ({ addVariant }) {
      addVariant("in-view", "&.in-view");
    },],
};
