/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      boxShadow: {
        'glow': '0 0 0.5vw 0.1vw rgba(255, 255, 255, 0.3), 0 0 1vw 0.5vw rgba(255, 255, 255, 0.1)',
      },
      colors: {
        ieee: {
          yellow: "#F3C135",
          black: "#0A0E1A",
          "blue-100": "#88BFEC",
        },

        ieee_online_store_bg: "#f3c135",
        ieee_blue: "#00629b",
        ieee_gold_text: "#ffbc00",

        // Layout colors
        bg_primary: "#0a0e1b",
        top_gradient: "#1c284e",

        // Main Page Card colors
        card_bg: "#0d1324",
        card_text: "#eaf7ff",
        card_gradient: "#FFFFFF",

        // Project Page Card colors
        project_card_bg: "#0d1324",
      },
      backgroundImage: {
        "gradient-radial":
          "radial-gradient(circle at 0% 0%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [require("tailwindcss-motion"), require("tailwindcss-animated")],
};
