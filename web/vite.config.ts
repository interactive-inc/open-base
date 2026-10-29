import { fileURLToPath } from "node:url"
import { defineConfig } from "vite-plus"

const webRoot = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "@": webRoot,
      "@base": fileURLToPath(new URL("../lib/", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
  },
})
