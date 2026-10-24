import { z } from "zod"

/**
 * 申請テンプレートの入力項目スキーマ。Google フォーム的に項目を可変に持つため、
 * `fields` 配列に1項目ずつ定義を並べる。`schema_json` カラムに JSON で保存する。
 */
export const formFieldTypeSchema = z.enum(["text", "textarea", "number", "date", "select"])

export type FormFieldType = z.infer<typeof formFieldTypeSchema>

export const formFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: formFieldTypeSchema,
  required: z.boolean(),
  description: z.string().nullable(),
  options: z.array(z.string()).nullable(),
})

export type FormField = z.infer<typeof formFieldSchema>

export const formSchemaSchema = z.object({
  fields: z.array(formFieldSchema),
})

export type FormSchema = z.infer<typeof formSchemaSchema>

/** API が返す現行 schema_json を検証し、FormSchema として返す。 */
export function toFormSchema(raw: unknown): FormSchema {
  return formSchemaSchema.parse(raw)
}
