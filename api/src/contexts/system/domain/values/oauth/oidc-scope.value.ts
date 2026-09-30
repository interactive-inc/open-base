import { InvalidOidcScopeError } from "@system/domain/errors"
const supportedOidcScopes = Object.freeze(["openid", "profile", "email"] as const)
const supportedScopes = new Set<string>(supportedOidcScopes)
const maximumScopeLength = 500
const maximumScopeCount = 50

export class OidcScopeValue {
  readonly items: ReadonlyArray<string>

  private constructor(scopes: ReadonlyArray<string>) {
    this.items = Object.freeze([...scopes])
    Object.freeze(this)
  }

  static create(value: unknown): OidcScopeValue | InvalidOidcScopeError {
    if (typeof value !== "string" || value.length > maximumScopeLength) {
      return new InvalidOidcScopeError("invalid_scope")
    }

    const scopes = [
      ...new Set(
        value
          .trim()
          .split(/\s+/u)
          .filter((scope) => scope !== ""),
      ),
    ]

    if (scopes.length > maximumScopeCount) return new InvalidOidcScopeError("invalid_scope")
    if (!scopes.includes("openid")) {
      return new InvalidOidcScopeError("openid_scope_required")
    }
    if (scopes.some((scope) => !supportedScopes.has(scope))) {
      return new InvalidOidcScopeError("unsupported_scope")
    }

    return new OidcScopeValue(supportedOidcScopes.filter((scope) => scopes.includes(scope)))
  }

  static supported(): OidcScopeValue {
    return new OidcScopeValue(supportedOidcScopes)
  }

  includes(scope: string): boolean {
    return this.items.includes(scope)
  }

  toString(): string {
    return this.items.join(" ")
  }
}
