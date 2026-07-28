import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    mcpPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/react-router/") ||
            id.includes("/node_modules/react-router-dom/") ||
            id.includes("/node_modules/react-helmet-async/") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "vendor-react";
          }

          if (
            id.includes("/node_modules/@supabase/") ||
            id.includes("/node_modules/@tanstack/")
          ) {
            return "vendor-data";
          }

          if (
            id.includes("/node_modules/react-hook-form/") ||
            id.includes("/node_modules/@hookform/") ||
            id.includes("/node_modules/zod/")
          ) {
            return "vendor-forms";
          }

          if (
            id.includes("/node_modules/recharts/") ||
            id.includes("/node_modules/react-smooth/") ||
            id.includes("/node_modules/victory-vendor/") ||
            id.includes("/node_modules/d3-")
          ) {
            return "vendor-charts";
          }

          if (
            id.includes("/node_modules/react-markdown/") ||
            id.includes("/node_modules/dompurify/") ||
            id.includes("/node_modules/unified/") ||
            id.includes("/node_modules/remark-") ||
            id.includes("/node_modules/rehype-")
          ) {
            return "vendor-content";
          }

          if (
            id.includes("/node_modules/pdf-lib/") ||
            id.includes("/node_modules/@pdf-lib/")
          ) {
            return "vendor-pdf";
          }

          return undefined;
        },
      },
    },
  },
}));
