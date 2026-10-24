import { InvalidSystemAccessTokenSecretError } from "@system/domain/errors"

/** 推測可能な署名鍵と公開済みplaceholderを拒否する署名鍵Value Object。 */
export class SystemAccessTokenSecretValue {
  readonly #value: string

  private constructor(value: string) {
    this.#value = value
    Object.freeze(this)
  }

  static create(value: string): SystemAccessTokenSecretValue | InvalidSystemAccessTokenSecretError {
    if (value.trim().length === 0) return new InvalidSystemAccessTokenSecretError("missing")
    if (value.endsWith("-change-me")) return new InvalidSystemAccessTokenSecretError("placeholder")
    if (value.length < 16) return new InvalidSystemAccessTokenSecretError("too_short")

    return new SystemAccessTokenSecretValue(value)
  }

  toString(): string {
    return this.#value
  }
}
