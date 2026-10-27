import { existsSync, readFileSync } from "node:fs"
import { defineConfig } from "void/config"

// 配備先のアカウント、ドメイン、リソースIDは公開リポジトリに入れない。
// gitignore済みの void.deploy.json があれば、その cloudflare 設定で上書きする。
const deployConfigPath = new URL("./void.deploy.json", import.meta.url)
const deployCloudflare: Record<string, unknown> = existsSync(deployConfigPath)
  ? (JSON.parse(readFileSync(deployConfigPath, "utf8")).cloudflare ?? {})
  : {}

export default defineConfig({
  sourceDir: "src",
  worker: {
    compatibility_date: "2026-05-24",
    compatibility_flags: ["nodejs_compat"],
  },
  cloudflare: {
    name: "open-base",
    observability: { enabled: true },
    d1_databases: [
      {
        binding: "DB",
        database_name: "base",
        database_id: "00000000-0000-0000-0000-000000000000",
        migrations_dir: "src/db/migrations",
      },
    ],
    r2_buckets: [{ binding: "ATTACHMENTS", bucket_name: "base-attachments" }],
    ratelimits: [
      {
        name: "API_RATE_LIMITER",
        namespace_id: "1000",
        simple: { limit: 120, period: 60 },
      },
    ],
    ...deployCloudflare,
  },
})
