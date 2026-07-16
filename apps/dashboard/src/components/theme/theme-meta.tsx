import { useTheme } from "next-themes";
import { useEffect } from "react";

const LIGHT_THEME_COLOR = "#006bff";
const DARK_THEME_COLOR = "#000000";

/** Keeps theme-color meta + status bar in sync with the resolved theme. */
export function ThemeMeta() {
	const { resolvedTheme } = useTheme();

	useEffect(() => {
		const isDark = resolvedTheme === "dark";
		const color = isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;

		let meta = document.querySelector('meta[name="theme-color"]');
		if (!meta) {
			meta = document.createElement("meta");
			meta.setAttribute("name", "theme-color");
			document.head.appendChild(meta);
		}
		meta.setAttribute("content", color);

		const statusBar = document.querySelector(
			'meta[name="apple-mobile-web-app-status-bar-style"]',
		);
		if (statusBar) {
			statusBar.setAttribute(
				"content",
				isDark ? "black-translucent" : "default",
			);
		}
	}, [resolvedTheme]);

	return null;
}
