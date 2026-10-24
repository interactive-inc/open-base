/** 公開例示値や短い値をbootstrap credentialとして受理しない。 */
export class SystemBootstrapTokenValue {
  readonly #value: string

  private constructor(value: string) {
    this.#value = value
    Object.freeze(this)
  }

  static create(token: string | undefined): SystemBootstrapTokenValue | null {
    if (token === undefined || token.length < 16) return null

    const normalized = token.toLowerCase()
    if (
      normalized.includes("change-me") ||
      normalized.includes("changeme") ||
      normalized.includes("example") ||
      normalized.includes("placeholder")
    ) {
      return null
    }

    return new SystemBootstrapTokenValue(token)
  }

  toString(): string {
    return this.#value
  }
}
