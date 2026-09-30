import type { FormFieldType } from "@/lib/application/form-schema"

/**
 * 入力項目タイプを画面表示用の日本語ラベルに変換する
 */
export function toFormFieldTypeLabel(type: FormFieldType): string {
  if (type === "text") return "1行テキスト"

  if (type === "textarea") return "複数行テキスト"

  if (type === "number") return "数値"

  if (type === "date") return "日付"

  return "選択肢"
}
