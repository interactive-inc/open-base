import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite-plus"

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(root, "."),
    },
  },
  fmt: {
    semi: false,
  },
})
