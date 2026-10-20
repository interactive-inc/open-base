import { readdirSync, readFileSync } from "node:fs"

/**
 * Canonical System tests are shared across products, while each product owns its
 * migration sequence and directory. Resolve one released migration by its
 * stable semantic suffix instead of coupling shared code to a sequence number.
 */
export function readReleasedSystemMigration(stableName: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(stableName)) {
    throw new Error(`Invalid System migration name: ${stableName}`)
  }

  const matches = ["drizzle", "migrations"].flatMap((directory) => {
    const migrationsUrl = new URL(`../../../../${directory}/`, import.meta.url)

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
