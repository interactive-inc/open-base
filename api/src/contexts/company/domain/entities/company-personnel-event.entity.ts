import { personnelActionKindSchema } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import { personnelActionSummarySchema } from "@/contexts/company/domain/definitions/personnel-action-summary.definition"
import { nextCalendarDate } from "@/contexts/company/domain/definitions/next-calendar-date.definition"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import { z } from "zod"

const schema = z
  .object({
    sequence: z.number().int().positive(),
    id: z.string().min(1).max(255),
    employeeId: z.string().min(1).max(255),
    kind: personnelActionKindSchema,
    eventOn: z.string().date(),
    recordedAt: z.number().int().nonnegative(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    correctsActionId: z.string().nullable(),
    correctedByActionId: z.string().nullable(),
    summary: personnelActionSummarySchema,
  })
  .readonly()

type Props = z.infer<typeof schema>
export type CompanyEmploymentEffect = Readonly<{
  kind: "hire" | "rehire" | "retired"
  eventOn: string
  effectiveOn: string
}>

/** 記録時点・発効日・訂正元を区別した、追記済み人事発令。 */
export class CompanyPersonnelEventEntity {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }

  static create(input: unknown): CompanyPersonnelEventEntity | CompanyValidationError {
    const parsed = schema.safeParse(input)
    if (!parsed.success)
      return new CompanyValidationError(
        "人事発令の形式が不正です",
        "personnel_action_invalid_transition",
        { cause: parsed.error },
      )
    const value = parsed.data
    if (
      value.kind !== value.summary.kind ||
      value.eventOn !== value.summary.eventOn ||
      (value.summary.kind === "corrected" &&
        value.correctsActionId !== value.summary.correctsActionId)
    ) {
      return new CompanyValidationError(
        "人事発令の記録と要約が一致しません",
        "personnel_action_invalid_transition",
      )
    }
    Object.freeze(value.summary)
    return new CompanyPersonnelEventEntity(value)
  }

  employmentEffect(): CompanyEmploymentEffect | null | CompanyValidationError {
    const summary = this.props.summary
    const kind = summary.kind === "corrected" ? summary.replacementKind : summary.kind
    if (kind !== "hire" && kind !== "rehire" && kind !== "retired") return null
    const eventOn = summary.kind === "corrected" ? summary.replacementEventOn : summary.eventOn
    if (eventOn === undefined)
      return new CompanyValidationError(
        "訂正後の発効日が記録されていません",
        "personnel_action_invalid_transition",
      )
    if (kind !== "retired") return { kind, eventOn, effectiveOn: eventOn }
    const effectiveOn = nextCalendarDate(eventOn)
    if (effectiveOn instanceof Error)
      return new CompanyValidationError(
        "退職日の翌日を解決できません",
        "personnel_action_invalid_transition",
        { cause: effectiveOn },
      )
    return { kind, eventOn, effectiveOn }
  }
}
