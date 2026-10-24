import { describe, expect, test } from "vite-plus/test"
import { toAuthorityScopeLabel } from "@/app/(app)/company/definitions/_lib/to-authority-scope-label"
import type { CompanyResource } from "@/lib/api/types/company-resource-types"

function toAuthorityScope(attributes: Readonly<Record<string, unknown>>): CompanyResource {
  return {
    organizationId: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
    type: "authority-scope",
    id: "authority-scope:1",
    revision: 1,
    state: "active",
    effectiveFrom: "2026-04-01",
    effectiveTo: null,
    attributes,
  }
}

describe("toAuthorityScopeLabel", () => {
  test("識別子で表す範囲は scopeId を返す", () => {
    expect(
      toAuthorityScopeLabel(
        toAuthorityScope({ scopeType: "organization-unit", scopeId: "unit:1" }),
      ),
    ).toBe("unit:1")
  })

  test("地域は regionCode を返す", () => {
    expect(
      toAuthorityScopeLabel(toAuthorityScope({ scopeType: "region", regionCode: "APAC" })),
    ).toBe("APAC")
  })

  test("金額は下限と上限の両方を通貨とともに表す", () => {
    expect(
      toAuthorityScopeLabel(
        toAuthorityScope({
          scopeType: "amount",
          currencyCode: "JPY",
          minimumAmount: 10000,
          maximumAmount: 500000,
        }),
      ),
    ).toBe("JPY 10,000 以上 500,000 以下")
  })

  test("金額の上限が無いときは下限だけを表す", () => {
    expect(
      toAuthorityScopeLabel(
        toAuthorityScope({
          scopeType: "amount",
          currencyCode: "JPY",
          minimumAmount: 10000,
          maximumAmount: null,
        }),
      ),
    ).toBe("JPY 10,000 以上")
  })

  test("金額の上下限がどちらも無いときは通貨だけを表す", () => {
    expect(
      toAuthorityScopeLabel(
        toAuthorityScope({
          scopeType: "amount",
          currencyCode: "JPY",
          minimumAmount: null,
          maximumAmount: null,
        }),
      ),
    ).toBe("JPY")
  })

  test("属性が欠けているときはハイフンを返す", () => {
    expect(toAuthorityScopeLabel(toAuthorityScope({}))).toBe("-")
  })
})
