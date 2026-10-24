import path from "node:path"
import { withSentryConfig } from "@sentry/nextjs"
import type { NextConfig } from "next"
import { urlRedirects } from "./lib/routing/url-redirects"

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // bun workspaces のモノレポ: next は root node_modules に巻き上げられるため
  // Turbopack root はリポジトリルート。outputFileTracingRoot は同値制約で揃える
  turbopack: {
    root: path.join(import.meta.dirname, ".."),
  },
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),

  // portless のプロキシ経由（app.base.localhost）で dev リソースと HMR を許可する
  allowedDevOrigins: ["app.base.localhost"],

  // Codex のローカル in-app browser は sandboxed frame から Server Action を送るため
  // Origin が `null` になる。production では許可せず、通常の same-origin 検査を維持する。
  experimental: {
    serverActions: {
      // 添付は Server Action がファイル本体を受け取って API へ中継するため、
      // API 側の上限（25MB）を通せる大きさにする。
      bodySizeLimit: "26mb",
      ...(process.env.NODE_ENV === "development" ? { allowedOrigins: ["null"] } : {}),
    },
  },

  /**
   * 旧 URL からの転送。定義は url-redirects.ts が持つ。
   * next.config は Next 自身のローダが読むため tsconfig の `@/` alias が効かない。
   * ここだけ相対 import にする。
   */
  async redirects() {
    return [...urlRedirects]
  },

  // CSP is set dynamically per request in middleware.ts with a nonce for script-src.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  silent: process.env.CI !== "true",
  tunnelRoute: "/monitoring",
})
