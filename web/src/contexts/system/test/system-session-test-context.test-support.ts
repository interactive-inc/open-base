import type { SystemD1Context } from "@system/configuration/system-context"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { readFileSync } from "node:fs"

/**
 * 適用する正本のschema。認証・IAM・Session・監査のtableはsystem-core.sqlが持つ。
 * 同じtableをここで書き直さない。書き直すと正本のCHECK・外部キー・一意index・triggerが抜け、
 * 本番のschemaが拒否する行をtestが受け入れてしまう。
 */
const schemaFiles = [
  "system-core.sql",
  "system-integration.sql",
  "system-principal.sql",
  "system-delivery.sql",
]

const schema = schemaFiles
  .map((file) => readFileSync(new URL(`../infrastructure/schema/${file}`, import.meta.url), "utf8"))
  .join("\n")

/** canonical System SessionのD1 transactionをローカルD1で検証するtest context。 */
export class SystemSessionTestContext {
  /** ローカルD1へ適用するschema。正本のfileをそのまま連結したもの。 */
  static readonly schema = schema

  private constructor(
    readonly database: D1Database,
    readonly context: SystemD1Context,
  ) {
    Object.freeze(this)
  }

  static async create(): Promise<SystemSessionTestContext> {
    const database = await createLocalD1Database({ schema })
    return new SystemSessionTestContext(
      database,
      Object.freeze({ env: Object.freeze({ DB: database }) }),
    )
  }
}
