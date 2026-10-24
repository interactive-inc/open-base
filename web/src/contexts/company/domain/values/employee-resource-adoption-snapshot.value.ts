import { z } from "zod"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const text = z.string().nullable()
const period = z.object({
  periodId: z.string(),
  revision: z.number().int().positive(),
  employeeId: z.string(),
  startsOn: z.string(),
  endsOn: text,
  isVoid: z.number().int().min(0).max(1),
  recordedByActionId: z.string(),
  recordedAt: z.number().int(),
})
const publicResource = z.object({
  organizationId: z.string(),
  type: z.enum(["person", "employee", "employment"]),
  id: z.string(),
  revision: z.number().int().positive(),
  state: z.enum(["active", "void"]),
  effectiveFrom: z.string().date(),
  effectiveTo: z.string().date().nullable(),
  attributes: z.record(z.string(), z.string().nullable()),
})
const schema = z
  .object({
    organizationRevision: z.number().int().nonnegative().nullable(),
    employee: z
      .object({
        id: z.string(),
        officialName: text,
        employeeCode: text,
        email: text,
        phone: text,
        createdAt: z.number().int(),
        updatedAt: z.number().int(),
      })
      .readonly(),
    lifecycleRevision: z.number().int().nonnegative().nullable(),
    employments: z
      .array(
        z
          .object({
            id: z.string(),
            employeeId: z.string(),
            contractName: z.string(),
            employmentType: z.string(),
            hireDate: z.string(),
            terminationDate: text,
            status: z.string(),
            createdAt: z.number().int(),
            updatedAt: z.number().int(),
          })
          .readonly(),
      )
      .readonly(),
    employmentPeriods: z.array(period.readonly()).readonly(),
    statusPeriods: z
      .array(period.extend({ employmentPeriodId: z.string(), status: z.string() }).readonly())
      .readonly(),
    accounts: z
      .array(
        z
          .object({
            accountId: z.string(),
            displayName: text,
            createdAt: z.number().int().nullable(),
            updatedAt: z.number().int().nullable(),
          })
          .readonly(),
      )
      .readonly(),
    bindings: z
      .array(
        z
          .object({
            resourceType: z.string(),
            resourceId: z.string(),
            organizationId: z.string(),
            resourceRevision: z.number().int(),
            lifecycleRevision: z.number().int(),
            lastActionId: text,
          })
          .readonly(),
      )
      .readonly(),
    publicResources: z
      .array(
        publicResource.extend({
          organizationRevision: z.number().int().positive(),
          commandId: z.string(),
          actorAccountId: z.string(),
          reason: z.string(),
          recordedAt: z.number().int(),
        }),
      )
      .readonly(),
    publicHeads: z.array(publicResource).readonly(),
  })
  .readonly()
export type EmployeeResourceAdoptionSnapshot = z.infer<typeof schema>
type Props = Readonly<{
  value: EmployeeResourceAdoptionSnapshot
  digest: string
  sourceJson: string
}>

/** 移行対象の人物・雇用・期間履歴を、保存直前にも照合できる形で固定する。 */
export class EmployeeResourceAdoptionSnapshotValue {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }

  static async create(sourceJson: string): Promise<EmployeeResourceAdoptionSnapshotValue | Error> {
    try {
      if (new TextEncoder().encode(sourceJson).length > 750_000)
        return new Error("workforce adoption snapshot is too large")
      const parsed = schema.safeParse(JSON.parse(sourceJson))
      if (!parsed.success) return parsed.error
      const canonical = CanonicalSystemJsonValue.create(parsed.data)
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      return new EmployeeResourceAdoptionSnapshotValue(
        Object.freeze({ value: parsed.data, digest: digest.toString(), sourceJson }),
      )
    } catch (cause) {
      return new Error("invalid workforce adoption snapshot", { cause })
    }
  }
}
