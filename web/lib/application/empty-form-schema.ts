import type { FormSchema } from "@/lib/application/form-schema"

/**
 * 項目が1つもない空の FormSchema を返す。フォームビルダーの初期値に使う
 */
export function emptyFormSchema(): FormSchema {
  return { fields: [] }
}
