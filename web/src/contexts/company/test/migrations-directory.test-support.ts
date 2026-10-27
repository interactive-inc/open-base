import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"

/** 各製品repositoryの配置差を吸収し、Company統合testが読むmigration正本を返す。 */
const projectRoot = findProjectRoot(import.meta.dir)
export const COMPANY_TEST_MIGRATIONS_DIR = existsSync(
  resolve(projectRoot, "tests/fixtures/released-migrations"),
)
  ? resolve(projectRoot, "tests/fixtures/released-migrations")
  : existsSync(resolve(projectRoot, "migrations"))
    ? resolve(projectRoot, "migrations")
    : resolve(projectRoot, "db", "migrations")

/** `package.json` を持つ最も近い祖先を製品の root として返す。製品ごとに context の深さが違っても同じ root を指す。 */
function findProjectRoot(directory: string): string {
  let current = directory
  while (!existsSync(resolve(current, "package.json"))) {
    const parent = dirname(current)
    if (parent === current) throw new Error(`package.json が見つかりません: ${directory}`)
    current = parent
  }
  return current
}
