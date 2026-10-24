import { InvalidOrganizationResponsibilityTypeError } from "@/contexts/company/domain/errors"
import {
  isOrgResponsibilityType,
  type OrgResponsibilityType,
} from "@/contexts/company/domain/definitions/org-responsibility-type.definition"

/** 永続化された責任区分を正規化済みのCompany識別子へ復元する。 */
export function restoreOrgResponsibilityType(value: string): OrgResponsibilityType {
  if (!isOrgResponsibilityType(value)) throw new InvalidOrganizationResponsibilityTypeError()
  return value
}
