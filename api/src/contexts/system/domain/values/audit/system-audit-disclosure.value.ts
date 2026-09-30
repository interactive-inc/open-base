import { type SystemAuditDisclosurePolicyEntity } from "@system/domain/entities/system-audit-disclosure-policy.entity"
import { auditDisclosureFieldSchema } from "@system/domain/schemas/audit/system-audit-disclosure-policy.schema"
import { SystemAuditDisclosureError } from "@system/domain/errors"
import type { z } from "zod"

type Field = z.output<typeof auditDisclosureFieldSchema>
type Props = Readonly<{ fields: ReadonlyArray<Field>; targetTypes: ReadonlyArray<string> | null }>

/** 全体とAccountの開示条件を共に満たす項目・対象だけを公開する。 */
export class SystemAuditDisclosureValue {
  readonly fields: ReadonlyArray<Field>
  readonly targetTypes: ReadonlyArray<string> | null

  private constructor(props: Props) {
    this.fields = Object.freeze([...props.fields])
    this.targetTypes = props.targetTypes === null ? null : Object.freeze([...props.targetTypes])
    Object.freeze(this)
  }

  static evaluate(
    input: Readonly<{
      policies: ReadonlyArray<SystemAuditDisclosurePolicyEntity>
      accountId: string
      purpose: string | null
      at: Date
    }>,
  ): SystemAuditDisclosureValue | SystemAuditDisclosureError {
    if (!Number.isSafeInteger(input.at.getTime()) || input.at.getTime() < 0)
      return new SystemAuditDisclosureError("invalid")
    let fields: ReadonlyArray<Field> = auditDisclosureFieldSchema.options
    let targetTypes: ReadonlyArray<string> | null = null
    const scopes = new Set<string>()
    for (const policy of input.policies) {
      const rule = policy.snapshot
      if ((rule.scope !== "*" && rule.scope !== input.accountId) || scopes.has(rule.scope))
        return new SystemAuditDisclosureError("unavailable")
      scopes.add(rule.scope)
      if (Date.parse(rule.recordedAt) > input.at.getTime())
        return new SystemAuditDisclosureError("forbidden")
      if (!rule.enabled) continue
      if (
        (rule.expiresAt !== null && input.at.getTime() >= Date.parse(rule.expiresAt)) ||
        (rule.allowedPurposes !== null &&
          (input.purpose === null || !rule.allowedPurposes.includes(input.purpose)))
      )
        return new SystemAuditDisclosureError("forbidden")
      fields = fields.filter((field) => rule.allowedFields.includes(field))
      if (rule.allowedTargetTypes !== null)
        targetTypes =
          targetTypes === null
            ? rule.allowedTargetTypes
            : targetTypes.filter((target) => rule.allowedTargetTypes?.includes(target))
    }
    return new SystemAuditDisclosureValue({ fields, targetTypes })
  }
}
