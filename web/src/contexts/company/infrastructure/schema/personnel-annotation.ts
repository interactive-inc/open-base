import type { InferSelectModel } from "drizzle-orm"
import { sqliteTable, text } from "drizzle-orm/sqlite-core"

/** 移行元の人事注記。確定した発令へ読み替えず原記録を保持する */
export const personnelAnnotations = sqliteTable("company_personnel_annotations", {
  id: text("id").primaryKey(),
  /** 主キーを UUID へ移す前の整数の主キー。移行前の記録を現在の行へ辿るために残す。 */
  legacyId: text("legacy_id").unique(),
  employeeId: text("employee_id").notNull(),
  kind: text("kind").notNull(),
  effectiveDate: text("effective_date").notNull(),
  fromDepartmentCode: text("from_department_code"),
  toDepartmentCode: text("to_department_code"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
})

export type PersonnelAnnotationRow = InferSelectModel<typeof personnelAnnotations>
