import { employmentTypes } from "@/contexts/company/domain/definitions/employment-type.definition"
import { persistedEmploymentStatuses } from "@/contexts/company/domain/definitions/employment-status.definition"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { sql } from "drizzle-orm"
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

/** Companyが所有する雇用期間。System Accountや業務上の配属から独立した事業共通の正本。 */
export const employments = sqliteTable(
  "company_employments",
  {
    id: text("id").primaryKey(),
    /** 主キーを UUID へ移す前の値。移行前の記録を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
    employeeId: text("employee_id")
      .notNull()
      .$type<EmployeeId>()
      .references(() => employees.id, { onDelete: "restrict" }),
    /** 契約締結時の氏名スナップショット。現在氏名の正本はEmployee.officialName。 */
    contractName: text("contract_name").notNull(),
    employmentType: text("employment_type", { enum: employmentTypes }).notNull(),
    hireDate: text("hire_date").notNull(),
    status: text("status", { enum: persistedEmploymentStatuses }).notNull(),
    /** 雇用終了日（inclusive）。継続中はnull。 */
    terminationDate: text("termination_date"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("company_employments_employee_idx").on(table.employeeId),
    index("company_employments_status_idx").on(table.status),
    uniqueIndex("company_employments_employee_active_unique")
      .on(table.employeeId)
      .where(sql`${table.terminationDate} is null AND ${table.status} IN ('ACTIVE', 'ON_LEAVE')`),
    check(
      "company_employments_contract_name",
      sql`length(${table.contractName}) BETWEEN 1 AND 200 AND trim(${table.contractName}) = ${table.contractName}`,
    ),
    check(
      "company_employments_dates",
      sql`${table.terminationDate} IS NULL OR ${table.hireDate} <= ${table.terminationDate}`,
    ),
    check(
      "company_employments_chronology",
      sql`${table.createdAt} >= 0 AND ${table.updatedAt} >= ${table.createdAt}`,
    ),
  ],
)

/** 雇用に属する任意の人事属性。現場配属へ複製しない。 */
export const employmentAttributes = sqliteTable(
  "company_employment_attributes",
  {
    id: text("id").primaryKey(),
    employmentId: text("employment_id")
      .notNull()
      .references(() => employments.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    position: integer("position").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("company_employment_attributes_employment_idx").on(table.employmentId),
    check("company_employment_attributes_position", sql`${table.position} >= 0`),
    check(
      "company_employment_attributes_chronology",
      sql`${table.updatedAt} >= ${table.createdAt}`,
    ),
  ],
)
