import { fileURLToPath } from "node:url"
import { defineConfig } from "vite-plus"

const webRoot = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "@": webRoot,
    },
  },
  test: {
    environment: "happy-dom",
  },
})
