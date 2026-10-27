import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { readdirSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { parseArgs } from "node:util"
import { parseConfigFileTextToJson } from "typescript"
import { z } from "zod"
import { fetchRemoteD1Rows } from "./fetch-remote-d1-rows"
import { MigrationJournal } from "./migration-journal"

/** Read every configured D1 journal before allowing any remote DDL. */
export async function checkRemoteMigrationJournal(configPath: string): Promise<void> {
  const parsed = parseConfigFileTextToJson(configPath, readFileSync(configPath, "utf8"))
  if (parsed.error !== undefined) throw new Error("invalid Wrangler JSON configuration")
  const config = z
    .object({
      migrations_dir: z.string().min(1).optional(),
      d1_databases: z
        .array(
          z.object({
            binding: z.string().min(1),
            database_id: z.string().min(1),
            migrations_dir: z.string().min(1).optional(),
          }),
        )
        .min(1),
    })
    .parse(parsed.config)
  const failures: string[] = []
  for (const database of config.d1_databases) {
    const directory = resolve(
      dirname(configPath),
      database.migrations_dir ?? config.migrations_dir ?? "migrations",
    )
    const localNames = readdirSync(directory)
      .filter((name) => name.endsWith(".sql"))
      .sort()
    if (localNames.length === 0) throw new Error(`no local migrations for ${database.binding}`)
    const rows = await fetchRemoteD1Rows({
      binding: database.binding,
      configPath,
      query: "SELECT name FROM d1_migrations ORDER BY id",
      allowMissingJournal: true,
    })
    if (rows === null || rows.length === 0) {
      const tables = await fetchRemoteD1Rows({
        binding: database.binding,
        configPath,
        query:
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*' AND name != 'd1_migrations'",
      })
      if (tables === null || tables.length !== 0) {
        throw new Error(`journal is missing or empty in a populated database: ${database.binding}`)
      }
    }
    const appliedNames = z
      .array(z.object({ name: z.string().min(1) }))
      .parse(rows ?? [])
      .map((row) => row.name)
    failures.push(
      ...MigrationJournal.inspect({ appliedNames, localNames }).map(
        (failure) => `${database.binding}: ${failure}`,
      ),
    )
  }

  if (failures.length > 0) {
    throw new Error(
      `Migration preflight failed before applying DDL. Resolve the reported history conflicts without rewriting the journal.\n${failures.join("\n")}`,
    )
  }
  console.log("Remote migration history checks passed")
}

if (import.meta.main) {
  const arguments_ = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      config: { type: "string" },
    },
    strict: true,
  })
  if (arguments_.values.config !== undefined) {
    await checkRemoteMigrationJournal(arguments_.values.config)
  } else {
    // 配備と同じ設定だけを読み、秘密値を含まない最小の一時設定で照会する。
    const { default: configuration } = await import("../void.config")
    const projectRoot = fileURLToPath(new URL("../", import.meta.url))
    const cloudflare = z
      .object({
        name: z.string().min(1),
        account_id: z.string().optional(),
        d1_databases: z
          .array(
            z.object({
              binding: z.string().min(1),
              database_name: z.string().optional(),
              database_id: z.string().min(1),
              migrations_dir: z.string().min(1),
            }),
          )
          .min(1),
      })
      .parse(configuration.cloudflare)
    const directory = mkdtempSync(resolve(tmpdir(), "database-preflight-"))
    try {
      const configPath = resolve(directory, "wrangler.json")
      writeFileSync(
        configPath,
        JSON.stringify({
          ...cloudflare,
          d1_databases: cloudflare.d1_databases.map((database) => ({
            ...database,
            migrations_dir: resolve(projectRoot, database.migrations_dir),
          })),
        }),
        { mode: 0o600 },
      )
      await checkRemoteMigrationJournal(configPath)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }
}
