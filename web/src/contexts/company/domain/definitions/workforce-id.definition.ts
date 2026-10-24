import { InvalidWorkforceIdError } from "@/contexts/company/domain/errors"
import type { $brand } from "zod"

export type WorkforceIdKind =
  | "employee"
  | "employment"
  | "organization_unit"
  | "period"
  | "personnel_action"
  | "system_account"

export type WorkforceId<TKind extends WorkforceIdKind> = string & $brand<`WorkforceId:${TKind}`>

export type EmployeeId = WorkforceId<"employee">
export type EmploymentId = WorkforceId<"employment">
export type OrganizationUnitId = WorkforceId<"organization_unit">
export type WorkforcePeriodId = WorkforceId<"period">
export type PersonnelActionId = WorkforceId<"personnel_action">
export type SystemAccountId = WorkforceId<"system_account">

/** 永続化した ID は UUID（小文字、version 1〜8、RFC 9562 の variant）に限る。 */
const WORKFORCE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

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
