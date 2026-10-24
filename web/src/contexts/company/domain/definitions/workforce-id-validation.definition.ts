import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type {
  EmployeeId,
  OrganizationUnitId,
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
