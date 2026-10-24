import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import { personnelPositionReferenceSchema } from "@/contexts/company/domain/definitions/personnel-position-reference.definition"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

/** 人事発令の役職根拠を、確定する会社版と発効日に一致させる。 */
export function validatePersonnelPositionReference(props: {
  input: PersonnelActionInput
  expectedCompanyRevision?: number
}): CompanyValidationError | null {
  const action = props.input.kind === "corrected" ? props.input.replacementAction : props.input
  if (!("positionReference" in action) || action.positionReference === undefined) return null
  const reference = personnelPositionReferenceSchema.safeParse(action.positionReference)
  if (
    !reference.success ||
    reference.data.organizationId !== COMPANY_DEFAULT_ORGANIZATION_ID ||
    reference.data.organizationRevision !== props.expectedCompanyRevision ||
    reference.data.effectiveOn !== action.eventOn
  ) {
    return new CompanyValidationError(
      "役職の参照根拠が確認した会社版・発効日と一致しません",
      "invalid_change",
    )
  }
  return null
}
