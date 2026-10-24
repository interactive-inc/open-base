import { Glob } from "bun"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { z } from "zod"

const PROJECT_ROOT = resolve(import.meta.dir, "..")
const MANIFEST_PATH = resolve(PROJECT_ROOT, "company-context.manifest.json")
const LOCK_PATH = resolve(PROJECT_ROOT, "company-context.lock.json")
const COMPANY_SOURCE_GLOB = new Glob("src/contexts/company/**/*")

const companySourceManifestSchema = z.strictObject({
  version: z.literal(3),
  coverage: z.literal("complete-company-context"),
  sourcePaths: z.array(z.string().min(1)).min(1),
  implementedCapabilities: z.array(z.string().min(1)),
  targetCapabilities: z.array(z.string().min(1)),
})

const companySourceLockSchema = z.strictObject({
  version: z.literal(1),
  files: z.record(z.string().min(1), z.string().regex(/^[0-9a-f]{64}$/)),
})

function hashFile(relativePath: string): string {
  return createHash("sha256")
    .update(readFileSync(resolve(PROJECT_ROOT, relativePath)))
    .digest("hex")
}

function readManifest() {
  return companySourceManifestSchema.parse(JSON.parse(readFileSync(MANIFEST_PATH, "utf8")))
}

function collectCompanySourcePaths(): string[] {
  return Array.from(COMPANY_SOURCE_GLOB.scanSync({ cwd: PROJECT_ROOT, onlyFiles: true })).toSorted()
}

/** 実ディレクトリ全体をmanifestの正本にし、手作業の列挙漏れを作らない。 */
export function writeCompanyContextManifest(): void {
  const manifest = readManifest()
  writeFileSync(
    MANIFEST_PATH,
    `${JSON.stringify({ ...manifest, sourcePaths: collectCompanySourcePaths() }, null, 2)}\n`,
  )
}

export async function collectCompanyContextHashes(): Promise<ReadonlyMap<string, string>> {
  const manifest = readManifest()
  const sourcePaths = manifest.sourcePaths.toSorted()
  if (
    sourcePaths.some((relativePath, index) => relativePath !== manifest.sourcePaths[index]) ||
    new Set(sourcePaths).size !== sourcePaths.length
  ) {
    throw new Error(
      "company-context.manifest.json の sourcePaths は重複なくpath昇順で宣言してください",
    )
  }

  for (const relativePath of sourcePaths) {
    const matches = Array.from(
      new Glob(relativePath).scanSync({ cwd: PROJECT_ROOT, onlyFiles: true }),
    )
    if (matches.length !== 1 || matches[0] !== relativePath) {
      throw new Error(`Company sourceが存在しません: ${relativePath}`)
    }
  }

  const actualSourcePaths = collectCompanySourcePaths()
  const extraSourcePaths = actualSourcePaths.filter(
    (relativePath) => !sourcePaths.includes(relativePath),
  )
  const missingSourcePaths = sourcePaths.filter(
    (relativePath) => !actualSourcePaths.includes(relativePath),
  )
  if (extraSourcePaths.length > 0 || missingSourcePaths.length > 0) {
    throw new Error(
      [
        ...extraSourcePaths.map(
          (relativePath) => `Company外へ分離されていないsourceです: ${relativePath}`,
        ),
        ...missingSourcePaths.map(
          (relativePath) => `Company manifestだけに存在するsourceです: ${relativePath}`,
        ),
      ].join("\n"),
    )
  }

  const paths = ["company-context.manifest.json", ...sourcePaths]

  return new Map(
    [...new Set(paths)].toSorted().map((relativePath) => [relativePath, hashFile(relativePath)]),
  )
}

export async function writeCompanyContextLock(): Promise<void> {
  const actual = await collectCompanyContextHashes()
  writeFileSync(
    LOCK_PATH,
    `${JSON.stringify({ version: 1, files: Object.fromEntries(actual) }, null, 2)}\n`,
  )
}

export async function checkCompanyContext(): Promise<string[]> {
  const lock = companySourceLockSchema.parse(JSON.parse(readFileSync(LOCK_PATH, "utf8")))
  const expectedPaths = Object.keys(lock.files)
  const actual = await collectCompanyContextHashes()
  const violations: string[] = []

  if (
    expectedPaths.some((relativePath, index) => relativePath !== expectedPaths.toSorted()[index])
  ) {
    violations.push("company-context.lock.json の files はpath昇順で宣言してください")
  }

  for (const [relativePath, actualHash] of actual) {
    const expectedHash = lock.files[relativePath]
    if (expectedHash === undefined) {
      violations.push(`Company sourceがlockにありません: ${relativePath}`)
    } else if (expectedHash !== actualHash) {
      violations.push(`Company sourceのhashがlockと一致しません: ${relativePath}`)
    }
  }

  for (const relativePath of expectedPaths) {
    if (!actual.has(relativePath)) {
      violations.push(`lockだけに存在するCompany sourceです: ${relativePath}`)
    }
  }

  return violations
}

if (import.meta.main) {
  if (process.argv.includes("--write")) {
    writeCompanyContextManifest()
    await writeCompanyContextLock()
    console.log("Company context manifest / lockをディレクトリ全体から更新しました")
  } else {
    const violations = await checkCompanyContext()
    if (violations.length > 0) {
      console.error(violations.join("\n"))
      process.exit(1)
    }
    console.log("Company contextは完全一致lockと一致しています")
  }
}
