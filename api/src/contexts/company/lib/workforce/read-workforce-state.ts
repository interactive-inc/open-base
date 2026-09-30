import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { type OrganizationUnitReadPort } from "@/contexts/company/domain/definitions/organization-change.definition"
import { type OrganizationInvariantViolation } from "@/contexts/company/domain/definitions/organization-invariant.definition"
import { validateOrganizationUnitSnapshot } from "@/contexts/company/domain/policies/validate-organization-unit-snapshot.policy"
import {
  resolveWorkforceStateAt,
  type WorkforceStateAt,
} from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import { WorkforceStateResolutionError } from "@/contexts/company/domain/errors"
import { validateWorkforceLifecycleSchedule } from "@/contexts/company/domain/policies/validate-workforce-lifecycle-schedule.policy"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/definitions/workforce-invariant.definition"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { WorkforceSnapshotChangedError } from "@/contexts/company/domain/errors"

export type WorkforceLifecycleReadPortResult =
  | Readonly<{ ok: true; schedule: WorkforceLifecycleSchedule | null }>
  | Readonly<{ ok: false; cause: unknown }>

export type WorkforceLifecycleReadPort = {
  findByEmployeeId(employeeId: EmployeeId): Promise<WorkforceLifecycleReadPortResult>
}

export type ReadWorkforceStateResult =
  | Readonly<{ kind: "found"; state: WorkforceStateAt; organizationRevision: number }>
  | Readonly<{ kind: "not_found" }>
  | Readonly<{
      kind: "invalid_schedule"
      error: WorkforceStateResolutionError | WorkforceInvariantViolation
    }>
  | Readonly<{ kind: "invalid_organization"; error: OrganizationInvariantViolation }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

/** 製品固有の永続化をportの外へ閉じ、Companyの基準日時点状態を読む。 */
export class ReadWorkforceState {
  constructor(
    private readonly ports: Readonly<{
      workforce: WorkforceLifecycleReadPort
      organization: OrganizationUnitReadPort
    }>,
  ) {
    Object.freeze(this)
  }

  async execute(props: {
    employeeId: EmployeeId
    asOf: CalendarDate
  }): Promise<ReadWorkforceStateResult> {
    let organization
    let loaded: WorkforceLifecycleReadPortResult
    try {
      organization = await this.ports.organization.readSnapshot(props.asOf)
      if (!organization.ok) return { kind: "unavailable", cause: organization.cause }
      const organizationError = validateOrganizationUnitSnapshot(organization.snapshot)
      if (organizationError !== null) {
        return { kind: "invalid_organization", error: organizationError }
      }

      loaded = await this.ports.workforce.findByEmployeeId(props.employeeId)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }

    if (!loaded.ok) return { kind: "unavailable", cause: loaded.cause }
    if (loaded.schedule === null) return { kind: "not_found" }

    let currentRevision
    try {
      currentRevision = await this.ports.organization.readRevision()
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
    if (!currentRevision.ok) return { kind: "unavailable", cause: currentRevision.cause }
    if (currentRevision.revision !== organization.snapshot.revision) {
      return { kind: "unavailable", cause: new WorkforceSnapshotChangedError() }
    }

    const scheduleError = validateWorkforceLifecycleSchedule({
      schedule: loaded.schedule,
      organizationUnitPeriods: organization.snapshot.units,
    })
    if (scheduleError !== null) return { kind: "invalid_schedule", error: scheduleError }

    const state = resolveWorkforceStateAt(loaded.schedule, props.asOf)
    return state instanceof WorkforceStateResolutionError
      ? { kind: "invalid_schedule", error: state }
      : { kind: "found", state, organizationRevision: organization.snapshot.revision }
  }
}
