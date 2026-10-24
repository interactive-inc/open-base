import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { EmploymentType } from "@/contexts/company/domain/definitions/employment-type.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

/** 新しい従業員と最初の雇用の宣言。 */
type InitialWorkforceDeclaration = Readonly<{
  employeeId: string
  employmentId: string
  officialName: string
  employeeCode: string | null
  email: string | null
  phone: string | null
  employmentType: EmploymentType
  status: "active" | "leave"
  effectiveOn: CalendarDate
  accountLink?: Readonly<{ accountId: string; effectiveOn: CalendarDate }>
}>

/** 新規登録の宣言から、公開する人、従業員、雇用、Accountとの対応を組み立てる。 */
export function initialWorkforceResources(
  input: InitialWorkforceDeclaration,
): ReadonlyArray<CompanyResourceProps> {
  const organizationId = COMPANY_DEFAULT_ORGANIZATION_ID
  const personId = deterministicCompanyId("person", input.employeeId)
  const base = {
    organizationId,
    revision: 1,
    effectiveFrom: input.effectiveOn,
    effectiveTo: null,
  }
  const status = input.status === "active" ? "ACTIVE" : "ON_LEAVE"
  return [
    {
      ...base,
      type: "person",
      id: personId,
      state: "active",
      attributes: {
        officialName: input.officialName,
        email: input.email,
        phone: input.phone,
      },
    },
    {
      ...base,
      type: "employee",
      id: input.employeeId,
      state: "active",
      attributes: {
        personId,
        employeeCode: input.employeeCode,
      },
    },
    {
      ...base,
      type: "employment",
      id: input.employmentId,
      state: "active",
      attributes: {
        employeeId: input.employeeId,
        employmentType: input.employmentType,
        status,
      },
    },
    ...(input.accountLink === undefined
      ? []
      : [
          {
            ...base,
            type: "account-employee-link",
            id: deterministicCompanyId("account-link", input.employeeId),
            state: "active",
            effectiveFrom: input.accountLink.effectiveOn,
            attributes: {
              accountId: input.accountLink.accountId,
              employeeId: input.employeeId,
            },
          } satisfies CompanyResourceProps,
        ]),
  ]
}
