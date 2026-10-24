import { z } from "zod"
import { organizationProfileVersionSchema } from "@/contexts/company/domain/definitions/organization-profile-version.definition"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"

const schema = z
  .object({
    commandId: z.string().regex(/^\S{1,255}$/),
    actorAccountId: z.string().regex(/^\S{1,255}$/),
    name: z.string().trim().min(1).max(2000),
    representativeName: z.string().trim().min(1).max(2000),
    locale: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
    timeZone: z.string().regex(/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/),
    fiscalYearStartMonth: z.number().int().min(1).max(12),
    version: organizationProfileVersionSchema,
    reason: z.string().trim().min(1).max(2000),
    observedOn: z.string().date(),
    recordedAt: z.number().int().nonnegative(),
  })
  .readonly()
type Props = z.infer<typeof schema>
export type OrganizationProfileChangeInput = Omit<
  Props,
  "actorAccountId" | "observedOn" | "recordedAt"
>

/** 表示した版に対する会社情報の変更を、確認済みの宣言として固定する。 */
export class OrganizationProfileChangeEntity {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }
  static create(value: Props): OrganizationProfileChangeEntity | CompanyValidationError {
    const parsed = schema.safeParse(value)
    if (!parsed.success)
      return new CompanyValidationError(
        "会社情報の入力が不正です",
        "invalid_organization_profile",
        { cause: parsed.error },
      )
    const input = parsed.data
    if (
      (input.version.resourceId === null) !== (input.version.resourceRevision === 0) ||
      [input.name, input.representativeName, input.reason].some((text) => text.includes("\0"))
    )
      return new CompanyValidationError(
        "表示した会社情報の版を指定してください",
        "invalid_organization_profile",
      )
    try {
      new Intl.DateTimeFormat(input.locale, { timeZone: input.timeZone }).format(input.recordedAt)
    } catch (cause) {
      return new CompanyValidationError(
        "会社の言語またはtimezoneが不正です",
        "invalid_organization_profile",
        { cause },
      )
    }
    return new OrganizationProfileChangeEntity(input)
  }
  toResourceChange() {
    const input = this.props
    return CompanyResourceChangeEntity.create({
      commandId: input.commandId,
      actorAccountId: input.actorAccountId,
      expectedRevision: input.version.organizationRevision,
      reason: input.reason,
      recordedAt: input.recordedAt,
      resources: [
        {
          organizationId: input.version.organizationId,
          type: "company-profile",
          id: input.version.resourceId ?? "company-profile:default",
          revision: input.version.resourceRevision + 1,
          state: "active",
          effectiveFrom: restoreCalendarDate(input.version.effectiveOn),
          effectiveTo:
            input.version.effectiveTo === null
              ? null
              : restoreCalendarDate(input.version.effectiveTo),
          attributes: {
            displayName: input.name,
            representativeName: input.representativeName,
            locale: input.locale,
            timeZone: input.timeZone,
            fiscalYearStartMonth: input.fiscalYearStartMonth,
          },
        },
      ],
    })
  }
}
