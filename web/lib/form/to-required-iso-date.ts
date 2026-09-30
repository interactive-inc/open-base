import { validateIsoDate } from "@/lib/form/validate-iso-date"

export function toRequiredIsoDate(value: FormDataEntryValue | null, label: string): string | Error {
  if (typeof value !== "string" || value.trim() === "") {
    return new Error(`${label}を入力してください`)
  }

  return validateIsoDate(value.trim(), label)
}
