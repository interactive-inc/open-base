import type { EmployeeProfileVersion } from "@/lib/api/types/employee-profile-version"

/**
 * api/src/employee/employee-response-schema.ts と同形の手書き type。
 * 共有 types/employee-types.ts とは別に employees ドメイン専用で持ち、API と疎結合にする。
 */
export type EmployeeListItem = {
  code: string | null
  name: string
  deptName: string | null
  position: string | null
  email: string
  status: string
}

/** GET /company/employee-directory/:code の詳細。 */
export type EmployeeDetailItem = {
  profileCommandId: string
  profile: EmployeeProfileVersion | null
  code: string
  name: string
  deptName: string | null
  position: string | null
  email: string
  status: string
}
