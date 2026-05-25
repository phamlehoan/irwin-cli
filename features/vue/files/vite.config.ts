import vue from "@vitejs/plugin-vue";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  root: ".",
  build: {
    outDir: "app/assets/generated",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "app/assets/javascripts/main.ts"),
      output: {
        entryFileNames: "bundle.js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});
