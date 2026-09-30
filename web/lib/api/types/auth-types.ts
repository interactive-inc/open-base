import type { EmployeeProfileVersion } from "@/lib/api/types/employee-profile-version"
import type { PermissionKey } from "@/lib/api/types/permission-key"

/**
 * api/src/auth の *-response-schema.ts と同形の手書き type。
 * api と疎結合にするため import しない。
 */
export type LoginRequest = {
  email: string
  password: string
}

export type LoginResponse = {
  access_token: string
  refresh_token: string | null
}

export type RefreshResponse = {
  access_token: string
  refresh_token: string | null
}

export type MeResponse = {
  profileCommandId: string
  profile: EmployeeProfileVersion | null
  id: string
  code: string | null
  name: string
  email: string
  role: string
  dept_name: string | null
  position: string | null
  phone: string | null
  permissions: ReadonlyArray<PermissionKey>
  role_keys: ReadonlyArray<string>
}
