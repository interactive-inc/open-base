import { InvalidSystemCliIdentityRedirectUriError } from "@system/domain/errors"
import { SystemIdentityIssuerValue } from "@system/domain/values/identity/system-identity-issuer.value"

/** 検証済みAPI originから導出したCLI callback URL。 */
export class SystemCliIdentityRedirectUriValue {
  readonly #value: string

  private constructor(value: string) {
    this.#value = value
    Object.freeze(this)
  }

  static create(
    apiOrigin: string,
  ): SystemCliIdentityRedirectUriValue | InvalidSystemCliIdentityRedirectUriError {
    try {
      const origin = new URL(apiOrigin)
      if (
        !new SystemIdentityIssuerValue(origin).isSecure ||
        origin.username !== "" ||
        origin.password !== "" ||
        origin.pathname !== "/" ||
        origin.search !== "" ||
        origin.hash !== ""
      ) {
        return new InvalidSystemCliIdentityRedirectUriError()
      }

      return new SystemCliIdentityRedirectUriValue(
        new URL("/system/cli-authorization-callback", origin.origin).toString(),
      )
    } catch {
      return new InvalidSystemCliIdentityRedirectUriError()
    }
  }

  toString(): string {
    return this.#value
  }
}
