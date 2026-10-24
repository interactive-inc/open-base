import { z } from "zod"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const schema = z
  .object({
    employeeId: z.string(),
    organizationRevision: z.number().int().nonnegative(),
    lifecycleRevision: z.number().int().nonnegative(),
    pendingOperations: z.number().int().nonnegative(),
    employeeOrganizationId: z.string().nullable(),
    publicAssignments: z
      .array(
        z
          .object({
            resourceId: z.string(),
            revision: z.number().int().positive(),
            organizationRevision: z.number().int().positive(),
            state: z.enum(["active", "void"]),
            effectiveFrom: z.string().date(),
            effectiveTo: z.string().date().nullable(),
            attributesJson: z.string(),
            commandId: z.string(),
            actorAccountId: z.string(),
            reason: z.string(),
            recordedAt: z.number().int().nonnegative(),
            bindingEmployeeId: z.string().nullable(),
          })
          .readonly(),
      )
      .readonly(),
    periods: z
      .array(
        z
          .object({
            periodId: z.string(),
            revision: z.number().int().positive(),
            employeeId: z.string(),
            employmentId: z.string(),
            organizationUnitId: z.string(),
            assignmentType: z.enum(["PRIMARY", "CONCURRENT"]),
            positionTitle: z.string().nullable(),
            managerEmployeeId: z.string().nullable(),
            startsOn: z.string().date(),
            endsOn: z.string().date().nullable(),
            isVoid: z.number().int().min(0).max(1),
            recordedByActionId: z.string(),
            recordedAt: z.number().int().nonnegative(),
            actorAccountId: z.string().nullable(),
            reason: z.string().nullable(),
            evidenceReferencesJson: z.string().nullable(),
            requestFingerprint: z.string().nullable(),
            operationStatus: z.string().nullable(),
            resourceId: z.string().nullable(),
            periodRevision: z.number().int().positive().nullable(),
          })
          .readonly(),
      )
      .readonly(),
  })
  .readonly()
export type AssignmentResourceAdoptionSnapshot = z.infer<typeof schema>
type Props = Readonly<{
  value: AssignmentResourceAdoptionSnapshot
  digest: string
  sourceJson: string
}>

/** 所属の元の全改訂と指揮命令、変更主体、接続状況を確認対象として固定する。 */
export class AssignmentResourceAdoptionSnapshotValue {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }

  static async create(
    sourceJson: string,
  ): Promise<AssignmentResourceAdoptionSnapshotValue | Error> {
    try {
      if (new TextEncoder().encode(sourceJson).length > 750_000)
        return new Error("assignment adoption snapshot is too large")
      const parsed = schema.safeParse(JSON.parse(sourceJson))
      if (!parsed.success) return parsed.error
      const canonical = CanonicalSystemJsonValue.create(parsed.data)
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      return new AssignmentResourceAdoptionSnapshotValue(
        Object.freeze({ value: parsed.data, digest: digest.toString(), sourceJson }),
      )
    } catch (cause) {
      return new Error("invalid assignment adoption snapshot", { cause })
    }
  }
}
