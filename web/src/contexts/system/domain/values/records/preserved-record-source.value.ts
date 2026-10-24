import { z } from "zod"

const sourceSchema = z
  .object({
    sourceNamespace: z.string().regex(/^\S{1,255}$/),
    ownerContext: z.string().regex(/^[a-z][a-z0-9-]{0,99}$/),
    recordKind: z.string().regex(/^[a-z][a-z0-9_.:-]{0,199}$/),
    formatId: z.string().regex(/^\S{1,255}$/),
    formatVersion: z.number().int().positive().safe(),
    recordId: z
      .string()
      .min(1)
      .max(1000)
      .refine((value) => value.trim().length > 0),
    sourceRevision: z.string().min(1).max(255).nullable(),
    sourceRecordedAt: z.string().datetime().nullable(),
    capturedAt: z.string().datetime(),
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()

type Props = z.output<typeof sourceSchema>

/** 元記録の識別と来歴を、保全時の取得情報から区別する。 */
export class PreservedRecordSourceValue {
  readonly props: Readonly<Props>

  private constructor(props: Props) {
    this.props = Object.freeze(props)
    Object.freeze(this)
  }

  static create(input: unknown): PreservedRecordSourceValue | Error {
    const parsed = sourceSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const source = parsed.data
    if (source.sourceRevision !== null && source.sourceRevision.trim().length === 0) {
      return new Error("source revision must be supplied or explicitly unavailable")
    }
    if (
      source.sourceRecordedAt !== null &&
      Date.parse(source.sourceRecordedAt) > Date.parse(source.capturedAt)
    ) {
      return new Error("source recorded time must not follow capture time")
    }
    return new PreservedRecordSourceValue(source)
  }

  matchesSource(other: PreservedRecordSourceValue): boolean {
    return (
      this.props.sourceNamespace === other.props.sourceNamespace &&
      this.props.ownerContext === other.props.ownerContext &&
      this.props.recordKind === other.props.recordKind &&
      this.props.formatId === other.props.formatId &&
      this.props.formatVersion === other.props.formatVersion &&
      this.props.recordId === other.props.recordId &&
      this.props.sourceRevision === other.props.sourceRevision &&
      this.props.sourceRecordedAt === other.props.sourceRecordedAt &&
      this.props.contentDigest === other.props.contentDigest
    )
  }
}
