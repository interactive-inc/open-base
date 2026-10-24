import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { voidReact } from "@void/react/plugin"
import { voidPlugin } from "void"
import { defineConfig, type Plugin } from "vite-plus"

const root = dirname(fileURLToPath(import.meta.url))
const systemRoot = resolve(root, "./src/contexts/system")
const serviceBindingEntrypoint = resolve(
  root,
  "./src/api/http/service-binding/service-binding-entrypoint.ts",
)

/**
 * Voidが生成するWorkerエントリへ、Service BindingのRPC入口を名前付きexportで足す。
 * Voidのエントリは既定exportのfetch・scheduledしか持たず、名前付きのWorkerEntrypointを置く設定が無い。
 */
function serviceBindingEntrypointPlugin(): Plugin {
  return {
    name: "open-base:service-binding-entrypoint",
    enforce: "pre",
    transform(code, id) {
      if (!id.split("?")[0]?.endsWith("/.void/entry.ts")) return null
      return `${code}\nexport { ServiceBindingEntrypoint } from ${JSON.stringify(serviceBindingEntrypoint)};\n`
    },
  }
}

export default defineConfig({
  plugins: [voidPlugin(), voidReact(), serviceBindingEntrypointPlugin()],
  server: {
    // portless が base.localhost などの名前で中継する。
    allowedHosts: [".localhost"],
  },
  resolve: {
    alias: [
      { find: /^@system\/(.*)$/, replacement: `${systemRoot}/$1` },
      { find: /^@tests\/(.*)$/, replacement: `${resolve(root, "./tests")}/$1` },
      { find: /^@\/(.*)$/, replacement: `${resolve(root, "./src")}/$1` },
    ],
  },
  fmt: {
    semi: false,
  },
})
