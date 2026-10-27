/** 同一provider・subjectのIdentityが既に存在するかを確認する。失効済みも重複として扱う。 */
export async function hasSystemIdentitySubject(
  database: D1Database,
  input: Readonly<{ provider: string; subject: string }>,
): Promise<boolean | Error> {
  if (
    input.provider.length < 1 ||
    input.provider.length > 100 ||
    input.subject.length < 1 ||
    input.subject.length > 320
  ) {
    return new Error("Invalid System Identity subject")
  }
  try {
    const row = await database
      .prepare(
        `SELECT 1 AS found FROM system_identity_bindings
         WHERE provider = ?1 AND subject = ?2 LIMIT 1`,
      )
      .bind(input.provider, input.subject)
      .first<{ found: number }>()
    return row !== null
  } catch (cause) {
    return cause instanceof Error ? cause : new Error("System Identity lookup failed")
  }
}
