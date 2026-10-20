import { describe, expect, test } from "bun:test"
import { EmailValue } from "@/contexts/system/domain/values/identity/email.value"

describe("EmailValue", () => {
  test("前後空白を除去し小文字化する", () => {
    const email = EmailValue.create("\t　Taro.YAMADA@Example.CO.JP　\n")
    expect(email instanceof EmailValue ? email.toString() : email).toBe("taro.yamada@example.co.jp")
    expect(Object.isFrozen(email)).toBe(true)
  })

  test("途中の空白は正規化で消さない", () => {
    expect(EmailValue.create("foo bar@baz.com")).toBeInstanceOf(Error)
  })

  test("schema は正規化後にメール形式を検証する", () => {
    expect(EmailValue.schema.parse("　Taro@Example.JP　")).toBe("taro@example.jp")
    expect(EmailValue.schema.safeParse("not-an-email").success).toBe(false)
    expect(EmailValue.schema.safeParse("   ").success).toBe(false)
  })

  test("nullable は null を保ち、文字列だけ正規化する", () => {
    const schema = EmailValue.schema.nullable()

    expect(schema.parse(null)).toBeNull()
    expect(schema.parse("USER@Example.com")).toBe("user@example.com")
  })
})
