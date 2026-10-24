import type { PersonnelActionKind } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import type {
  EmployeeId,
  EmploymentId,
  PersonnelActionId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { InferSelectModel } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { check, integer, sqliteTable, text, uniqueIndex, unique } from "drizzle-orm/sqlite-core"

/** 人事アクション台帳。事実は追記のみで、訂正も corrected アクションとして記録する。 */
export const personnelActions = sqliteTable(
  "company_personnel_actions",
  {
    id: text("id").primaryKey().$type<PersonnelActionId>(),
    /** 主キーを UUID へ移す前の値。移行前の記録を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
    employeeId: text("employee_id").notNull().$type<EmployeeId>(),
    kind: text("kind").notNull().$type<PersonnelActionKind>(),
    eventOn: text("event_on").notNull(),
    recordedAt: integer("recorded_at").notNull(),
    recordedByAccountId: text("recorded_by_account_id").$type<AccountId>(),
    requestedByEmployeeId: text("requested_by_employee_id").$type<EmployeeId>(),
    sourceType: text("source_type").notNull().$type<"application" | "direct" | "system">(),
    sourceApplicationId: integer("source_application_id"),
    correctsActionId: text("corrects_action_id"),
    operationId: text("operation_id").notNull().unique(),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    summaryJson: text("summary_json").notNull(),
  },
  (table) => [
    uniqueIndex("uq_company_personnel_actions_source_application")
      .on(table.sourceApplicationId)
      .where(sql`source_application_id IS NOT NULL`),
    uniqueIndex("uq_company_personnel_actions_correction")
      .on(table.correctsActionId)
      .where(sql`corrects_action_id IS NOT NULL`),
    check(
      "company_personnel_actions_kind",
      sql`${table.kind} IN (
        'hire', 'rehire', 'primary_assignment_started', 'transferred',
        'concurrent_assignment_started', 'assignment_ended', 'position_changed',
        'manager_changed', 'department_responsibility_started',
        'department_responsibility_ended', 'leave_started', 'returned', 'retired',
        'corrected', 'initial_state', 'employment_revised'
      )`,
    ),
    check(
      "company_personnel_actions_event_on",
      sql`length(${table.eventOn}) = 10
          AND substr(${table.eventOn}, 5, 1) = '-'
          AND substr(${table.eventOn}, 8, 1) = '-'`,
    ),
    check(
      "company_personnel_actions_source",
      sql`(${table.sourceType} = 'application' AND ${table.sourceApplicationId} IS NOT NULL)
          OR (${table.sourceType} != 'application' AND ${table.sourceApplicationId} IS NULL)`,
    ),
    check(
      "company_personnel_actions_correction_target",
      sql`${table.correctsActionId} IS NULL OR ${table.correctsActionId} != ${table.id}`,
    ),
  ],
)

export type PersonnelActionRow = InferSelectModel<typeof personnelActions>

/** 雇用期間の版。最新 revision の非 void 行を現在有効な期間として読む。 */
export const employmentPeriodVersions = sqliteTable(
  "company_employment_period_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    periodId: text("period_id").notNull(),
    revision: integer("revision").notNull(),
    employeeId: text("employee_id").notNull().$type<EmployeeId>(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    isVoid: integer("is_void", { mode: "boolean" }).notNull().default(false),
    recordedByActionId: text("recorded_by_action_id").notNull(),
    recordedAt: integer("recorded_at").notNull(),
  },
  (table) => [
    unique().on(table.periodId, table.revision),
    check("company_employment_period_versions_revision", sql`${table.revision} > 0`),
    check(
      "company_employment_period_versions_range",
      sql`${table.endsOn} IS NULL OR ${table.startsOn} < ${table.endsOn}`,
    ),
  ],
)

export type EmploymentPeriodVersionRow = InferSelectModel<typeof employmentPeriodVersions>

/** 在籍中の状態期間。prehire / retired は雇用期間の有無から導出する。 */
export const employeeStatusPeriodVersions = sqliteTable(
  "company_employee_status_period_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    periodId: text("period_id").notNull(),
    revision: integer("revision").notNull(),
    employmentPeriodId: text("employment_period_id").notNull().$type<EmploymentId>(),
    employeeId: text("employee_id").notNull().$type<EmployeeId>(),
    status: text("status").notNull().$type<"active" | "leave">(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    isVoid: integer("is_void", { mode: "boolean" }).notNull().default(false),
    recordedByActionId: text("recorded_by_action_id").notNull(),
    recordedAt: integer("recorded_at").notNull(),
  },
  (table) => [
    unique().on(table.periodId, table.revision),
    check("company_employee_status_period_versions_revision", sql`${table.revision} > 0`),
    check(
      "company_employee_status_period_versions_status",
      sql`${table.status} IN ('active', 'leave')`,
    ),
    check(
      "company_employee_status_period_versions_range",
      sql`${table.endsOn} IS NULL OR ${table.startsOn} < ${table.endsOn}`,
    ),
  ],
)

export type EmployeeStatusPeriodVersionRow = InferSelectModel<typeof employeeStatusPeriodVersions>

export const employeeLifecycleRevisions = sqliteTable("company_employee_lifecycle_revisions", {
  employeeId: text("employee_id").primaryKey().$type<EmployeeId>(),
  revision: integer("revision").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
})

export type EmployeeLifecycleRevisionRow = InferSelectModel<typeof employeeLifecycleRevisions>

export const organizationLifecycleState = sqliteTable(
  "company_organization_lifecycle_states",
  {
    id: integer("id").primaryKey(),
    revision: integer("revision").notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    check("organization_lifecycle_state_singleton", sql`${table.id} = 1`),
    check("organization_lifecycle_state_revision", sql`${table.revision} >= 0`),
  ],
)

export type OrganizationLifecycleStateRow = InferSelectModel<typeof organizationLifecycleState>

export const personnelActionRequests = sqliteTable(
  "company_personnel_action_requests",
  {
    id: text("id").primaryKey(),
    applicationId: integer("application_id").notNull().unique(),
    systemProposalSeriesId: text("system_proposal_series_id").unique(),
    targetEmployeeId: text("target_employee_id").$type<EmployeeId>(),
    subjectSnapshotJson: text("subject_snapshot_json"),
    targetDepartmentCode: text("target_department_code"),
    kind: text("kind")
      .notNull()
      .$type<Exclude<PersonnelActionKind, "initial_state" | "employment_revised">>(),
    payloadJson: text("payload_json").notNull(),
    payloadFingerprint: text("payload_fingerprint"),
    requestedByEmployeeId: text("requested_by_employee_id").notNull().$type<EmployeeId>(),
    baseEmployeeRevision: integer("base_employee_revision"),
    baseOrganizationRevision: integer("base_organization_revision"),
    baseCompanyRevision: integer("base_company_revision"),
    createdAt: integer("created_at").notNull(),
    appliedActionId: text("applied_action_id"),
    withdrawnAt: integer("withdrawn_at"),
    withdrawnByEmployeeId: text("withdrawn_by_employee_id").$type<EmployeeId>(),
  },
  (table) => [
    uniqueIndex("uq_company_personnel_action_requests_applied_action")
      .on(table.appliedActionId)
      .where(sql`applied_action_id IS NOT NULL`),
  ],
)

export type PersonnelActionRequestRow = InferSelectModel<typeof personnelActionRequests>

export const lifecycleOutbox = sqliteTable(
  "company_lifecycle_outbox_entries",
  {
    /** 人事の発令と同じ batch で足す行の主キー。列の既定値で UUID を採番する。 */
    id: text("id").primaryKey(),
    /** 主キーを UUID へ移す前の整数の主キー。移行前の記録を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
    personnelActionId: text("personnel_action_id").notNull(),
    effectType: text("effect_type").notNull().$type<"hire" | "retired">(),
    payloadJson: text("payload_json").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at").notNull(),
    processedAt: integer("processed_at"),
    lastErrorCode: text("last_error_code"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("uq_lifecycle_outbox_action_effect").on(table.personnelActionId, table.effectType),
  ],
)

export type LifecycleOutboxRow = InferSelectModel<typeof lifecycleOutbox>
