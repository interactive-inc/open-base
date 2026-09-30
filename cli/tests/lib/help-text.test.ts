import { helpText } from "@/lib/help-text"
import { describe, expect, test } from "bun:test"
import { readdirSync } from "node:fs"
import { join } from "node:path"

/**
 * cli/app 直下のトップレベルコマンド群がすべてトップレベル help に現れることを検証する。
 * 新しいコマンド群を追加して help への追記を忘れると、ここで落ちてドリフトを検知する
 */
describe("help-text", () => {
  test("every top-level command group appears in the help", () => {
    const appDir = join(import.meta.dir, "../../app")

    const groups = readdirSync(appDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)

    const missing = groups.filter((group) => {
      const pattern = new RegExp(`^\\s+${escapeForRegExp(group)}\\b`, "m")

      return pattern.test(helpText) === false
    })

    expect(missing).toEqual([])
  })
})

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
