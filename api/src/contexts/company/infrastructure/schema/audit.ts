import type { InferSelectModel } from "drizzle-orm"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { sql } from "drizzle-orm"
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** Product APIのopaque Account IDを保持するappend-only監査event。 */
export const auditLogs = sqliteTable(
  "company_audit_events",
  {
    id: text("id").primaryKey().notNull(),
    eventId: text("event_id").notNull().unique(),
    requestId: text("request_id").notNull(),
    actorAccountId: text("actor_account_id").$type<AccountId>(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    outcome: text("outcome").notNull().$type<"succeeded" | "denied" | "failed">(),
    reasonCode: text("reason_code"),
    authorizationJson: text("authorization_json"),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    metadataJson: text("metadata_json"),
    clientIp: text("client_ip"),
    clientName: text("client_name").notNull().$type<"web" | "cli" | "api" | "system">(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_company_audit_events_request").on(table.requestId),
    index("idx_company_audit_events_actor").on(table.actorAccountId, table.createdAt, table.id),
    index("idx_company_audit_events_action").on(table.action, table.createdAt, table.id),
    index("idx_company_audit_events_target").on(
      table.targetType,
      table.targetId,
      table.createdAt,
      table.id,
    ),
    index("idx_company_audit_events_outcome").on(table.outcome, table.createdAt, table.id),
    index("idx_company_audit_events_created").on(table.createdAt, table.id),
  ],
)

export type AuditLogRow = InferSelectModel<typeof auditLogs>

/** 監査付きbatch transaction内でだけ使う排他的decision marker。 */
export const auditBatchDecisions = sqliteTable(
  "company_audit_batch_decisions",
  {
    decisionId: text("decision_id").primaryKey().notNull(),
    decisionValue: text("decision_value").notNull(),
  },
  (table) => [
    check(
      "company_audit_batch_decisions_decision_value_length",
      sql`length(${table.decisionValue}) BETWEEN 1 AND 64`,
    ),
  ],
)

export type AuditBatchDecisionRow = InferSelectModel<typeof auditBatchDecisions>

/** Company: System 監査イベントへ Employee 文脈を付与する append-only satellite。 */
export const auditEventEmployeeContexts = sqliteTable(
  "company_audit_event_employee_contexts",
  {
    auditEventId: text("audit_event_id").primaryKey().notNull(),
    employeeId: text("employee_id").notNull().$type<EmployeeId>(),
  },
  (table) => [
    index("idx_company_audit_event_employee_contexts_employee").on(
      table.employeeId,
      table.auditEventId,
    ),
  ],
)

export type AuditEventEmployeeContextRow = InferSelectModel<typeof auditEventEmployeeContexts>
