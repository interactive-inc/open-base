import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { baseMockPlugin } from "@open-base/mock/vite"
import type { Scenario } from "@open-base/mock/types"

/** Void/Cloudflare/実DBを読み込まない、clientだけの開発入口。 */
export default defineConfig({
  root: fileURLToPath(new URL("./mock", import.meta.url)),
  resolve: {
    alias: [
      {
        find: /^.*\/auth-client$/,
        replacement: fileURLToPath(new URL("../packages/mock/src/auth-client.ts", import.meta.url)),
      },
      { find: /^@\/(.*)$/, replacement: fileURLToPath(new URL("./src/$1", import.meta.url)) },
    ],
  },
  plugins: [
    react(),
    tailwindcss(),
    baseMockPlugin({
      scenario: process.env.BASE_MOCK_SCENARIO as Scenario | undefined,
      sqliteDirectory: process.env.BASE_MOCK_SQLITE_DIR,
    }),
  ],
  server: { host: "127.0.0.1", allowedHosts: ["base.localhost"] },
})
