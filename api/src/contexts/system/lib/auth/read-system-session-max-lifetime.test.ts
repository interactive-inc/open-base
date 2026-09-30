import { describe, expect, test } from "bun:test"
import {
  DEFAULT_SYSTEM_SESSION_MAX_LIFETIME_SECONDS,
  readSystemSessionMaxLifetimeMilliseconds,
} from "@system/lib/auth/read-system-session-max-lifetime"

describe("readSystemSessionMaxLifetimeMilliseconds", () => {
  test("未設定なら既定の絶対寿命を使う", () => {
    expect(readSystemSessionMaxLifetimeMilliseconds(undefined)).toBe(
      DEFAULT_SYSTEM_SESSION_MAX_LIFETIME_SECONDS * 1_000,
    )
  })

  test("正の整数秒をミリ秒へ変換する", () => {
    expect(readSystemSessionMaxLifetimeMilliseconds("86400")).toBe(86_400_000)
  })

  test("寿命を決められない値は拒否する", () => {
    for (const value of ["", "0", "-1", "1.5", "1e6", " 60", "60s", "9999999999999"]) {
      expect(readSystemSessionMaxLifetimeMilliseconds(value)).toBeInstanceOf(Error)
    }
  })
})
