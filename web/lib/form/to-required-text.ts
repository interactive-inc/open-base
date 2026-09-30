export type TextOptions = {
  label: string
  max: number
  min?: number
}

export function toRequiredText(
  value: FormDataEntryValue | null,
  options: TextOptions,
): string | Error {
  if (typeof value !== "string") {
    return new Error(`${options.label}を入力してください`)
  }

  const text = value.trim()
  const min = options.min ?? 1

  if (text.length < min) {
    return new Error(
      min <= 1
        ? `${options.label}を入力してください`
        : `${options.label}は${min}文字以上で入力してください`,
    )
  }

  if (text.length > options.max) {
    return new Error(`${options.label}は${options.max}文字以内で入力してください`)
  }

  return text
}
