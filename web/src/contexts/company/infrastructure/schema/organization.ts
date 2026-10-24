import type { InferSelectModel } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { check, index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core"
import { organizationUnitKinds } from "@/contexts/company/domain/definitions/organization-unit.definition"
import { orgAssignmentTypes } from "@/contexts/company/domain/definitions/org-assignment-type.definition"
import { organizationLifecycleState } from "@/contexts/company/infrastructure/schema/employee-lifecycle"

/** 一つの原子的な組織変更。expected revision競合と部分適用をDB境界で拒否する。 */
export const organizationChangeOperations = sqliteTable(
  "company_organization_change_operations",
  {
    id: text("id").primaryKey(),
    /** 主キーを UUID へ移す前の値。移行前の記録を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
    /** trigger が操作を見つけるための旧来の鍵。ID はこの鍵から決まる UUID */
    operationKey: text("operation_key").unique(),
    expectedRevision: integer("expected_revision").notNull(),
    changeCount: integer("change_count").notNull(),
    appliedCount: integer("applied_count").notNull().default(0),
    resultingRevision: integer("resulting_revision").notNull(),
    status: text("status", { enum: ["PENDING", "COMPLETED"] })
      .notNull()
      .default("PENDING"),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
    actorAccountId: text("actor_account_id").notNull().default("system:initialization"),
    reason: text("reason").notNull().default("initial organization change"),
    evidenceReferencesJson: text("evidence_references_json").notNull().default("[]"),
    requestFingerprint: text("request_fingerprint")
      .notNull()
      .default("0000000000000000000000000000000000000000000000000000000000000000"),
  },
  (table) => [
    check("company_organization_change_operations_id", sql`length(${table.id}) BETWEEN 1 AND 128`),
    check("company_organization_change_operations_expected", sql`${table.expectedRevision} >= 0`),
    check("company_organization_change_operations_count", sql`${table.changeCount} >= 1`),
    check(
      "company_organization_change_operations_applied",
      sql`${table.appliedCount} BETWEEN 0 AND ${table.changeCount}`,
    ),
    check(
      "company_organization_change_operations_result",
      sql`${table.resultingRevision} = ${table.expectedRevision} + ${table.changeCount}`,
    ),
    check(
      "company_organization_change_operations_status",
      sql`${table.status} IN ('PENDING', 'COMPLETED')`,
    ),
    check("company_organization_change_operations_recorded", sql`${table.recordedAt} >= 0`),
    check(
      "company_organization_change_operations_actor",
      sql`length(${table.actorAccountId}) BETWEEN 1 AND 255 AND trim(${table.actorAccountId}) = ${table.actorAccountId}`,
    ),
    check(
      "company_organization_change_operations_reason",
      sql`length(${table.reason}) BETWEEN 1 AND 1000 AND trim(${table.reason}) = ${table.reason}`,
    ),
    check(
      "company_organization_change_operations_evidence",
      sql`json_valid(${table.evidenceReferencesJson}) AND json_type(${table.evidenceReferencesJson}) = 'array'`,
    ),
    check(
      "company_organization_change_operations_fingerprint",
      sql`length(${table.requestFingerprint}) = 64
          AND ${table.requestFingerprint} NOT GLOB '*[^0-9a-f]*'`,
    ),
  ],
)

export type OrganizationChangeOperationRow = InferSelectModel<typeof organizationChangeOperations>

/** Company組織単位の安定identity。名称・code・親子関係は期間version側が所有する。 */
export const organizationUnits = sqliteTable(
  "company_organization_units",
  {
    id: text("id").primaryKey(),
    /** UUID へ移す前の組織単位 ID。移行前の記録を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [check("company_organization_units_created_at", sql`${table.createdAt} >= 0`)],
)

export type OrganizationUnitRow = InferSelectModel<typeof organizationUnits>

/** OrgUnitの有効期間付き属性。既存revisionは更新・削除せず、訂正を追記する。 */
export const organizationUnitPeriodVersions = sqliteTable(
  "company_organization_unit_period_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    periodId: text("period_id").notNull(),
    revision: integer("revision").notNull(),
    organizationUnitId: text("organization_unit_id")
      .notNull()
      .references(() => organizationUnits.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    officialName: text("official_name").notNull(),
    kind: text("kind", { enum: organizationUnitKinds }).notNull(),
    parentOrganizationUnitId: text("parent_organization_unit_id").references(
      (): typeof organizationUnits.id => organizationUnits.id,
      { onDelete: "restrict" },
    ),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    isVoid: integer("is_void", { mode: "boolean" }).notNull().default(false),
    recordedByActionId: text("recorded_by_action_id")
      .notNull()
      .references(() => organizationChangeOperations.id, { onDelete: "restrict" }),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    unique().on(table.periodId, table.revision),
    index("company_organization_unit_period_versions_unit_idx").on(
      table.organizationUnitId,
      table.startsOn,
      table.endsOn,
      table.periodId,
      table.revision,
    ),
    index("company_organization_unit_period_versions_code_idx").on(
      table.code,
      table.startsOn,
      table.endsOn,
      table.periodId,
      table.revision,
    ),
    index("company_organization_unit_period_versions_parent_idx").on(
      table.parentOrganizationUnitId,
      table.startsOn,
      table.endsOn,
    ),
    check("company_organization_unit_period_versions_revision", sql`${table.revision} >= 1`),
    check(
      "company_organization_unit_period_versions_code",
      sql`length(${table.code}) BETWEEN 1 AND 64 AND trim(${table.code}) = ${table.code}`,
    ),
    check(
      "company_organization_unit_period_versions_name",
      sql`length(${table.officialName}) BETWEEN 1 AND 200
          AND trim(${table.officialName}) = ${table.officialName}`,
    ),
    check(
      "company_organization_unit_period_versions_kind",
      sql`${table.kind} IN ('COMPANY', 'DIVISION', 'DEPARTMENT', 'TEAM', 'OTHER')`,
    ),
    check(
      "company_organization_unit_period_versions_parent",
      sql`${table.parentOrganizationUnitId} IS NULL
          OR ${table.parentOrganizationUnitId} != ${table.organizationUnitId}`,
    ),
    check(
      "company_organization_unit_period_versions_range",
      sql`length(${table.startsOn}) = 10
          AND date(${table.startsOn}) IS ${table.startsOn}
          AND (
            ${table.endsOn} IS NULL OR (
              length(${table.endsOn}) = 10
              AND date(${table.endsOn}) IS ${table.endsOn}
              AND ${table.startsOn} < ${table.endsOn}
            )
          )`,
    ),
    check("company_organization_unit_period_versions_recorded_at", sql`${table.recordedAt} >= 0`),
  ],
)

export type OrganizationUnitPeriodVersionRow = InferSelectModel<
  typeof organizationUnitPeriodVersions
>

/** EmploymentとOrgUnitの主務・兼務所属。旧部署projectionから独立した正本。 */
export const organizationAssignmentPeriodVersions = sqliteTable(
  "company_organization_assignment_period_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    periodId: text("period_id").notNull(),
    revision: integer("revision").notNull(),
    employmentId: text("employment_id").notNull(),
    employeeId: text("employee_id").notNull(),
    organizationUnitId: text("organization_unit_id")
      .notNull()
      .references(() => organizationUnits.id, { onDelete: "restrict" }),
    assignmentType: text("assignment_type", { enum: orgAssignmentTypes }).notNull(),
    positionTitle: text("position_title"),
    managerEmployeeId: text("manager_employee_id"),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    isVoid: integer("is_void", { mode: "boolean" }).notNull().default(false),
    recordedByActionId: text("recorded_by_action_id")
      .notNull()
      .references(() => organizationChangeOperations.id, { onDelete: "restrict" }),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    unique().on(table.periodId, table.revision),
    index("company_organization_assignment_period_versions_employee_idx").on(
      table.employeeId,
      table.startsOn,
      table.endsOn,
      table.assignmentType,
      table.periodId,
      table.revision,
    ),
    index("company_organization_assignment_period_versions_unit_idx").on(
      table.organizationUnitId,
      table.startsOn,
      table.endsOn,
      table.periodId,
      table.revision,
    ),
    check("company_organization_assignment_period_versions_revision", sql`${table.revision} >= 1`),
    check(
      "company_organization_assignment_period_versions_type",
      sql`${table.assignmentType} IN ('PRIMARY', 'CONCURRENT')`,
    ),
    check(
      "company_organization_assignment_period_versions_position",
      sql`${table.positionTitle} IS NULL OR (
        length(${table.positionTitle}) BETWEEN 1 AND 200
        AND trim(${table.positionTitle}) = ${table.positionTitle}
      )`,
    ),
    check(
      "company_organization_assignment_period_versions_manager",
      sql`${table.managerEmployeeId} IS NULL OR ${table.managerEmployeeId} != ${table.employeeId}`,
    ),
    check(
      "company_organization_assignment_period_versions_range",
      sql`length(${table.startsOn}) = 10
          AND date(${table.startsOn}) IS ${table.startsOn}
          AND (
            ${table.endsOn} IS NULL OR (
              length(${table.endsOn}) = 10
              AND date(${table.endsOn}) IS ${table.endsOn}
              AND ${table.startsOn} < ${table.endsOn}
            )
          )`,
    ),
    check(
      "company_organization_assignment_period_versions_recorded",
      sql`${table.recordedAt} >= 0`,
    ),
  ],
)

export type OrganizationAssignmentPeriodVersionRow = InferSelectModel<
  typeof organizationAssignmentPeriodVersions
>

/** 所属とは独立した期間付き責務。保持者は同じOrgUnitへの所属を別途必要とする。 */
export const organizationResponsibilityPeriodVersions = sqliteTable(
  "company_organization_responsibility_period_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    periodId: text("period_id").notNull(),
    revision: integer("revision").notNull(),
    employmentId: text("employment_id").notNull(),
    employeeId: text("employee_id").notNull(),
    organizationUnitId: text("organization_unit_id")
      .notNull()
      .references(() => organizationUnits.id, { onDelete: "restrict" }),
    responsibilityType: text("responsibility_type").notNull(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    isVoid: integer("is_void", { mode: "boolean" }).notNull().default(false),
    recordedByActionId: text("recorded_by_action_id")
      .notNull()
      .references(() => organizationChangeOperations.id, { onDelete: "restrict" }),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    unique().on(table.periodId, table.revision),
    index("company_organization_responsibility_period_versions_employee_idx").on(
      table.employeeId,
      table.startsOn,
      table.endsOn,
      table.periodId,
      table.revision,
    ),
    index("company_organization_responsibility_period_versions_unit_idx").on(
      table.organizationUnitId,
      table.responsibilityType,
      table.startsOn,
      table.endsOn,
      table.periodId,
      table.revision,
    ),
    check(
      "company_organization_responsibility_period_versions_revision",
      sql`${table.revision} >= 1`,
    ),
    check(
      "company_organization_responsibility_period_versions_type",
      sql`length(${table.responsibilityType}) BETWEEN 1 AND 64
          AND ${table.responsibilityType} GLOB '[A-Z]*'
          AND ${table.responsibilityType} NOT GLOB '*[^A-Z0-9_]*'`,
    ),
    check(
      "company_organization_responsibility_period_versions_range",
      sql`length(${table.startsOn}) = 10
          AND date(${table.startsOn}) IS ${table.startsOn}
          AND (
            ${table.endsOn} IS NULL OR (
              length(${table.endsOn}) = 10
              AND date(${table.endsOn}) IS ${table.endsOn}
              AND ${table.startsOn} < ${table.endsOn}
            )
          )`,
    ),
    check(
      "company_organization_responsibility_period_versions_recorded",
      sql`${table.recordedAt} >= 0`,
    ),
  ],
)

export type OrganizationResponsibilityPeriodVersionRow = InferSelectModel<
  typeof organizationResponsibilityPeriodVersions
>

/** Company組織のrevision。旧lifecycle schemaの物理tableを共通名で公開する。 */
export const organizationLifecycleStates = organizationLifecycleState
