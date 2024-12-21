/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        ieee_online_store_bg: "#f3c135",
        ieee_blue: "#00629b",
        ieee_gold_text: "#ffbc00",

        // Navigation colors
        nav_bg: "#090d19",
        nav_text: "#eaf7ff",

        // Layout colors
        bg_primary: "#0a0e1b",
        top_gradient: "#1c284e",

        // Main Page Card colors
        card_bg: "#0d1324",
        card_text: "#eaf7ff",
        card_gradient: "#FFFFFF",

        // Project Page Card colors
        project_card_bg: "#0d1324",
        project_card_text: "#FFFFFF",
        project_card_gradient: "#000000",
        project_button_bg: "#FFFFFF",
        project_button_color: "#000000",
      },
      backgroundImage: {
        "gradient-radial":
          "radial-gradient(circle at 0% 0%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [require("tailwindcss-motion"), require("tailwindcss-animated")],
};
