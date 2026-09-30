import { lstat, readdir, realpath } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { UsageError } from "@/lib/errors"

const MAX_DOCUMENTS = 100
const MAX_DOCUMENT_CHARS = 300_000
const MAX_TOTAL_CHARS = 900_000

export type GovernanceMarkdownSource = {
  source_path: string
  markdown: string
}

export async function readGovernanceMarkdownSources(
  inputPath: string,
  cwd = process.cwd(),
): Promise<GovernanceMarkdownSource[]> {
  const root = await realpath(cwd)
  const target = resolve(root, inputPath)
  assertInsideRoot(root, target)

  let targetRealPath: string
  try {
    targetRealPath = await realpath(target)
  } catch {
    throw new UsageError(`Markdown のパスが見つかりません: ${inputPath}`)
  }
  assertInsideRoot(root, targetRealPath)

  const files = await collectMarkdownFiles(targetRealPath)
  if (files.length === 0) throw new UsageError("同期対象の Markdown がありません")
  if (files.length > MAX_DOCUMENTS) {
    throw new UsageError(`Markdown は一度に ${MAX_DOCUMENTS} 件まで同期できます`)
  }

  const sources: GovernanceMarkdownSource[] = []
  let totalChars = 0
  for (const file of files.sort()) {
    const markdown = await Bun.file(file).text()
    if (markdown.length === 0 || markdown.length > MAX_DOCUMENT_CHARS) {
      throw new UsageError(
        `${toSourcePath(root, file)} は 1〜${MAX_DOCUMENT_CHARS} 文字にしてください`,
      )
    }
    totalChars += markdown.length
    if (totalChars > MAX_TOTAL_CHARS) {
      throw new UsageError(`Markdown の合計は ${MAX_TOTAL_CHARS} 文字まで同期できます`)
    }
    sources.push({ source_path: toSourcePath(root, file), markdown })
  }
  return sources
}

async function collectMarkdownFiles(path: string): Promise<string[]> {
  const stat = await lstat(path)
  if (stat.isSymbolicLink()) throw new UsageError("シンボリックリンクは同期できません")
  if (stat.isFile()) {
    if (!path.toLowerCase().endsWith(".md")) throw new UsageError("同期対象は Markdown のみです")
    return [path]
  }
  if (!stat.isDirectory()) throw new UsageError("同期対象は Markdown またはディレクトリです")

  const files: string[] = []
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue
    const child = resolve(path, entry.name)
    if (entry.isDirectory()) files.push(...(await collectMarkdownFiles(child)))
    if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".md") &&
      entry.name.toLowerCase() !== "readme.md"
    ) {
      files.push(child)
    }
  }
  return files
}

function assertInsideRoot(root: string, path: string): void {
  const pathFromRoot = relative(root, path)
  if (pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..")) return
  throw new UsageError("同期元は現在の作業ディレクトリ内に置いてください")
}

function toSourcePath(root: string, path: string): string {
  const result = relative(root, path).split(sep).join("/")
  if (result === "" || result.startsWith("../") || isAbsolute(result) || result.length > 500) {
    throw new UsageError("同期元の相対パスが不正です")
  }
  return result
}
