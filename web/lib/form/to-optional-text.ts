import type { TextOptions } from "@/lib/form/to-required-text"

export function toOptionalText(
  value: FormDataEntryValue | null,
  options: Omit<TextOptions, "min">,
): string | Error | null {
  if (typeof value !== "string") {
    return null
  }

  const text = value.trim()

  if (text === "") {
    return null
  }

  if (text.length > options.max) {
    return new Error(`${options.label}は${options.max}文字以内で入力してください`)
  }

  return text
}
