import { defineConfig } from "vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import babel from "@rolldown/plugin-babel"
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { visualizer } from "rollup-plugin-visualizer"

const analyze = process.env.ANALYZE === "true"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
    analyze &&
      visualizer({
        filename: "dist/stats.html",
        gzipSize: true,
        open: true,
      }),
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
          if (id.includes("node_modules")) {
            if (id.includes("@reduxjs/toolkit") || id.includes("react-redux")) {
              return "redux"
            }
            if (id.includes("react-router")) {
              return "router"
            }
          }
        },
      },
    },
  },
})
