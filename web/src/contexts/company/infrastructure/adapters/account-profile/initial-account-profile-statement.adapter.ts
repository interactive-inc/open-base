type Context = D1Database

/** Accountの発行と同じbatchへ入れる、会社上の表示名の初期保存のstatementを返す。 */
export class InitialAccountProfileStatementAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(
    input: Readonly<{ organizationId: string; accountId: string; displayName: string; at: number }>,
  ): D1PreparedStatement {
    return this.c
      .prepare(
        `INSERT INTO company_account_profiles
               (organization_id, account_id, display_name, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?4)`,
      )
      .bind(input.organizationId, input.accountId, input.displayName, input.at)
  }
}
