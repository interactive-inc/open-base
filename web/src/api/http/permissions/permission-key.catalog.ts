import { REVIEW_PERMISSION_KEYS } from "@/contexts/performance-review/domain/catalogs/review-permission.catalog"
import { WORK_EXECUTION_PERMISSION_KEYS } from "@/contexts/work-execution/domain/catalogs/work-execution-permission.catalog"
import { CLIENT_PROJECT_PERMISSION_KEYS } from "@/contexts/client-project/domain/catalogs/client-project-permission.catalog"
import { CUSTOMER_PERMISSION_KEYS } from "@/contexts/customer/domain/catalogs/customer-permission.catalog"
import { OFFERING_PERMISSION_KEYS } from "@/contexts/offering/domain/catalogs/offering-permission.catalog"
import { API_COMPOSITION_PERMISSION_KEYS } from "@/api/http/permissions/api-composition-permission-key.catalog"
import { SYSTEM_FEATURE_PERMISSION_KEYS } from "@system/domain/catalogs/iam/system-feature-permission-key.catalog"
import { SYSTEM_PERMISSION_KEYS } from "@system/domain/catalogs/iam/system-permission-key.catalog"
import { z } from "zod"

/** 各bounded contextが所有する権限語彙を、APIとDB投影のために合成する。 */
export const PERMISSION_KEYS = [
  ...SYSTEM_PERMISSION_KEYS,
  ...SYSTEM_FEATURE_PERMISSION_KEYS,
  ...API_COMPOSITION_PERMISSION_KEYS,
  ...REVIEW_PERMISSION_KEYS,
  ...WORK_EXECUTION_PERMISSION_KEYS,
  ...CLIENT_PROJECT_PERMISSION_KEYS,
  ...CUSTOMER_PERMISSION_KEYS,
  ...OFFERING_PERMISSION_KEYS,
] as const

/**
 * 所有単位ごとの権限key。App contextはディレクトリ名で引ける。
 * api-compositionは所有するApp contextが無く、API compositionに残るkey。
 */
export const PERMISSION_KEYS_BY_CONTEXT = {
  system: [...SYSTEM_PERMISSION_KEYS, ...SYSTEM_FEATURE_PERMISSION_KEYS],
  "api-composition": API_COMPOSITION_PERMISSION_KEYS,
  "performance-review": REVIEW_PERMISSION_KEYS,
  "work-execution": WORK_EXECUTION_PERMISSION_KEYS,
  "client-project": CLIENT_PROJECT_PERMISSION_KEYS,
  customer: CUSTOMER_PERMISSION_KEYS,
  offering: OFFERING_PERMISSION_KEYS,
} as const

export type PermissionContext = keyof typeof PERMISSION_KEYS_BY_CONTEXT

export const permissionKeySchema = z.enum(PERMISSION_KEYS)
export type PermissionKey = z.infer<typeof permissionKeySchema>
