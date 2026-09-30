import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"
import { companyOperationId } from "@/contexts/company/domain/definitions/company-operation-id.definition"
import { z } from "zod"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyConflictError, CompanyValidationError } from "@/contexts/company/domain/errors"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type { OrganizationResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/organization-resource-adoption-snapshot.value"
import {
  COMPANY_DEFAULT_ORGANIZATION_ID,
  COMPANY_ROOT_ORGANIZATION_UNIT_ID,
} from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const schema = z
  .object({
    commandId: z.string().regex(/^\S{1,200}$/),
    organizationUnitId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
    expectedRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 100),
    snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
    observedOn: z.string().date(),
    reason: z.string().trim().min(1).max(1000),
    actorAccountId: z.string().regex(/^\S{1,255}$/),
    recordedAt: z.number().int().nonnegative(),
    initializationConfirmation: z
      .object({
        startsOn: z.string().date(),
        evidenceReferences: z
          .array(
            z.object({
              context: z.string().trim().min(1).max(100),
              kind: z.string().trim().min(1).max(100),
              id: z.string().trim().min(1).max(512),
              version: z.string().trim().min(1).max(255),
            }),
          )
          .min(1)
          .max(20),
      })
      .optional(),
  })
  .readonly()
type Props = z.infer<typeof schema>
export type OrganizationResourceAdoptionInput = Omit<Props, "actorAccountId" | "recordedAt">

/** 確認した既存の組織履歴を、元の期間IDと訂正版を保って公開正本へ接続する。 */
export class OrganizationResourceAdoptionEntity {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }
  static create(props: Props): OrganizationResourceAdoptionEntity | CompanyValidationError {
    const parsed = schema.safeParse(props)
    if (!parsed.success)
      return new CompanyValidationError(
        "組織の接続内容が不正です",
        "invalid_organization_adoption",
        { cause: parsed.error },
      )
    return new OrganizationResourceAdoptionEntity(parsed.data)
  }
  toChanges(
    snapshot: OrganizationResourceAdoptionSnapshotValue,
  ): ReadonlyArray<CompanyResourceChangeEntity> | CompanyConflictError | CompanyValidationError {
    const source = snapshot.props.value
    if (
      source.organizationUnit.id !== this.props.organizationUnitId ||
      snapshot.props.digest !== this.props.snapshotDigest ||
      (source.organizationRevision ?? 0) !== this.props.expectedRevision ||
      source.bindingOrganizationId !== null ||
      source.pendingOperations !== 0
    )
      return new CompanyConflictError(
        "移行対象が変更されています。再確認してください",
        "organization_resource_adoption_conflict",
      )
    if (source.periods.length === 0 || source.periods.length > 100)
      return new CompanyValidationError(
        "移行する期間履歴は1件から100件で指定してください",
        "invalid_organization_adoption",
      )
    const revisions = new Map<string, number>()
    const changes: CompanyResourceChangeEntity[] = []
    for (const period of source.periods) {
      if (
        (period.recordedByActionId === companyOperationId("initialization:organization:default") ||
          period.recordedByActionId === companyOperationId("initialization:company:root")) &&
        period.actorAccountId === "system:initialization" &&
        period.recordedAt === 0
      ) {
        const confirmation = this.props.initializationConfirmation
        if (confirmation === undefined)
          return new CompanyValidationError(
            "初期データの仮期間は組織の確定履歴へ接続できません",
            "organization_history_confirmation_required",
          )
        if (
          source.periods.length !== 1 ||
          source.organizationUnit.id !== COMPANY_ROOT_ORGANIZATION_UNIT_ID ||
          source.organizationUnit.createdAt !== 0 ||
          period.organizationUnitId !== source.organizationUnit.id ||
          period.periodId !== deterministicCompanyId("initial-period", "company:root:initial") ||
          period.startsOn !== "1970-01-01" ||
          period.parentOrganizationUnitId !== null ||
          period.kind !== "COMPANY" ||
          period.revision !== 1 ||
          period.isVoid !== 0 ||
          period.endsOn !== null ||
          confirmation.startsOn > this.props.observedOn
        )
          return new CompanyValidationError(
            "確認対象の初期履歴が変更されています",
            "invalid_organization_adoption",
          )
        const resource: CompanyResourceProps = {
          organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
          type: "organization-unit",
          id: period.periodId,
          revision: 1,
          state: "void",
          effectiveFrom: restoreCalendarDate(period.startsOn),
          effectiveTo: null,
          attributes: {
            organizationUnitId: period.organizationUnitId,
            code: period.code,
            officialName: period.officialName,
            kind: period.kind,
            parentOrganizationUnitId: period.parentOrganizationUnitId,
          },
        }
        const change = CompanyResourceChangeEntity.createHistoryBatch({
          commandId: `org-adoption:${this.props.commandId}:0`,
          expectedRevision: this.props.expectedRevision,
          actorAccountId: this.props.actorAccountId,
          recordedAt: this.props.recordedAt,
          reason: this.props.reason,
          resources: [
            resource,
            {
              ...resource,
              revision: 2,
              state: "active",
              effectiveFrom: restoreCalendarDate(confirmation.startsOn),
            },
          ],
        })
        if (change instanceof Error)
          return new CompanyValidationError(
            "確認した組織期間が不正です",
            "invalid_organization_adoption",
            { cause: change },
          )
        return [change]
      }
      if (this.props.initializationConfirmation !== undefined)
        return new CompanyValidationError(
          "初期データ以外の期間を置き換えることはできません",
          "invalid_organization_adoption",
        )
      if (
        period.organizationUnitId !== source.organizationUnit.id ||
        period.revision !== (revisions.get(period.periodId) ?? 0) + 1
      )
        return new CompanyValidationError(
          "組織履歴に欠落または所有者の不一致があります",
          "invalid_organization_adoption",
        )
      revisions.set(period.periodId, period.revision)
      const change = CompanyResourceChangeEntity.create({
        commandId: `org-adoption:${this.props.commandId}:${changes.length}`,
        expectedRevision: this.props.expectedRevision + changes.length,
        actorAccountId: this.props.actorAccountId,
        recordedAt: this.props.recordedAt,
        reason: this.props.reason,
        resources: [
          {
            organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
            type: "organization-unit",
            id: period.periodId,
            revision: period.revision,
            state: period.isVoid === 1 ? "void" : "active",
            effectiveFrom: restoreCalendarDate(period.startsOn),
            effectiveTo: period.endsOn === null ? null : restoreCalendarDate(period.endsOn),
            attributes: {
              organizationUnitId: period.organizationUnitId,
              code: period.code,
              officialName: period.officialName,
              kind: period.kind,
              parentOrganizationUnitId: period.parentOrganizationUnitId,
            },
          },
        ],
      })
      if (change instanceof Error)
        return new CompanyValidationError("組織履歴が不正です", "invalid_organization_adoption", {
          cause: change,
        })
      changes.push(change)
    }
    return changes
  }
}
