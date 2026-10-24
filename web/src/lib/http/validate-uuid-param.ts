import { NotFoundError } from "@/lib/http/errors"
import { uuidSchema } from "@/lib/validation/uuid.schema"

/**
 * パスパラメータが主キーの UUID でなければ 404 を投げる。
 * 不正値は「対象リソースが存在しない」と等価なので NotFoundError を返す。
 * 受け入れる集合は DB の CHECK と同じ `uuidSchema` に揃え、保存できない ID で DB を引かない。
 */
export function validateUuidParam(raw: string | undefined, label: string): string {
  const parsed = uuidSchema.safeParse(raw ?? "")

  if (!parsed.success) {
    throw new NotFoundError(`${label} not found`)
  }

  return parsed.data
}
