import { z } from "zod"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const schema = z
  .object({
    organizationRevision: z.number().int().nonnegative(),
    definition: z
      .object({
        type: z.enum(["grade", "position"]),
        id: z.number().int().positive(),
        code: z.string().min(1).max(64),
        name: z.string().min(1).max(200),
        rank: z.number().int(),
        description: z.string().max(2_000).nullable(),
        createdAt: z.string().datetime(),
      })
      .strict()
      .readonly(),
  })
  .strict()
  .readonly()

export type DefinitionResourceAdoptionSnapshot = z.infer<typeof schema>
type Props = Readonly<{
  value: DefinitionResourceAdoptionSnapshot
  digest: string
  sourceJson: string
}>

/** 上書き型の旧定義を、作成日時も含む確認時点の証跡として固定する。 */
export class DefinitionResourceAdoptionSnapshotValue {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }

  static async create(
    sourceJson: string,
  ): Promise<DefinitionResourceAdoptionSnapshotValue | Error> {
    try {
      if (new TextEncoder().encode(sourceJson).length > 20_000)
        return new Error("definition adoption snapshot is too large")
      const parsed = schema.safeParse(JSON.parse(sourceJson))
      if (!parsed.success) return parsed.error
      const canonical = CanonicalSystemJsonValue.create(parsed.data)
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      return new DefinitionResourceAdoptionSnapshotValue(
        Object.freeze({ value: parsed.data, digest: digest.toString(), sourceJson }),
      )
    } catch (cause) {
      return new Error("invalid definition adoption snapshot", { cause })
    }
  }
}
