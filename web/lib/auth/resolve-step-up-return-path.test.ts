import { describe, expect, test } from "vite-plus/test"
import { resolveStepUpReturnPath } from "@/lib/auth/resolve-step-up-return-path"

describe("resolveStepUpReturnPath", () => {
  test("同じ origin の path はそのまま返す", () => {
    expect(resolveStepUpReturnPath("/system/roles?page=2")).toBe("/system/roles?page=2")
  })

  test("別 origin へ出る形と空値を拒否する", () => {
    for (const value of [
      null,
      "",
      "https://evil.example.com",
      "//evil.example.com",
      "/\\evil",
      "roles",
      "/a\nb",
    ]) {
      expect(resolveStepUpReturnPath(value)).toBeNull()
    }
    expect(resolveStepUpReturnPath(`/${"a".repeat(512)}`)).toBeNull()
  })
})
