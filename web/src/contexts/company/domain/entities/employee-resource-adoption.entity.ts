import {
  CompanyResourceEntity,
  type CompanyResourceProps,
} from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyConflictError, CompanyValidationError } from "@/contexts/company/domain/errors"
import type {
  EmployeeResourceAdoptionSnapshot,
  EmployeeResourceAdoptionSnapshotValue,
} from "@/contexts/company/domain/values/employee-resource-adoption-snapshot.value"
import { CompanyEmploymentResourceTimelineValue } from "@/contexts/company/domain/values/company-employment-resource-timeline.value"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

export type EmployeeResourceAdoptionInput = Readonly<{
  commandId: string
  employeeId: string
  expectedRevision: number
  snapshotDigest: string
  observedOn: CalendarDate
  reason: string
  resources: ReadonlyArray<CompanyResourceProps>
  reuseExistingHistory?: true
}>
type ComparableResource = Omit<CompanyResourceProps, "effectiveFrom" | "effectiveTo" | "type"> &
  Readonly<{ type: string; effectiveFrom: string; effectiveTo: string | null }>
type Props = Omit<EmployeeResourceAdoptionInput, "resources"> &
  Readonly<{
    actorAccountId: string
    recordedAt: number
    resources: ReadonlyArray<CompanyResourceEntity>
  }>

/** 確認された人物履歴と保存済みの雇用期間が一致する従業員を公開正本へ接続する。 */
export class EmployeeResourceAdoptionEntity {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }

  static create(
    input: EmployeeResourceAdoptionInput & Readonly<{ actorAccountId: string; recordedAt: number }>,
  ): EmployeeResourceAdoptionEntity | CompanyValidationError {
    if (
      !/^\S{1,200}$/.test(input.commandId) ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.employeeId) ||
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0 ||
      input.expectedRevision > Number.MAX_SAFE_INTEGER - 100 ||
      !/^[a-f0-9]{64}$/.test(input.snapshotDigest) ||
      !isCalendarDate(input.observedOn) ||
      !/^\S{1,255}$/.test(input.actorAccountId) ||
      !Number.isSafeInteger(input.recordedAt) ||
      input.recordedAt < 0 ||
      input.reason.trim() !== input.reason ||
      input.reason.length < 1 ||
      input.reason.length > 1500 ||
      input.resources.length < 2 ||
      input.resources.length > 100
    )
      return EmployeeResourceAdoptionEntity.invalid()
    const resources: CompanyResourceEntity[] = []
    const revisions = new Map<string, number>()
    const ordered = input.resources.toSorted(
      (a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id) || a.revision - b.revision,
    )
    for (const props of ordered) {
      const resource = CompanyResourceEntity.create(props)
      if (
        resource instanceof Error ||
        resource.organizationId !== COMPANY_DEFAULT_ORGANIZATION_ID ||
        !["person", "employee", "employment"].includes(resource.type)
      )
        return EmployeeResourceAdoptionEntity.invalid()
      const key = `${resource.type}:${resource.id}`
      if (resource.revision !== (revisions.get(key) ?? 0) + 1)
        return EmployeeResourceAdoptionEntity.invalid()
      revisions.set(key, resource.revision)
      resources.push(resource)
    }
    const people = new Set(resources.filter((r) => r.type === "person").map((r) => r.id))
    const employees = resources.filter((r) => r.type === "employee")
    if (
      people.size !== 1 ||
      employees.length === 0 ||
      employees.some((r) => r.id !== input.employeeId || !people.has(r.readText("personId") ?? ""))
    )
      return EmployeeResourceAdoptionEntity.invalid()
    return new EmployeeResourceAdoptionEntity(
      Object.freeze({ ...input, resources: Object.freeze(resources) }),
    )
  }

  validate(
    snapshot: EmployeeResourceAdoptionSnapshotValue,
  ): null | CompanyConflictError | CompanyValidationError {
    const identity = this.validateSnapshotIdentity(snapshot)
    if (identity !== null) return identity
    if (this.props.reuseExistingHistory && !this.matchesExistingHistory(snapshot))
      return EmployeeResourceAdoptionEntity.invalid()
    return this.validateFacts(snapshot.props.value)
  }

  validateSnapshotIdentity(
    snapshot: EmployeeResourceAdoptionSnapshotValue,
  ): CompanyConflictError | null {
    const source = snapshot.props.value
    if (
      snapshot.props.digest !== this.props.snapshotDigest ||
      (source.organizationRevision ?? 0) !== this.props.expectedRevision ||
      source.employee.id !== this.props.employeeId ||
      source.bindings.length > 0
    )
      return new CompanyConflictError(
        "移行対象が変更されています。再確認してください",
        "employee_resource_adoption_conflict",
      )
    return null
  }

  validateFacts(source: EmployeeResourceAdoptionSnapshot): CompanyValidationError | null {
    if (source.lifecycleRevision === null) return EmployeeResourceAdoptionEntity.invalid()
    if (source.accounts.some((account) => account.displayName !== source.employee.officialName))
      return EmployeeResourceAdoptionEntity.invalid()
    const employee = this.effective("employee", this.props.employeeId, this.props.observedOn)
    const personId = employee?.readText("personId")
    const person =
      personId === null || personId === undefined
        ? null
        : this.effective("person", personId, this.props.observedOn)
    if (
      employee === null ||
      person === null ||
      person.readText("officialName") !== source.employee.officialName ||
      (person.readNullableText("email") ?? null) !== source.employee.email ||
      (person.readNullableText("phone") ?? null) !== source.employee.phone ||
      (employee.readNullableText("employeeCode") ?? null) !== source.employee.employeeCode
    )
      return EmployeeResourceAdoptionEntity.invalid()
    const periods = new Map<string, (typeof source.employmentPeriods)[number]>()
    for (const row of source.employmentPeriods) {
      if (row.employeeId !== source.employee.id) return EmployeeResourceAdoptionEntity.invalid()
      if ((periods.get(row.periodId)?.revision ?? 0) < row.revision) periods.set(row.periodId, row)
    }
    const statuses = new Map<string, (typeof source.statusPeriods)[number]>()
    for (const row of source.statusPeriods) {
      if (row.employeeId !== source.employee.id) return EmployeeResourceAdoptionEntity.invalid()
      if ((statuses.get(row.periodId)?.revision ?? 0) < row.revision)
        statuses.set(row.periodId, row)
    }
    const ids = new Set(source.employments.map((employment) => employment.id))
    if (
      periods.size !== ids.size ||
      [...periods.keys()].some((id) => !ids.has(id)) ||
      [...statuses.values()].some((row) => !ids.has(row.employmentPeriodId))
    )
      return EmployeeResourceAdoptionEntity.invalid()
    const declaredIds = new Set(
      this.props.resources.filter((r) => r.type === "employment").map((r) => r.id),
    )
    if (declaredIds.size !== ids.size || [...declaredIds].some((id) => !ids.has(id)))
      return EmployeeResourceAdoptionEntity.invalid()
    for (const employment of source.employments) {
      const period = periods.get(employment.id)
      const history = this.props.resources.filter(
        (r) => r.type === "employment" && r.id === employment.id,
      )
      const timeline = CompanyEmploymentResourceTimelineValue.create(history)
      if (
        period === undefined ||
        employment.employeeId !== source.employee.id ||
        timeline instanceof Error ||
        timeline.employeeId !== source.employee.id ||
        timeline.employmentType !== employment.employmentType ||
        history.some((r) => r.readText("officialName") !== employment.contractName)
      )
        return EmployeeResourceAdoptionEntity.invalid()
      const expected = [...statuses.values()]
        .filter((row) => row.employmentPeriodId === employment.id && row.isVoid === 0)
        .toSorted((a, b) => a.startsOn.localeCompare(b.startsOn))
      if (period.isVoid === 1) {
        if (timeline.periods.length !== 0 || expected.length !== 0)
          return EmployeeResourceAdoptionEntity.invalid()
        continue
      }
      if (
        timeline.startsOn !== period.startsOn ||
        timeline.endsOn !== period.endsOn ||
        timeline.periods.length !== expected.length ||
        !this.covers("employee", source.employee.id, period.startsOn, period.endsOn)
      )
        return EmployeeResourceAdoptionEntity.invalid()
      for (const [index, row] of expected.entries()) {
        const actual = timeline.periods[index]
        if (
          actual?.startsOn !== row.startsOn ||
          actual.endsOn !== row.endsOn ||
          actual.status !== row.status
        )
          return EmployeeResourceAdoptionEntity.invalid()
      }
    }
    for (const row of this.props.resources.filter(
      (r) =>
        r.type === "employee" &&
        r.state === "active" &&
        !this.props.resources.some(
          (newer) =>
            newer.type === r.type &&
            newer.id === r.id &&
            newer.effectiveFrom === r.effectiveFrom &&
            newer.revision > r.revision,
        ),
    )) {
      const starts = this.props.resources
        .filter((r) => r.type === "employee" && r.effectiveFrom > row.effectiveFrom)
        .map((r) => r.effectiveFrom)
        .sort()
      const next = starts[0] ?? null
      const endsOn =
        next !== null && (row.effectiveTo === null || next < row.effectiveTo)
          ? next
          : row.effectiveTo
      if (!this.covers("person", row.readText("personId") ?? "", row.effectiveFrom, endsOn))
        return EmployeeResourceAdoptionEntity.invalid()
    }
    return null
  }

  toChanges(): ReadonlyArray<CompanyResourceChangeEntity> | Error {
    const maximum = Math.max(...this.props.resources.map((r) => r.revision))
    const changes: CompanyResourceChangeEntity[] = []
    for (let index = 0; index < maximum; index += 1) {
      const change = CompanyResourceChangeEntity.create({
        commandId: `employee-adoption:${this.props.commandId}:${index + 1}`,
        expectedRevision: this.props.expectedRevision + index,
        actorAccountId: this.props.actorAccountId,
        reason: `employee_adoption: ${this.props.reason}`,
        recordedAt: this.props.recordedAt,
        resources: this.props.resources.filter((r) => r.revision === index + 1),
      })
      if (change instanceof Error) return change
      changes.push(change)
    }
    return changes
  }

  private matchesExistingHistory(snapshot: EmployeeResourceAdoptionSnapshotValue): boolean {
    const resources = this.props.resources
    const heads = resources.filter(
      (resource) =>
        !resources.some(
          (newer) =>
            newer.type === resource.type &&
            newer.id === resource.id &&
            newer.revision > resource.revision,
        ),
    )
    const confirmedHistory = this.canonicalResources(resources)
    const storedHistory = this.canonicalResources(snapshot.props.value.publicResources)
    const confirmedHeads = this.canonicalResources(heads)
    const storedHeads = this.canonicalResources(snapshot.props.value.publicHeads)
    return (
      !(confirmedHistory instanceof Error) &&
      !(storedHistory instanceof Error) &&
      !(confirmedHeads instanceof Error) &&
      !(storedHeads instanceof Error) &&
      confirmedHistory.toString() === storedHistory.toString() &&
      confirmedHeads.toString() === storedHeads.toString()
    )
  }

  private canonicalResources(resources: ReadonlyArray<ComparableResource>) {
    return CanonicalSystemJsonValue.create(
      resources
        .toSorted(
          (a, b) =>
            a.type.localeCompare(b.type) || a.id.localeCompare(b.id) || a.revision - b.revision,
        )
        .map((resource) => ({
          organizationId: resource.organizationId,
          type: resource.type,
          id: resource.id,
          revision: resource.revision,
          state: resource.state,
          effectiveFrom: resource.effectiveFrom,
          effectiveTo: resource.effectiveTo,
          attributes: resource.attributes,
        })),
    )
  }

  private effective(
    type: "person" | "employee",
    id: string,
    on: string,
  ): CompanyResourceEntity | null {
    const row = this.props.resources
      .filter((r) => r.type === type && r.id === id && r.effectiveFrom <= on)
      .toSorted(
        (a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.revision - a.revision,
      )[0]
    if (
      row === undefined ||
      row.state !== "active" ||
      (row.effectiveTo !== null && row.effectiveTo <= on)
    )
      return null
    return row
  }

  private covers(
    type: "person" | "employee",
    id: string,
    startsOn: string,
    endsOn: string | null,
  ): boolean {
    const points = new Set([startsOn])
    for (const row of this.props.resources.filter((r) => r.type === type && r.id === id)) {
      for (const on of [row.effectiveFrom, row.effectiveTo]) {
        if (on !== null && on >= startsOn && (endsOn === null || on < endsOn)) points.add(on)
      }
    }
    return [...points].every((on) => this.effective(type, id, on) !== null)
  }

  private static invalid(): CompanyValidationError {
    return new CompanyValidationError(
      "人物履歴と保存済みの雇用・在籍期間が一致しません",
      "invalid_employee_resource_adoption",
    )
  }
}
