import type { SystemD1Context } from "@system/configuration/system-context"
type Context = SystemD1Context

/** CLI loginのbroker stateをhash不要のsingle-use値として短期間だけ保存する。 */
export class CreateSystemCliLoginStateAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async createSystemCliLoginState(
    input: Readonly<{
      state: string
      port: number
      cliState: string
      codeVerifier: string
      createdAt: Date
      expiresAt: Date
    }>,
  ): Promise<null | Error> {
    try {
      await this.c.env.DB.prepare(
        `INSERT INTO system_cli_login_states
         (state, port, cli_state, code_verifier, created_at, expires_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
        .bind(
          input.state,
          input.port,
          input.cliState,
          input.codeVerifier,
          input.createdAt.getTime(),
          input.expiresAt.getTime(),
        )
        .run()
      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to create System CLI login state")
    }
  }
}
