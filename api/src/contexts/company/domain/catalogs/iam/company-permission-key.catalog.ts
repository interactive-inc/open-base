/** Company が所有する会社・組織・雇用の権限。 */
export const COMPANY_PERMISSION_KEYS = [
  "org:read",
  "org:write",
  "master:org:write",
  "master:grade:write",
  "master:position:write",
  "employee:read",
  "employee:attributes:read",
  "employee:write",
  "employee:write:basic",
  "employee:write:attributes",
] as const

export type CompanyPermissionKey = (typeof COMPANY_PERMISSION_KEYS)[number]
