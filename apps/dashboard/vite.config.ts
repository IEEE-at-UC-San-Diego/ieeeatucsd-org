import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type PluginOption } from "vite-plus";

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

const config = defineConfig(({ command, mode }) => ({
  root: appRoot,
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    dedupe: ["react", "react-dom"],
  },
  ssr: {
    // Bundle React so standalone Docker deploys don't need hoisted workspace
    // node_modules. Only do this for builds: during `vite dev` the SSR module
    // runner inline-evaluates React's CJS jsx-runtime, where `module` is
    // undefined, so React must stay external in dev.
    noExternal:
      command === "build"
        ? [/^@tanstack\//, "react", "react-dom"]
        : [/^@tanstack\//],
  },
  plugins:
    mode === "test"
      ? []
      : [
          devtools() as PluginOption,
          nitro({
            preset: "node-server",
            rollupConfig: {
              external: shouldExternalizeServerPackage,
            },
          }) as PluginOption,
          tailwindcss(),
          tanstackStart(),
          viteReact({
            babel: {
              plugins: ["babel-plugin-react-compiler"],
            },
          }),
        ],
}));

export default config;
