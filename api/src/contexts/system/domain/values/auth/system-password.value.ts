import { InvalidSystemPasswordError } from "@system/domain/errors"

/**
 * パスフレーズを許容し、compositionごとの複雑性規則をSystem credentialへ持ち込まない。
 * 上限はhash処理による資源枯渇を防ぎ、下限はbootstrap時の弱い初期credentialを拒否する。
 */
export class SystemPasswordValue {
  readonly #value: string

  private constructor(value: string) {
    this.#value = value
    Object.freeze(this)
  }

  static create(value: string): SystemPasswordValue | InvalidSystemPasswordError {
    if (value.length < 12) return new InvalidSystemPasswordError("password_too_short")
    if (value.length > 200) return new InvalidSystemPasswordError("password_too_long")

    return new SystemPasswordValue(value)
  }

  toString(): string {
    return this.#value
  }
}
