/** @type {import('tailwindcss').Config} */
const { heroui } = require("@heroui/react");

export default {
  content: [
    "./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    "col-span-1",
    "col-span-2",
    "col-span-3",
    "col-span-4",
    "animate-delay-100",
    "animate-delay-300",
    "animate-delay-500",
    "animate-delay-700",
  ],
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
    daisyui: {
      themes: [
        {
          light: {
            primary: "#06659d",
            secondary: "#4b92db",
            accent: "#F3C135",
            neutral: "#2a323c",
            "base-100": "#ffffff",
            "base-200": "#f8f9fa",
            "base-300": "#e9ecef",
            info: "#3abff8",
            success: "#36d399",
            warning: "#fbbd23",
            error: "#f87272",
          },
          dark: {
            primary: "#88BFEC",
            secondary: "#4b92db",
            accent: "#F3C135",
            neutral: "#191D24",
            "base-100": "#0A0E1A",
            "base-200": "#0d1324",
            "base-300": "#1a2035",
            info: "#3abff8",
            success: "#36d399",
            warning: "#fbbd23",
            error: "#f87272",
          },
        },
      ],
    },
  },
  plugins: [
    require("tailwindcss-motion"),
    require("tailwindcss-animated"),
    require("daisyui"),
    function ({ addVariant }) {
      addVariant("in-view", "&.in-view");
    },
    heroui(),
  ],
  daisyui: {
    themes: [
      {
        light: {
          primary: "#06659d",
          secondary: "#4b92db",
          accent: "#F3C135",
          neutral: "#2a323c",
          "base-100": "#ffffff",
          "base-200": "#f8f9fa",
          "base-300": "#e9ecef",
          info: "#3abff8",
          success: "#36d399",
          warning: "#fbbd23",
          error: "#f87272",
        },
        dark: {
          primary: "#88BFEC",
          secondary: "#4b92db",
          accent: "#F3C135",
          neutral: "#191D24",
          "base-100": "#0A0E1A",
          "base-200": "#0d1324",
          "base-300": "#1a2035",
          info: "#3abff8",
          success: "#36d399",
          warning: "#fbbd23",
          error: "#f87272",
        },
      },
    ],
  },
};
