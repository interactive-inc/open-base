import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { readFileSync } from "node:fs"

/** System の添付機能だけを検証できる、製品 migration 非依存のローカルD1を作る。 */
export function createSystemAttachmentTestDatabase(): Promise<D1Database> {
  const coreSchema = readFileSync(
    new URL("../infrastructure/schema/system-core.sql", import.meta.url),
    "utf8",
  )
  const attachmentSchema = readFileSync(
    new URL("../infrastructure/schema/system-attachment.sql", import.meta.url),
    "utf8",
  )
  const integrationSchema = readFileSync(
    new URL("../infrastructure/schema/system-integration.sql", import.meta.url),
    "utf8",
  )
  const principalSchema = readFileSync(
    new URL("../infrastructure/schema/system-principal.sql", import.meta.url),
    "utf8",
  )

  const workflowSchema = readFileSync(
    new URL("../infrastructure/schema/system-workflow.sql", import.meta.url),
    "utf8",
  )
  const procedureSchema = readFileSync(
    new URL("../infrastructure/schema/system-procedure.sql", import.meta.url),
    "utf8",
  )
  return createLocalD1Database({
    schema: `${coreSchema}\n${integrationSchema}\n${principalSchema}\n${attachmentSchema}\n${workflowSchema}\n${procedureSchema}`,
  })
}
