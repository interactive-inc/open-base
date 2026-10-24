import { timingSafeStringEqual } from "@system/lib/auth/timing-safe-string-equal"
import { describe, expect, test } from "bun:test"

describe("timingSafeStringEqual", () => {
  test("同じ文字列だけを一致とする", async () => {
    expect(await timingSafeStringEqual("secret", "secret")).toBe(true)
    expect(await timingSafeStringEqual("secret", "other")).toBe(false)
  })

  test("空文字と長さの違う文字列を区別する", async () => {
    expect(await timingSafeStringEqual("", "")).toBe(true)
    expect(await timingSafeStringEqual("", "secret")).toBe(false)
    expect(await timingSafeStringEqual("secret", "secret-longer")).toBe(false)
  })

  test("Unicodeを正規化せずbyte単位で比較する", async () => {
    expect(await timingSafeStringEqual("パスワード🔐", "パスワード🔐")).toBe(true)
    expect(await timingSafeStringEqual("é", "e\u0301")).toBe(false)
  })
})
