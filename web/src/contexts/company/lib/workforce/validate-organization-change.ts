import { applyOrganizationWorkforceChanges } from "@/contexts/company/lib/workforce/apply-organization-workforce-changes"
import { countOrganizationChangePeriods } from "@/contexts/company/domain/definitions/count-organization-change-periods.definition"
import { hasValidOrganizationChangeAuditMetadata } from "@/contexts/company/domain/policies/has-valid-organization-change-audit-metadata.policy"
import { OrganizationChangeValidationError } from "@/contexts/company/domain/errors"
import { organizationChangeHasCanonicalOperation } from "@/contexts/company/domain/policies/organization-change-has-canonical-operation.policy"
import type {
  OrganizationChangeReadPorts,
  OrganizationChangeSet,
  ValidateOrganizationChangeResult,
} from "@/contexts/company/domain/definitions/organization-change.definition"
import { replaceOrganizationChangePeriods } from "@/contexts/company/domain/policies/replace-organization-change-periods.policy"
import { validateOrganizationChangeIdentities } from "@/contexts/company/domain/policies/validate-organization-change-identities.policy"
import { validateOrganizationUnitSnapshot } from "@/contexts/company/domain/policies/validate-organization-unit-snapshot.policy"
import { validateWorkforceSchedules } from "@/contexts/company/domain/policies/validate-workforce-schedules.policy"

export class ValidateOrganizationChange {
  constructor(private readonly ports: OrganizationChangeReadPorts) {
    Object.freeze(this)
  }

  async execute(change: OrganizationChangeSet): Promise<ValidateOrganizationChangeResult> {
    const changes = countOrganizationChangePeriods(change)
    if (changes === 0) {
      return { kind: "invalid", error: new OrganizationChangeValidationError("empty_change") }
    }
    if (!organizationChangeHasCanonicalOperation(change)) {
      return {
        kind: "invalid",
        error: new OrganizationChangeValidationError("invalid_operation"),
      }
    }
    if (!hasValidOrganizationChangeAuditMetadata(change)) {
      return {
        kind: "invalid",
        error: new OrganizationChangeValidationError("invalid_audit"),
      }
    }

    let organization
    let workforce
    try {
      organization = await this.ports.organization.readSnapshot(change.asOf)
      workforce = await this.ports.workforce.readAllSnapshot(change.asOf)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
    if (!organization.ok) return { kind: "unavailable", cause: organization.cause }
    if (!workforce.ok) return { kind: "unavailable", cause: workforce.cause }
    if (organization.snapshot.revision !== change.expectedRevision) {
      return { kind: "conflict", actualRevision: organization.snapshot.revision }
    }

    const identityError = validateOrganizationChangeIdentities(organization.snapshot.units, change)
    if (identityError !== null) return { kind: "invalid", error: identityError }

    const units = replaceOrganizationChangePeriods(organization.snapshot.units, change.unitPeriods)
    if (units instanceof OrganizationChangeValidationError) {
      return { kind: "invalid", error: units }
    }
    const organizationError = validateOrganizationUnitSnapshot({
      revision: change.expectedRevision + changes,
      asOf: change.asOf,
      units,
    })
    if (organizationError !== null) {
      return {
        kind: "invalid",
        error: new OrganizationChangeValidationError("invalid_organization"),
      }
    }

    const schedules = applyOrganizationWorkforceChanges(workforce.schedules, change)
    if (schedules instanceof OrganizationChangeValidationError) {
      return { kind: "invalid", error: schedules }
    }
    if (validateWorkforceSchedules({ schedules, organizationUnitPeriods: units }) !== null) {
      return {
        kind: "invalid",
        error: new OrganizationChangeValidationError("invalid_workforce"),
      }
    }

    return { kind: "valid", resultingRevision: change.expectedRevision + changes }
  }
}
