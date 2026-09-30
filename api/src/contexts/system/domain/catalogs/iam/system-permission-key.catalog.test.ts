import { SYSTEM_PERMISSION_KEYS } from "@system/domain/catalogs/iam/system-permission-key.catalog"
import { expect, test } from "bun:test"

test("portable System IAM core owns only the universal permission keys", () => {
  expect(SYSTEM_PERMISSION_KEYS).toEqual(["system:admin", "iam:read", "iam:write"])
  expect(new Set(SYSTEM_PERMISSION_KEYS).size).toBe(SYSTEM_PERMISSION_KEYS.length)
})
