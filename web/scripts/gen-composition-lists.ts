/**
 * API compositionのうち、業務contextごとに1ファイルで置く部品の一覧を生成する。
 *
 *   bun run gen:composition         # 一覧を上書きする
 *   bun run gen:composition --check # 生成結果と現在の一覧を比較する（差分があれば非ゼロ終了）
 *
 * 入口が各部品を名指しすると、業務contextを外すたびに入口の編集が必要になる。
 * 部品のファイルを消して再生成すれば入口を変えずに外せるよう、一覧を生成物にする。
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import process from "node:process"

const API_ROOT = resolve(import.meta.dir, "../src/api")

export type CompositionListTarget = Readonly<{
  /** src/api からの部品のディレクトリ。 */
  directory: string
  filePattern: RegExp
  /** 部品が一つだけexportする関数名の接頭辞。 */
  exportPrefix: string
  /** 同じディレクトリへ生成する一覧のファイル名。 */
  output: string
  listName: string
  description: string
}>

export const COMPOSITION_LIST_TARGETS: ReadonlyArray<CompositionListTarget> = [
  {
    directory: "scheduled",
    filePattern: /^run-[a-z0-9-]+\.ts$/u,
    exportPrefix: "runScheduled",
    output: "jobs.ts",
    listName: "SCHEDULED_JOBS",
    description: "Workerの定期起動で実行するrunner。src/api/scheduled/run-*.ts から生成する。",
  },
  {
    directory: "http/inbox/providers",
    filePattern: /^[a-z0-9-]+\.ts$/u,
    exportPrefix: "readInboxCounts",
    output: "../inbox-count-providers.ts",
    listName: "INBOX_COUNT_PROVIDERS",
    description:
      "業務contextごとの未処理件数の取得。src/api/http/inbox/providers/*.ts から生成する。",
  },
  {
    directory: "http/dashboard/providers",
    filePattern: /^[a-z0-9-]+\.ts$/u,
    exportPrefix: "readDashboardMetrics",
    output: "../dashboard-metric-providers.ts",
    listName: "DASHBOARD_METRIC_PROVIDERS",
    description:
      "業務contextごとのdashboardの値の取得。src/api/http/dashboard/providers/*.ts から生成する。",
  },
  {
    directory: "http/dashboard/management/providers",
    filePattern: /^[a-z0-9-]+\.ts$/u,
    exportPrefix: "readManagementMetrics",
    output: "../management-dashboard-metric-providers.ts",
    listName: "MANAGEMENT_DASHBOARD_METRIC_PROVIDERS",
    description:
      "業務contextごとの経営dashboardの値の取得。src/api/http/dashboard/management/providers/*.ts から生成する。",
  },
]

export type CompositionPart = Readonly<{ file: string; name: string }>

/** 部品は1ファイルにつき、接頭辞で始まる async function を一つだけexportする。 */
export function exportedPart(
  file: string,
  source: string,
  exportPrefix: string,
): CompositionPart | Error {
  const pattern = new RegExp(`^export async function (${exportPrefix}[A-Za-z0-9]*)\\(`, "gmu")
  const names = [...source.matchAll(pattern)].map((match) => match[1] ?? "")
  if (names.length !== 1 || names[0] === undefined || names[0].length === 0)
    return new Error(
      `${file}: ${exportPrefix} で始まる async function を一つだけ export してください`,
    )
  return { file, name: names[0] }
}

function importPath(target: CompositionListTarget, file: string): string {
  return `@/api/${target.directory}/${file.replace(/\.ts$/u, "")}`
}

export function renderList(
  target: CompositionListTarget,
  parts: ReadonlyArray<CompositionPart>,
): string {
  const sorted = parts.toSorted((left, right) => left.file.localeCompare(right.file))
  const imports = sorted.map(
    (part) => `import { ${part.name} } from "${importPath(target, part.file)}"`,
  )
  const entries = sorted.map((part) => `  ${part.name},`)
  const inline = `export const ${target.listName} = [${sorted.map((part) => part.name).join(", ")}] as const`
  // formatter と同じく、100 文字に収まる一覧は 1 行で書く。
  return [
    "// このファイルは `bun run gen:composition` が生成する。手で編集しない。",
    ...imports,
    "",
    `/** ${target.description} */`,
    inline.length <= 100
      ? inline
      : [`export const ${target.listName} = [`, ...entries, "] as const"].join("\n"),
    "",
  ].join("\n")
}

export function collectParts(
  target: CompositionListTarget,
): ReadonlyArray<CompositionPart> | Error {
  const directory = resolve(API_ROOT, target.directory)
  if (!existsSync(directory)) return []
  const parts: CompositionPart[] = []
  for (const file of readdirSync(directory).filter(
    (name) => target.filePattern.test(name) && !name.endsWith(".test.ts"),
  )) {
    const part = exportedPart(
      file,
      readFileSync(resolve(directory, file), "utf8"),
      target.exportPrefix,
    )
    if (part instanceof Error) return part
    parts.push(part)
  }
  return parts
}

export function outputPath(target: CompositionListTarget): string {
  return resolve(API_ROOT, target.directory, target.output)
}

if (import.meta.main) {
  const checkOnly = process.argv.includes("--check")
  for (const target of COMPOSITION_LIST_TARGETS) {
    const parts = collectParts(target)
    if (parts instanceof Error) {
      console.error(parts.message)
      process.exit(1)
    }
    const rendered = renderList(target, parts)
    const path = outputPath(target)
    if (checkOnly) {
      if (!existsSync(path) || readFileSync(path, "utf8") !== rendered) {
        console.error(
          `${target.listName} の一覧が部品と一致しません。bun run gen:composition を実行してください`,
        )
        process.exit(1)
      }
      console.log(`${target.listName} は最新です (${parts.length})`)
    } else {
      writeFileSync(path, rendered)
      console.log(`${target.listName} を生成しました (${parts.length})`)
    }
  }
}
