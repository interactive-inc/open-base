import type { FormSchema } from "@/lib/application/form-schema"

/**
 * 保存用のフォームスキーマへ変換する。編集中は種類を切り替えても選択肢を保持するが、
 * 保存されるスキーマでは選択式以外の項目の options を null に落とし、従来の保存形と揃える
 */
export function toPersistedFormSchema(schema: FormSchema): FormSchema {
  return {
    fields: schema.fields.map((field) =>
      field.type === "select" ? field : { ...field, options: null },
    ),
  }
}
