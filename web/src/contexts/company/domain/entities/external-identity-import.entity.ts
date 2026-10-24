import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { iamRoleIdSchema } from "@system/domain/schemas/iam/iam-role.schema"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { z } from "zod"

const schema = z
  .object({
    commandId: z.string().regex(/^\S{1,200}$/),
    expectedRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 1),
    reason: z.string().trim().min(1).max(2_000),
    identities: z
      .array(
        z
          .object({
            subject: identitySubjectSchema,
            sourceRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
            email: z.email().max(254),
            name: z.string().trim().min(1).max(200),
            accountId: zAccountId.nullable(),
            initialRoleId: iamRoleIdSchema.nullable(),
            newEmployee: z
              .object({
                hireDate: z.string().refine((value): boolean => isCalendarDate(value)),
                employmentType: z.enum(["FULL_TIME", "PART_TIME"]),
              })
              .strict()
              .readonly()
              .nullable(),
          })
          .strict()
          .readonly(),
      )
      .min(1)
      .max(25)
      .readonly(),
  })
  .strict()
  .readonly()

export type ExternalIdentityImportInput = z.input<typeof schema>
export type ExternalIdentityImportItem = z.output<typeof schema>["identities"][number]

/** 外部の版を持つidentity同期。新しい雇用の開始日・区分は入力された事実だけを使う。 */
export class ExternalIdentityImportEntity {
  private constructor(readonly props: z.output<typeof schema>) {
    Object.freeze(this)
  }

  static create(input: unknown): ExternalIdentityImportEntity | Error {
    const parsed = schema.safeParse(input)
    if (!parsed.success)
      return new Error("invalid external identity import", { cause: parsed.error })
    if (
      new Set(parsed.data.identities.map((identity) => identity.subject)).size !==
      parsed.data.identities.length
    ) {
      return new Error("duplicate external identity subject")
    }
    const accountIds = parsed.data.identities.flatMap((identity) =>
      identity.accountId === null ? [] : [identity.accountId],
    )
    if (new Set(accountIds).size !== accountIds.length) return new Error("duplicate target Account")
    return new ExternalIdentityImportEntity(parsed.data)
  }

  async fingerprint(actorAccountId: string): Promise<string | Error> {
    const canonical = CanonicalSystemJsonValue.create({
      provider: "oidc",
      actorAccountId,
      ...this.props,
    })
    if (canonical instanceof Error) return canonical
    const digest = await ProposalDigestValue.create(canonical)
    return digest instanceof Error ? digest : digest.toString()
  }
}
