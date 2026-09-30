import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"
import { companyOperationId } from "@/contexts/company/domain/definitions/company-operation-id.definition"
import { restoreOrgResponsibilityType } from "@/contexts/company/domain/definitions/restore-org-responsibility-type.definition"
import { z } from "zod"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyConflictError, CompanyValidationError } from "@/contexts/company/domain/errors"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type { OrgResponsibilityPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type { ResponsibilityResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/responsibility-resource-adoption-snapshot.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { ResponsibilityResourceConnectionValue } from "@/contexts/company/domain/values/responsibility-resource-connection.value"
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
            responsibilityId: z.string().regex(/^\S{1,255}$/),
            authorityScopeId: z.string().regex(/^\S{1,255}$/),
            existingResourceId: z
              .string()
              .regex(/^\S{1,255}$/)
              .optional(),
          })
          .strict()
          .readonly(),
      )
      .min(1)
      .max(1000)
      .readonly(),
    actorAccountId: z.string().regex(/^\S{1,255}$/),
    recordedAt: z.number().int().nonnegative(),
  })
  .readonly()
type Props = z.infer<typeof schema>
export type ResponsibilityResourceAdoptionInput = Omit<Props, "actorAccountId" | "recordedAt">
export type AdoptedResponsibility = Readonly<{
  resource: CompanyResourceEntity
  period: OrgResponsibilityPeriod
}>

/** 確認した全改訂を保全し、現在有効な訂正内容を公開責務へ接続する。 */
export class ResponsibilityResourceAdoptionEntity {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }

  static create(props: Props): ResponsibilityResourceAdoptionEntity | CompanyValidationError {
    const parsed = schema.safeParse(props)
    if (!parsed.success)
      return new CompanyValidationError(
        "責務の接続内容が不正です",
        "invalid_responsibility_adoption",
        {
          cause: parsed.error,
        },
      )
    return new ResponsibilityResourceAdoptionEntity(parsed.data)
  }

  async toResponsibilities(
    snapshot: ResponsibilityResourceAdoptionSnapshotValue,
  ): Promise<ReadonlyArray<AdoptedResponsibility> | Error> {
    const source = snapshot.props.value
    if (
      source.employeeId !== this.props.employeeId ||
      snapshot.props.digest !== this.props.snapshotDigest ||
      source.organizationRevision !== this.props.expectedRevision ||
      source.pendingOperations !== 0
    )
      return new CompanyConflictError(
        "移行対象が変更されています。再確認してください",
        "responsibility_resource_adoption_conflict",
      )
    if (source.employeeOrganizationId !== COMPANY_DEFAULT_ORGANIZATION_ID)
      return new CompanyValidationError(
        "先に従業員と雇用の履歴を接続してください",
        "invalid_responsibility_adoption",
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
          "責務履歴に欠落または所有者の不一致があります",
          "invalid_responsibility_adoption",
        )
      latest.set(period.periodId, period)
    }
    if (
      [...latest.values()].some(
        (period) => period.resourceId !== null && period.periodRevision !== period.revision,
      )
    )
      return new CompanyConflictError(
        "責務の接続版が更新されています",
        "responsibility_resource_adoption_conflict",
      )
    const unbound = [...latest.values()].filter((period) => period.resourceId === null)
    if (unbound.length === 0 || unbound.length > 1000)
      return new CompanyValidationError(
        "未接続の責務期間は1件から1000件で指定してください",
        "invalid_responsibility_adoption",
      )
    if (
      this.props.mappings.length !== unbound.length ||
      new Set(this.props.mappings.map((mapping) => mapping.periodId)).size !== unbound.length ||
      this.props.mappings.some(
        (mapping) => !unbound.some((period) => period.periodId === mapping.periodId),
      )
    )
      return new CompanyValidationError(
        "未接続の全責務期間の接続先を指定してください",
        "invalid_responsibility_adoption",
      )
    const responsibilities: AdoptedResponsibility[] = []
    for (const original of unbound) {
      const mapping = this.props.mappings.find((mapping) => mapping.periodId === original.periodId)
      if (mapping === undefined)
        return new CompanyValidationError(
          "責務の接続先がありません",
          "invalid_responsibility_adoption",
        )
      const canonical = CanonicalSystemJsonValue.create(original.periodId)
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const resource = CompanyResourceEntity.create({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        type: "responsibility-assignment",
        id: deterministicCompanyId("responsibility-adoption-resource", digest.toString()),
        revision: 1,
        state: original.isVoid === 1 ? "void" : "active",
        effectiveFrom: restoreCalendarDate(original.startsOn),
        effectiveTo: original.endsOn === null ? null : restoreCalendarDate(original.endsOn),
        attributes: {
          responsibilityId: mapping.responsibilityId,
          authorityScopeId: mapping.authorityScopeId,
          holderType: "employee",
          holderId: original.employeeId,
          delegationAllowed: false,
        },
      })
      if (resource instanceof Error) return resource
      responsibilities.push({
        resource,
        period: {
          periodId: restoreWorkforceId("period", original.periodId),
          revision: original.revision + 1,
          employeeId: restoreWorkforceId("employee", original.employeeId),
          employmentId: restoreWorkforceId("employment", original.employmentId),
          organizationUnitId: restoreWorkforceId("organization_unit", original.organizationUnitId),
          responsibilityType: restoreOrgResponsibilityType(original.responsibilityType),
          startsOn: resource.effectiveFrom,
          endsOn: resource.effectiveTo,
          isVoid: original.isVoid === 1,
          recordedByActionId: restoreWorkforceId(
            "personnel_action",
            companyOperationId(`responsibility-adoption:${this.props.snapshotDigest}`),
          ),
          recordedAt: this.props.recordedAt,
        },
      })
    }
    return this.connectExisting(responsibilities, snapshot)
  }

  private connectExisting(
    responsibilities: ReadonlyArray<AdoptedResponsibility>,
    snapshot: ResponsibilityResourceAdoptionSnapshotValue,
  ): ReadonlyArray<AdoptedResponsibility> | Error {
    const groups = new Map<string, AdoptedResponsibility[]>()
    const connected: AdoptedResponsibility[] = []
    for (const entry of responsibilities) {
      const target = this.props.mappings.find(
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
    entries: ReadonlyArray<AdoptedResponsibility>,
    snapshot: ResponsibilityResourceAdoptionSnapshotValue,
  ): ReadonlyArray<AdoptedResponsibility> | Error {
    const first = entries[0]
    if (first === undefined)
      return new CompanyValidationError("接続対象がありません", "invalid_responsibility_connection")
    const history: CompanyResourceEntity[] = []
    for (const row of snapshot.props.value.publicResponsibilities.filter(
      (resource) => resource.resourceId === target,
    )) {
      if (row.bindingEmployeeId !== null)
        return new CompanyValidationError(
          "接続先は既に期間台帳へ接続されています",
          "invalid_responsibility_connection",
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
          "公開責務の属性が不正です",
          "invalid_responsibility_connection",
        )
      const resource = CompanyResourceEntity.create({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        type: "responsibility-assignment",
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
    const responsibilityId = first.resource.readText("responsibilityId")
    const authorityScopeId = first.resource.readText("authorityScopeId")
    if (responsibilityId === null || authorityScopeId === null)
      return new CompanyValidationError(
        "接続先の定義がありません",
        "invalid_responsibility_connection",
      )
    const connection = ResponsibilityResourceConnectionValue.create({
      history,
      periods: entries.map((entry) => entry.period),
      source: {
        ...first.period,
        responsibilityId,
        authorityScopeId,
      },
    })
    if (connection instanceof Error) return connection
    if (
      entries.some(
        (entry) =>
          entry.resource.readText("responsibilityId") !==
            first.resource.readText("responsibilityId") ||
          entry.resource.readText("authorityScopeId") !==
            first.resource.readText("authorityScopeId"),
      )
    )
      return new CompanyValidationError(
        "同じ接続先への定義が一致しません",
        "invalid_responsibility_connection",
      )
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
        commandId: `responsibility-adoption:${this.props.snapshotDigest}:${changes.length}`,
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
