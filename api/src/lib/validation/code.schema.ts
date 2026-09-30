import { z } from "zod"

/** コード・識別子フィールド共通。空文字と長すぎる値を弾く。 */
export const codeSchema = z.string().min(1).max(200)
