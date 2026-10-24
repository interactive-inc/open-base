import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"
import { companyOperationId } from "@/contexts/company/domain/definitions/company-operation-id.definition"
import { z } from "zod"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyConflictError, CompanyValidationError } from "@/contexts/company/domain/errors"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type { OrgAssignmentPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type { AssignmentResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/assignment-resource-adoption-snapshot.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { AssignmentResourceConnectionValue } from "@/contexts/company/domain/values/assignment-resource-connection.value"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const schema = z
  .object({
    commandId: z.string().regex(/^\S{1,200}$/),
    employeeId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
    expectedRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 10_000),
    snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
    observedOn: z.string().date(),
    reason: z.string().trim().min(1).max(1000),
    mappings: z
      .array(
        z
          .object({
            periodId: z.string().regex(/^\S{1,255}$/),
            existingResourceId: z.string().regex(/^\S{1,255}$/),
          })
          .strict()
          .readonly(),
      )
      .min(1)
      .max(1000)
      .readonly()
      .optional(),
    actorAccountId: z.string().regex(/^\S{1,255}$/),
    recordedAt: z.number().int().nonnegative(),
  })
  .readonly()
type Props = z.infer<typeof schema>
export type AssignmentResourceAdoptionInput = Omit<Props, "actorAccountId" | "recordedAt">
export type AdoptedAssignment = Readonly<{
  resource: CompanyResourceEntity
  period: OrgAssignmentPeriod
}>

/** 確認した全改訂を保全し、現在有効な訂正内容を公開所属へ接続する。 */
export class AssignmentResourceAdoptionEntity {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }

  static create(props: Props): AssignmentResourceAdoptionEntity | CompanyValidationError {
    const parsed = schema.safeParse(props)
    if (!parsed.success)
      return new CompanyValidationError("所属の接続内容が不正です", "invalid_assignment_adoption", {
        cause: parsed.error,
      })
    return new AssignmentResourceAdoptionEntity(parsed.data)
  }

  async toAssignments(
    snapshot: AssignmentResourceAdoptionSnapshotValue,
  ): Promise<ReadonlyArray<AdoptedAssignment> | Error> {
    const source = snapshot.props.value
    if (
      source.employeeId !== this.props.employeeId ||
      snapshot.props.digest !== this.props.snapshotDigest ||
      source.organizationRevision !== this.props.expectedRevision ||
      source.pendingOperations !== 0
    )
      return new CompanyConflictError(
        "移行対象が変更されています。再確認してください",
        "assignment_resource_adoption_conflict",
      )
    if (source.employeeOrganizationId !== COMPANY_DEFAULT_ORGANIZATION_ID)
      return new CompanyValidationError(
        "先に従業員と雇用の履歴を接続してください",
        "invalid_assignment_adoption",
      )
    const latest = new Map<string, (typeof source.periods)[number]>()
    for (const period of source.periods) {
      if (
        period.employeeId !== source.employeeId ||
        period.revision !== (latest.get(period.periodId)?.revision ?? 0) + 1 ||
        period.operationStatus !== "COMPLETED" ||
        period.actorAccountId === null ||
        period.reason === null ||
        period.evidenceReferencesJson === null ||
        period.requestFingerprint === null ||
        (period.endsOn !== null && period.endsOn <= period.startsOn)
      )
        return new CompanyValidationError(
          "所属履歴に欠落または所有者の不一致があります",
          "invalid_assignment_adoption",
        )
      latest.set(period.periodId, period)
    }
    if (
      [...latest.values()].some(
        (period) => period.resourceId !== null && period.periodRevision !== period.revision,
      )
    )
      return new CompanyConflictError(
        "所属の接続版が更新されています",
        "assignment_resource_adoption_conflict",
      )
    const unbound = [...latest.values()].filter((period) => period.resourceId === null)
    if (unbound.length === 0 || unbound.length > 1000)
      return new CompanyValidationError(
        "未接続の所属期間は1件から1000件で指定してください",
        "invalid_assignment_adoption",
      )
    const assignments: AdoptedAssignment[] = []
    for (const original of unbound) {
      const canonical = CanonicalSystemJsonValue.create(original.periodId)
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const resource = CompanyResourceEntity.create({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        type: "assignment",
        id: deterministicCompanyId("assignment-adoption-resource", digest.toString()),
        revision: 1,
        state: original.isVoid === 1 ? "void" : "active",
        effectiveFrom: restoreCalendarDate(original.startsOn),
        effectiveTo: original.endsOn === null ? null : restoreCalendarDate(original.endsOn),
        attributes: {
          employeeId: original.employeeId,
          employmentId: original.employmentId,
          organizationUnitId: original.organizationUnitId,
          assignmentType: original.assignmentType,
          positionTitle: original.positionTitle,
        },
      })
      if (resource instanceof Error) return resource
      assignments.push({
        resource,
        period: {
          periodId: restoreWorkforceId("period", original.periodId),
          revision: original.revision + 1,
          employeeId: restoreWorkforceId("employee", original.employeeId),
          employmentId: restoreWorkforceId("employment", original.employmentId),
          organizationUnitId: restoreWorkforceId("organization_unit", original.organizationUnitId),
          assignmentType: original.assignmentType,
          positionTitle: original.positionTitle,
          managerEmployeeId: null,
          startsOn: resource.effectiveFrom,
          endsOn: resource.effectiveTo,
          isVoid: original.isVoid === 1,
          recordedByActionId: restoreWorkforceId(
            "personnel_action",
            companyOperationId(`assignment-adoption:${this.props.snapshotDigest}`),
          ),
          recordedAt: this.props.recordedAt,
        },
      })
    }
    return this.connectExisting(assignments, snapshot)
  }

  private connectExisting(
    assignments: ReadonlyArray<AdoptedAssignment>,
    snapshot: AssignmentResourceAdoptionSnapshotValue,
  ): ReadonlyArray<AdoptedAssignment> | Error {
    const mappings = this.props.mappings ?? []
    if (
      new Set(mappings.map((mapping) => mapping.periodId)).size !== mappings.length ||
      mappings.some(
        (mapping) => !assignments.some((entry) => entry.period.periodId === mapping.periodId),
      )
    )
      return new CompanyValidationError(
        "接続する旧所属期間の指定が不正です",
        "invalid_assignment_connection",
      )
    const groups = new Map<string, AdoptedAssignment[]>()
    const connected: AdoptedAssignment[] = []
    for (const entry of assignments) {
      const target = mappings.find(
        (mapping) => mapping.periodId === entry.period.periodId,
      )?.existingResourceId
      if (target === undefined) {
        connected.push(entry)
        continue
      }
      const group = groups.get(target) ?? []
      group.push(entry)
      groups.set(target, group)
    }
    for (const [target, entries] of groups) {
      const resolved = this.connectGroup(target, entries, snapshot)
      if (resolved instanceof Error) return resolved
      connected.push(...resolved)
    }
    return connected
  }

  private connectGroup(
    target: string,
    entries: ReadonlyArray<AdoptedAssignment>,
    snapshot: AssignmentResourceAdoptionSnapshotValue,
  ): ReadonlyArray<AdoptedAssignment> | Error {
    const first = entries[0]
    if (first === undefined)
      return new CompanyValidationError("接続対象がありません", "invalid_assignment_connection")
    const history: CompanyResourceEntity[] = []
    for (const row of snapshot.props.value.publicAssignments.filter(
      (resource) => resource.resourceId === target,
    )) {
      if (row.bindingEmployeeId !== null)
        return new CompanyValidationError(
          "接続先は既に期間台帳へ接続されています",
          "invalid_assignment_connection",
        )
      const attributes = z.record(z.string(), z.json()).safeParse(
        (() => {
          try {
            return JSON.parse(row.attributesJson)
          } catch {
            return null
          }
        })(),
      )
      if (!attributes.success)
        return new CompanyValidationError(
          "公開所属の属性が不正です",
          "invalid_assignment_connection",
        )
      const resource = CompanyResourceEntity.create({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        type: "assignment",
        id: target,
        revision: row.revision,
        state: row.state,
        effectiveFrom: restoreCalendarDate(row.effectiveFrom),
        effectiveTo: row.effectiveTo === null ? null : restoreCalendarDate(row.effectiveTo),
        attributes: attributes.data,
      })
      if (resource instanceof Error) return resource
      history.push(resource)
    }
    const connection = AssignmentResourceConnectionValue.create({
      history,
      periods: entries.map((entry) => entry.period),
    })
    if (connection instanceof Error) return connection
    const resource = CompanyResourceEntity.create({
      ...connection.head.toProps(),
      revision: connection.head.revision + 1,
    })
    if (resource instanceof Error) return resource
    return entries.map((entry) => ({ ...entry, resource }))
  }

  toChanges(
    resources: ReadonlyArray<CompanyResourceEntity>,
  ): ReadonlyArray<CompanyResourceChangeEntity> | Error {
    const groups = new Map<string, CompanyResourceEntity[]>()
    for (const resource of new Map(
      resources.map((resource) => [
        `${resource.type}:${resource.id}:${resource.revision}`,
        resource,
      ]),
    ).values()) {
      const key = `${resource.type}:${resource.id}`
      const versions = groups.get(key) ?? []
      versions.push(resource)
      groups.set(key, versions)
    }
    const changes: CompanyResourceChangeEntity[] = []
    while (groups.size > 0) {
      const batch: CompanyResourceEntity[] = []
      for (const [key, versions] of groups) {
        if (batch.length === 100) break
        const resource = versions.shift()
        if (resource !== undefined) batch.push(resource)
        if (versions.length === 0) groups.delete(key)
      }
      const change = CompanyResourceChangeEntity.create({
        commandId: `assignment-adoption:${this.props.snapshotDigest}:${changes.length}`,
        expectedRevision: this.props.expectedRevision + changes.length,
        actorAccountId: this.props.actorAccountId,
        recordedAt: this.props.recordedAt,
        reason: this.props.reason,
        resources: batch,
      })
      if (change instanceof Error) return change
      changes.push(change)
    }
    return changes
  }
}
