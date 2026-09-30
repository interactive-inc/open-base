import { InvalidWorkforceIdError } from "@/contexts/company/domain/errors"
import type {
  WorkforceId,
  WorkforceIdKind,
} from "@/contexts/company/domain/definitions/workforce-id.definition"

const WORKFORCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

/** 永続化形式を文字列へ写した後のIDを、Company Domainのopaque IDへ復元する。 */
export function restoreWorkforceId<TKind extends WorkforceIdKind>(
  kind: TKind,
  value: string,
): WorkforceId<TKind> {
  if (!WORKFORCE_ID_PATTERN.test(value)) {
    throw new InvalidWorkforceIdError(kind)
  }

  return value as WorkforceId<TKind>
}
