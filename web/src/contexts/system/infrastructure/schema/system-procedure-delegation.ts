import type { ProcedureKey } from "@system/domain/schemas/workflow/procedure-key.schema"
import type { DelegationId } from "@system/domain/schemas/workflow/delegation-id.schema"
import { systemDelegations } from "@system/infrastructure/schema/system-workflow"
import { systemProcedureDefinitions } from "@system/infrastructure/schema/system-procedure"
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** System DelegationEntityを特定のProcedureへ限定する任意scope。 */
export const systemDelegationProcedureScopes = sqliteTable(
  "system_delegation_procedure_scopes",
  {
    delegationId: text("delegation_id")
      .primaryKey()
      .$type<DelegationId>()
      .references(() => systemDelegations.id, { onDelete: "restrict" }),
    procedureKey: text("procedure_key")
      .notNull()
      .$type<ProcedureKey>()
      .references(() => systemProcedureDefinitions.key, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("system_delegation_procedure_scopes_pair_uniq").on(
      table.delegationId,
      table.procedureKey,
    ),
  ],
)

/** 外部APIで安定参照する変更不能な単調DelegationEntity番号。 */
export const systemDelegationNumbers = sqliteTable(
  "system_delegation_numbers",
  {
    number: integer("number").primaryKey({ autoIncrement: true }),
    delegationId: text("delegation_id")
      .notNull()
      .$type<DelegationId>()
      .references(() => systemDelegations.id, { onDelete: "restrict" }),
  },
  (table) => [uniqueIndex("system_delegation_numbers_delegation_uniq").on(table.delegationId)],
)

export const systemProcedureDelegationSchema = {
  systemDelegationNumbers,
  systemDelegationProcedureScopes,
}
