import { describe, expect, test } from "bun:test"
import { Glob } from "bun"
import { readFileSync } from "node:fs"
import * as systemCoreSchema from "@system/infrastructure/schema/system-core"

const systemDirectory = new URL("../", import.meta.url)

describe("System notification boundary", () => {
  test("旧 Notification / NotificationRead schemaを公開しない", () => {
    expect(systemCoreSchema).toHaveProperty("systemNotificationMessages")
    expect(systemCoreSchema).toHaveProperty("systemNotificationDeliveries")
  })

  test("本番コードが旧 Notification / NotificationRead modelへ依存しない", () => {
    const violations = [...new Glob("**/*.ts").scanSync({ cwd: systemDirectory.pathname })]
      .filter((file) => !file.endsWith(".test.ts") && !file.startsWith("test/"))
      .filter((file) => {
        const source = readFileSync(new URL(file, systemDirectory), "utf8")

        return (
          source.includes("notification_reads") ||
          source.includes("notificationReads") ||
          source.includes("recipientUserId") ||
          /sqliteTable\(\s*["']notifications["']/.test(source)
        )
      })

    expect(violations).toEqual([])
  })
})
