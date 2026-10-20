import { existsSync } from "node:fs"
import { resolve } from "node:path"

/** 各製品repositoryの配置差を吸収し、Company統合testが読むmigration正本を返す。 */
const projectRoot = resolve(import.meta.dir, "../../../..")
export const COMPANY_TEST_MIGRATIONS_DIR = existsSync(resolve(projectRoot, "migrations"))
  ? resolve(projectRoot, "migrations")
  : resolve(projectRoot, "drizzle")
