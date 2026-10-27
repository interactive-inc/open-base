import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"

/**
 * Canonical System tests are shared across products, while each product owns its
 * migration sequence and directory. Resolve one released migration by its
 * stable semantic suffix instead of coupling shared code to a sequence number.
 */
export function readReleasedSystemMigration(stableName: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(stableName)) {
    throw new Error(`Invalid System migration name: ${stableName}`)
  }

  const matches = [
    "tests/fixtures/released-migrations",
    "db/migrations",
    "drizzle",
    "migrations",
  ].flatMap((directory) => {
    const migrationsUrl = pathToFileURL(`${join(findProjectRoot(import.meta.dir), directory)}/`)

    try {
      const releasedFilename = new RegExp(`^\\d+_${stableName}\\.sql$`)
      return readdirSync(migrationsUrl)
        .filter((filename) => releasedFilename.test(filename))
        .map((filename) => new URL(filename, migrationsUrl))
    } catch (error) {
      const code = error instanceof Error && "code" in error ? error.code : undefined
      if (code === "ENOENT") {
        return []
      }
      throw error
    }
  })

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one released System migration for ${stableName}, found ${matches.length}`,
    )
  }

  return readFileSync(matches[0], "utf8")
}

/** `package.json` を持つ最も近い祖先を製品の root として返す。製品ごとに context の深さが違っても同じ root を指す。 */
function findProjectRoot(directory: string): string {
  let current = directory
  while (!existsSync(join(current, "package.json"))) {
    const parent = dirname(current)
    if (parent === current) throw new Error(`package.json が見つかりません: ${directory}`)
    current = parent
  }
  return current
}
