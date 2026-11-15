import { defineConfig } from "vite"
import { msw } from "msw/vite"

// Storybookは実API、Void Worker、D1を起動しない。
export default defineConfig({ plugins: [msw({ mode: "worker-only" })] })
