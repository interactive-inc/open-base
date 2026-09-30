import { InvalidEmailError } from "@/contexts/system/domain/errors"
import { z } from "zod"

export class EmailValue {
  static readonly schema = z.preprocess(
    (value) => (typeof value === "string" ? EmailValue.normalizeEmail(value) : value),
    z.email(),
  )
  readonly value: string

  private static normalizeEmail(value: string): string {
    return value.trim().toLowerCase()
  }

  private constructor(value: string) {
    this.value = value
    Object.freeze(this)
  }

  static create(value: string): EmailValue | InvalidEmailError {
    const parsed = EmailValue.schema.safeParse(value)
    return parsed.success ? new EmailValue(parsed.data) : new InvalidEmailError()
  }

  toString(): string {
    return this.value
  }
}
