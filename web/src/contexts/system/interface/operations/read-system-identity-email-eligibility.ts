import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"

/** provider主体に対応するIdentityのメール受信可否を読む。profile不在時はnull。 */
export async function readSystemIdentityEmailEligibility(
  database: D1Database,
  input: Readonly<{ provider: string; subject: string }>,
): Promise<boolean | null | Error> {
  const subject = identitySubjectSchema.safeParse(input.subject)
  if (input.provider.length < 1 || input.provider.length > 100 || !subject.success) {
    return new Error("Invalid System Identity subject")
  }
  try {
    const row = await database
      .prepare(
        `SELECT profile.can_receive_email
         FROM system_identity_bindings AS identity
         LEFT JOIN system_identity_profiles AS profile ON profile.identity_id = identity.id
         WHERE identity.provider = ?1 AND identity.subject = ?2 LIMIT 1`,
      )
      .bind(input.provider, subject.data)
      .first<{ can_receive_email: number | null }>()
    if (row === null || row.can_receive_email === null) return null
    if (row.can_receive_email !== 0 && row.can_receive_email !== 1) {
      return new Error("Invalid System Identity email eligibility")
    }
    return row.can_receive_email === 1
  } catch (cause) {
    return cause instanceof Error
      ? cause
      : new Error("System Identity email eligibility lookup failed")
  }
}
