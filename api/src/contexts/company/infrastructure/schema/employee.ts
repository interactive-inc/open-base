import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { InferSelectModel } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { systemAccounts } from "@system/infrastructure/schema/system-core"

/**
 * Companyで働く人の正本。雇用期間・組織配属・System Accountとの対応から独立した安定IDを持つ。
 * employeeCodeは外部identityプロビジョニングで未採番の従業員を許すためnull許容。
 */
export const employees = sqliteTable(
  "company_employees",
  {
    id: text("id").primaryKey().$type<EmployeeId>(),
    /** 主キーを UUID へ移す前の値。移行前の記録を現在の行へ辿るために残す。 */
    legacyId: text("legacy_id").unique(),
    officialName: text("official_name").notNull(),
    employeeCode: text("employee_code"),
    email: text("email"),
    phone: text("phone"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("company_employees_employee_code_uniq").on(table.employeeCode),
    check("company_employees_id_length", sql`length(${table.id}) BETWEEN 1 AND 128`),
    check(
      "company_employees_official_name",
      sql`length(${table.officialName}) BETWEEN 1 AND 200 AND trim(${table.officialName}) = ${table.officialName}`,
    ),
    check(
      "company_employees_employee_code",
      sql`${table.employeeCode} IS NULL OR (length(${table.employeeCode}) BETWEEN 1 AND 64 AND trim(${table.employeeCode}) = ${table.employeeCode})`,
    ),
    check(
      "company_employees_email",
      sql`${table.email} IS NULL OR (length(${table.email}) BETWEEN 1 AND 320 AND trim(${table.email}) = ${table.email})`,
    ),
    check(
      "company_employees_phone",
      sql`${table.phone} IS NULL OR (length(${table.phone}) BETWEEN 1 AND 64 AND trim(${table.phone}) = ${table.phone})`,
    ),
    check("company_employees_chronology", sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
)

export type EmployeeRow = InferSelectModel<typeof employees>

/** Companyが所有するSystem Accountと従業員台帳の1対1対応。 */
export const accountEmployeeLinks = sqliteTable(
  "company_account_employee_links",
  {
    accountId: text("account_id")
      .primaryKey()
      .$type<AccountId>()
      .references(() => systemAccounts.id, { onDelete: "restrict" }),
    employeeId: text("employee_id")
      .notNull()
      .$type<EmployeeId>()
      .references(() => employees.id, { onDelete: "restrict" }),
  },
  (table) => [uniqueIndex("company_account_employee_links_employee_uniq").on(table.employeeId)],
)

export type AccountEmployeeLinkRow = InferSelectModel<typeof accountEmployeeLinks>
