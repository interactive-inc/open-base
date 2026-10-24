import { z } from "zod"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const schema = z
  .object({
    organizationRevision: z.number().int().nonnegative().nullable(),
    lifecycleRevision: z.number().int().nonnegative(),
    pendingOperations: z.number().int().nonnegative(),
    organizationUnit: z
      .object({ id: z.string(), createdAt: z.number().int().nonnegative() })
      .readonly(),
    bindingOrganizationId: z.string().nullable(),
    periods: z
      .array(
        z
          .object({
            periodId: z.string(),
            revision: z.number().int().positive(),
            organizationUnitId: z.string(),
            code: z.string(),
            officialName: z.string(),
            kind: z.enum(["COMPANY", "DIVISION", "DEPARTMENT", "TEAM", "OTHER"]),
            parentOrganizationUnitId: z.string().nullable(),
            startsOn: z.string().date(),
            endsOn: z.string().date().nullable(),
            isVoid: z.number().int().min(0).max(1),
            recordedByActionId: z.string(),
            recordedAt: z.number().int().nonnegative(),
            actorAccountId: z.string(),
            reason: z.string(),
            evidenceReferencesJson: z.string(),
            requestFingerprint: z.string(),
          })
          .readonly(),
      )
      .readonly(),
  })
  .readonly()
export type OrganizationResourceAdoptionSnapshot = z.infer<typeof schema>
type Props = Readonly<{
  value: OrganizationResourceAdoptionSnapshot
  digest: string
  sourceJson: string
}>

/** 組織の全期間・訂正と元の変更記録を、移行対象のsnapshotとして固定する。 */
export class OrganizationResourceAdoptionSnapshotValue {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }
  static async create(
    sourceJson: string,
  ): Promise<OrganizationResourceAdoptionSnapshotValue | Error> {
    try {
      if (new TextEncoder().encode(sourceJson).length > 750_000)
        return new Error("organization adoption snapshot is too large")
      const parsed = schema.safeParse(JSON.parse(sourceJson))
      if (!parsed.success) return parsed.error
      const canonical = CanonicalSystemJsonValue.create(parsed.data)
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      return new OrganizationResourceAdoptionSnapshotValue(
        Object.freeze({ value: parsed.data, digest: digest.toString(), sourceJson }),
      )
    } catch (cause) {
      return new Error("invalid organization adoption snapshot", { cause })
    }
  }
}
