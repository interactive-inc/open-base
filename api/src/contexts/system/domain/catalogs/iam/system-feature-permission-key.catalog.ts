/** Company roleから利用できる、System IAM最小核以外の機能権限。 */
export const SYSTEM_FEATURE_PERMISSION_KEYS = [
  "account:manage",
  "audit:read",
  "audit:export",
  "system:record:read",
  "system:record:export",
  "system:record:preserve",
  "notification:send",
  "batch:view",
  "system:procedure:read",
  "system:procedure:read:all",
  "system:work:read",
  "system:work:create",
  "system:work:perform",
  "system:work:review",
  "system:work:manage",
  "personal_data:erase",
] as const

export type SystemFeaturePermissionKey = (typeof SYSTEM_FEATURE_PERMISSION_KEYS)[number]
