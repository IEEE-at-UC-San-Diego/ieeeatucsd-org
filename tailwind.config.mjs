/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
    theme: {
        extend: {
            colors: {
                ieee_navigation_bg: "#090d18",
                ieee_online_store_bg: "#f3c135",
                ieee_blue: "#00629b",
            },
        },
    },
    plugins: [],
};
