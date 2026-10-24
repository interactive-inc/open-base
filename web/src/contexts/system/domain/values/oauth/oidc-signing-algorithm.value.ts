export class OidcSigningAlgorithmValue {
  readonly value = "ES256" as const

  constructor() {
    Object.freeze(this)
  }

  toString(): "ES256" {
    return this.value
  }
}

export const oidcSigningAlgorithm = new OidcSigningAlgorithmValue()
