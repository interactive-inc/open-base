import { z } from "zod"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const sqliteIntegerSchema = z.union([
  z.number().int(),
  z
    .string()
    .regex(/^(?:0|[1-9][0-9]{0,18}|-[1-9][0-9]{0,18})$/)
    .refine(
      (value) => BigInt(value) >= -9223372036854775808n && BigInt(value) <= 9223372036854775807n,
    ),
])

const definitionSchema = z
  .strictObject({
    id: sqliteIntegerSchema,
    code: z.string(),
    name: z.string(),
    rank: sqliteIntegerSchema,
    description: z.string().nullable(),
    createdAt: z.string(),
  })
  .readonly()

const schema = z
  .strictObject({
    organizationRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    employeeId: z.string().min(1).max(128),
    awards: z
      .array(
        z
          .strictObject({
            id: sqliteIntegerSchema,
            employeeId: z.string().min(1).max(128),
            gradeId: sqliteIntegerSchema,
            effectiveDate: z.string(),
            reason: z.string().nullable(),
            createdAt: z.string(),
            observedDefinition: definitionSchema.nullable(),
          })
          .readonly(),
      )
      .max(1000)
      .readonly(),
  })
  .readonly()

type Props = Readonly<{ value: z.infer<typeof schema>; digest: string; sourceJson: string }>

/** 等級付与の元の列を保全し、確認時の定義を過去の名称・雇用期間として扱わない。 */
export class GradeAwardSourceSnapshotValue {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }

  static async create(sourceJson: string): Promise<GradeAwardSourceSnapshotValue | Error> {
    try {
      if (new TextEncoder().encode(sourceJson).length > 2_000_000)
        return new Error("grade award snapshot is too large")
      const parsed = schema.safeParse(JSON.parse(sourceJson))
      if (!parsed.success) return parsed.error
      const ids = new Set<string>()
      for (const award of parsed.data.awards) {
        if (
          award.employeeId !== parsed.data.employeeId ||
          ids.has(String(award.id)) ||
          (award.observedDefinition !== null &&
            String(award.observedDefinition.id) !== String(award.gradeId))
        ) {
          return new Error("grade award source correspondence is invalid")
        }
        ids.add(String(award.id))
      }
      const canonical = CanonicalSystemJsonValue.create(parsed.data)
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      return new GradeAwardSourceSnapshotValue(
        Object.freeze({ value: parsed.data, digest: digest.toString(), sourceJson }),
      )
    } catch (cause) {
      return new Error("invalid grade award source snapshot", { cause })
    }
  }
}
