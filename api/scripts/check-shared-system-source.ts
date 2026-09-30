import { Glob } from "bun"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { z } from "zod"

const PROJECT_ROOT = resolve(import.meta.dir, "..")
const LOCK_PATH = resolve(PROJECT_ROOT, "system-context.lock.json")
const SYSTEM_SOURCE_GLOB = new Glob("src/contexts/system/**/*")

const systemSourceLockSchema = z.strictObject({
  version: z.literal(1),
  files: z.record(z.string().min(1), z.string().regex(/^[0-9a-f]{64}$/)),
})

function hashFile(relativePath: string): string {
  return createHash("sha256")
    .update(readFileSync(resolve(PROJECT_ROOT, relativePath)))
    .digest("hex")
}

export async function collectSharedSystemSourceHashes(): Promise<ReadonlyMap<string, string>> {
  const paths: string[] = []

  for await (const relativePath of SYSTEM_SOURCE_GLOB.scan({
    cwd: PROJECT_ROOT,
    onlyFiles: true,
  })) {
    paths.push(relativePath)
  }
  paths.push("system-context.manifest.json")

  return new Map(paths.toSorted().map((relativePath) => [relativePath, hashFile(relativePath)]))
}

export async function writeSharedSystemSourceLock(): Promise<void> {
  const actual = await collectSharedSystemSourceHashes()
  writeFileSync(
    LOCK_PATH,
    `${JSON.stringify({ version: 1, files: Object.fromEntries(actual) }, null, 2)}\n`,
  )
}

export async function checkSharedSystemSource(): Promise<string[]> {
  const lock = systemSourceLockSchema.parse(JSON.parse(readFileSync(LOCK_PATH, "utf8")))
  const expectedPaths = Object.keys(lock.files)
  const actual = await collectSharedSystemSourceHashes()
  const actualPaths = [...actual.keys()]
  const violations: string[] = []

  if (
    expectedPaths.some((relativePath, index) => relativePath !== expectedPaths.toSorted()[index])
  ) {
    violations.push("system-context.lock.json の files はpath昇順で宣言してください")
  }

  for (const relativePath of actualPaths) {
    const expectedHash = lock.files[relativePath]
    if (expectedHash === undefined) {
      violations.push(`System共通sourceがlockにありません: ${relativePath}`)
    } else if (expectedHash !== actual.get(relativePath)) {
      violations.push(`System共通sourceのhashがlockと一致しません: ${relativePath}`)
    }
  }

  for (const relativePath of expectedPaths) {
    if (!actual.has(relativePath)) {
      violations.push(`lockだけに存在するSystem共通sourceです: ${relativePath}`)
    }
  }

  return violations
}

if (import.meta.main) {
  if (process.argv.includes("--write")) {
    await writeSharedSystemSourceLock()
    console.log("System共通source lockを更新しました")
  } else {
    const violations = await checkSharedSystemSource()
    if (violations.length > 0) {
      console.error(violations.join("\n"))
      process.exit(1)
    }
    console.log("System共通sourceはlockと一致しています")
  }
}
