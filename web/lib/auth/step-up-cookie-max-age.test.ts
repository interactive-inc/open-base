import { describe, expect, test } from "vite-plus/test"
import { stepUpCookieMaxAge } from "@/lib/auth/step-up-cookie-max-age"

const now = new Date("2026-01-01T00:00:00.000Z")

describe("stepUpCookieMaxAge", () => {
  test("残り時間を秒で返す", () => {
    expect(stepUpCookieMaxAge("2026-01-01T00:02:00.000Z", now)).toBe(120)
  })

  test("5分を超える値を300秒に丸める", () => {
    expect(stepUpCookieMaxAge("2026-01-01T00:10:00.000Z", now)).toBe(300)
  })

  test("既に過ぎた時刻はnullを返す", () => {
    expect(stepUpCookieMaxAge("2025-12-31T23:59:00.000Z", now)).toBe(null)
  })

  test("同時刻はnullを返す", () => {
    expect(stepUpCookieMaxAge("2026-01-01T00:00:00.000Z", now)).toBe(null)
  })

  test("解釈できない値はnullを返す", () => {
    expect(stepUpCookieMaxAge("not-a-date", now)).toBe(null)
  })
})
