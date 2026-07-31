import react from "@vitejs/plugin-react-swc";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// One build pass emits the extension pages plus the manifest-referenced scripts.
// background/content/inpage must keep stable, un-hashed filenames because
// manifest.json references them by name; page assets keep normal content hashes.
// content/inpage import nothing at runtime, so they emit as classic-script-safe files.
const STABLE_ENTRIES = new Set(["background", "content", "inpage"]);

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        onboarding: resolve(__dirname, "onboarding.html"),
        approval: resolve(__dirname, "approval.html"),
        background: resolve(__dirname, "src/background.ts"),
        content: resolve(__dirname, "src/content.ts"),
        inpage: resolve(__dirname, "src/inpage.ts"),
      },
      output: {
        entryFileNames: (chunk) =>
          STABLE_ENTRIES.has(chunk.name) ? "[name].js" : "assets/[name]-[hash].js",
      },
    },
  },
});
