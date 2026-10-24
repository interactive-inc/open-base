export class OidcTokenLifetimeValue {
  readonly seconds: number
  readonly milliseconds: number

  constructor(seconds: number) {
    if (!Number.isSafeInteger(seconds) || seconds <= 0) {
      throw new TypeError("OIDC token lifetime must be a positive integer")
    }
    this.seconds = seconds
    this.milliseconds = seconds * 1_000
    Object.freeze(this)
  }
}

export const oidcAuthorizationCodeLifetime = new OidcTokenLifetimeValue(120)
export const oidcAccessTokenLifetime = new OidcTokenLifetimeValue(300)
