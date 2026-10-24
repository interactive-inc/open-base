import { SYSTEM_FEATURE_PERMISSION_KEYS } from "@system/domain/catalogs/iam/system-feature-permission-key.catalog"
import { expect, test } from "bun:test"

test("System feature permission keys are exactly the non-core System vocabulary, no duplicates", () => {
  expect(SYSTEM_FEATURE_PERMISSION_KEYS).toEqual([
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
  ])
  expect(new Set(SYSTEM_FEATURE_PERMISSION_KEYS).size).toBe(SYSTEM_FEATURE_PERMISSION_KEYS.length)
})
