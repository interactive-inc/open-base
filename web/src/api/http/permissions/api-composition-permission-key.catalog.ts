/**
 * 所有する業務Appが無く、API compositionに残る権限key。
 * Companyが所有するがlock対象のcontextへ追加できないもの、複数contextの合成read model、
 * Systemの汎用手続きが対象。各keyを残す理由は
 * api-composition-permission-entry.catalog.ts のreasonに書く。
 */
export const API_COMPOSITION_PERMISSION_KEYS = [
  "application_template:manage",
  "application:approve",
  "application:read:all",
  "application:read:department",
  "dashboard:view",
  "employee_event:manage",
  "employee_event:read:all",
  "employee:archive",
  "employee:assign_role",
  "employee:create",
  "employee:delete",
  "employee:lifecycle:apply",
  "employee:lifecycle:read:all",
  "employee:lifecycle:request",
  "employee:read",
  "employee:update",
  "export:run",
  "grade:manage",
  "grade:read:all",
  "grade:read:reports",
  "management_dashboard:view",
  "org:manage",
  "position:manage",
  "year_end_adjustment:manage",
  "year_end_adjustment:read:all",
] as const

export type ApiCompositionPermissionKey = (typeof API_COMPOSITION_PERMISSION_KEYS)[number]
