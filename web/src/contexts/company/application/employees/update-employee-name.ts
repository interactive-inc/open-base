import {
  EmployeeProfileChangeEntity,
  type EmployeeProfileUpdateInput,
} from "@/contexts/company/domain/entities/employee-profile-change.entity"
import { CompanyForbiddenError, type CompanyOperationError } from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type {
  EmployeeProfileRepository,
  EmployeeProfileUpdateResult,
} from "@/contexts/company/infrastructure/repositories/employee/employee-profile.repository"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Context = Readonly<{
  actor: CompanyActorValue
  repository: EmployeeProfileRepository
  now: Date
}>

export class UpdateEmployeeName {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    input: EmployeeProfileUpdateInput & Readonly<{ code: string; officialName: string }>,
  ): Promise<EmployeeProfileUpdateResult | CompanyOperationError> {
    if (
      !this.c.actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
      !this.c.actor.hasPermission("employee:write:basic")
    )
      return new CompanyForbiddenError()
    const command = EmployeeProfileChangeEntity.create({
      commandId: input.commandId,
      profile: input.profile,
      reason: input.reason,
      actorAccountId: this.c.actor.accountId,
      recordedAt: this.c.now.getTime(),
      field: "officialName",
      value: input.officialName,
      employeeCode: input.code,
    })
    if (command instanceof Error) return command
    return this.c.repository.update(command)
  }
}
