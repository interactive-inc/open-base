import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type {
  EmployeeId,
  OrganizationUnitId,
  PersonnelActionId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import { z } from "zod"

/** HTTP・永続化境界の文字列をcanonical Employee IDへ復元する。 */
export const zEmployeeId = z
  .uuid()
  .transform((value): EmployeeId => restoreWorkforceId("employee", value))

/** HTTP・永続化境界の文字列をcanonical Organization Unit IDへ復元する。 */
export const zOrganizationUnitId = z
  .uuid()
  .transform((value): OrganizationUnitId => restoreWorkforceId("organization_unit", value))

/**
 * 組織単位の変更の操作IDを復元する。保存先の表が小文字の UUID（版1〜8）だけを受けるので、
 * それ以外は保存の前に断り、利用者の入力の誤りとして返せるようにする。
 */
export const zOrganizationChangeOperationId = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  .transform((value): PersonnelActionId => restoreWorkforceId("personnel_action", value))
