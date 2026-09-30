import { describe, expect, test } from "bun:test"
import { IssuedEmailValue } from "@/contexts/system/domain/values/identity/issued-email.value"

const domain = "accounts.example"

describe("IssuedEmailValue", () => {
  test("ローカル部とconfigurationのdomainを結合する", () => {
    const email = IssuedEmailValue.create("emp001", domain)
    expect(email.toString()).toBe("emp001@accounts.example")
    expect(Object.isFrozen(email)).toBe(true)
  })

  test("opaque IDをローカル部にしても発番アドレスを保つ", () => {
    const accountId = "9b3f2a8c-9b4e-4c2a-8f1d-2e6b7a9c0d1e"

    expect(IssuedEmailValue.create(accountId, domain).toString()).toBe(
      `${accountId}@accounts.example`,
    )
  })
  test("configurationのdomainで終わるアドレスを発番アドレスと判定する", () => {
    expect(IssuedEmailValue.create("emp001", domain).isIssuedFor(domain)).toBe(true)
  })

  test("別domainのアドレスを発番アドレスと判定しない", () => {
    expect(IssuedEmailValue.create("user", "example.com").isIssuedFor(domain)).toBe(false)
  })

  test("domainを含んでも末尾でなければ部分一致で誤判定しない", () => {
    expect(IssuedEmailValue.create("accounts.example", "example.com").isIssuedFor(domain)).toBe(
      false,
    )
  })
})
