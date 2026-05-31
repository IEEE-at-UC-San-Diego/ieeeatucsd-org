import { defineConfig, type PluginOption } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
const serverExternalPackages = [
	/^@radix-ui\//,
	/^@tanstack\//,
	/^@tiptap\//,
	/^@orpc\//,
	/^prosemirror-/,
	"@convex-dev/react-query",
	"@logto/react",
	"@vitejs/plugin-react",
	"babel-plugin-react-compiler",
	"convex",
	"framer-motion",
	"googleapis",
	"heic2any",
	"imapflow",
	"lucide-react",
	"radix-ui",
	"react",
	"react-dom",
	"react-dom/server",
	"react/jsx-runtime",
	"recharts",
	"sonner",
];

function shouldExternalizeServerPackage(id: string) {
	return serverExternalPackages.some((entry) =>
		typeof entry === "string"
			? id === entry || id.startsWith(`${entry}/`)
			: entry.test(id),
	);
}

const config = defineConfig({
	root: appRoot,
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
		dedupe: ["react", "react-dom"],
	},
	ssr: {
		noExternal: [/^@tanstack\//],
	},
	plugins: [
		devtools() as PluginOption,
		nitro({
			preset: "node-server",
			externals: {
				trace: false,
				external: serverExternalPackages,
			},
			rollupConfig: {
				external: shouldExternalizeServerPackage,
			},
		}) as PluginOption,
		// this is the plugin that enables path aliases
		viteTsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tailwindcss(),
		tanstackStart(),
		viteReact({
			babel: {
				plugins: ["babel-plugin-react-compiler"],
			},
		}),
	],
});

export default config;
