import { InvalidOidcScopeError } from "@system/domain/errors"
import { OidcScopeValue } from "@system/domain/values/oauth/oidc-scope.value"
import { describe, expect, test } from "bun:test"

describe("OidcScopeValue", () => {
  test("重複を除き公開順へ正規化したimmutable snapshotを返す", () => {
    const scopes = OidcScopeValue.create("email openid profile email")

    expect(scopes).toBeInstanceOf(OidcScopeValue)
    if (!(scopes instanceof OidcScopeValue)) throw scopes
    expect(scopes.items).toEqual(["openid", "profile", "email"])
    expect(Object.isFrozen(scopes)).toBe(true)
    expect(Object.isFrozen(scopes.items)).toBe(true)
  })

  test("openid欠落、未対応scope、case違いを拒否する", () => {
    expect(OidcScopeValue.create("profile")).toEqual(
      new InvalidOidcScopeError("openid_scope_required"),
    )
    expect(OidcScopeValue.create("openid admin")).toEqual(
      new InvalidOidcScopeError("unsupported_scope"),
    )
    expect(OidcScopeValue.create("OpenID")).toEqual(
      new InvalidOidcScopeError("openid_scope_required"),
    )
  })

  test("型違いと過大なscope inputを例外にせずfail closedで拒否する", () => {
    expect(OidcScopeValue.create(null)).toEqual(new InvalidOidcScopeError("invalid_scope"))
    expect(OidcScopeValue.create("x".repeat(501))).toEqual(
      new InvalidOidcScopeError("invalid_scope"),
    )
    expect(
      OidcScopeValue.create(
        `openid ${Array.from({ length: 51 }, (_, index) => `s${index}`).join(" ")}`,
      ),
    ).toBeInstanceOf(Error)
  })
})
