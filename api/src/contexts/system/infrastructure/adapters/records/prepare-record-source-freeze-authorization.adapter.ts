import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"

type Context = SystemD1Context
const stepUpSql = `WITH evaluation AS (
  SELECT max(?3, CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) AS at
) SELECT EXISTS (
  SELECT 1 FROM system_step_up_grants WHERE account_id=?1 AND token_hash=?2
    AND issued_at <= (SELECT at FROM evaluation) AND expires_at > (SELECT at FROM evaluation)
    AND revoked_at IS NULL AND last_used_at IS NOT NULL AND last_used_at <= (SELECT at FROM evaluation)
) AS accepted`

/** 書込み停止の技術権限を人の現在の認証へ束縛し、再認証もDB確定時に再検査する。 */
export class PrepareRecordSourceFreezeAuthorizationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      authentication: SystemReadAuthentication
      now: Date
      stepUpToken: string | null
    }>,
  ): Promise<
    | Readonly<{ actorAccountId: string; assertions: ReadonlyArray<D1PreparedStatement> }>
    | "forbidden"
    | Error
  > {
    const authentication = input.authentication
    if (authentication.machineCredentialId !== null) return "forbidden"
    const bearer = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      authentication,
      input.now,
    )
    if (bearer instanceof Error) return bearer
    if (bearer === null || !bearer.permissionKeys.has("system:admin")) return "forbidden"
    const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: authentication.accountId,
      tokenVersion: authentication.tokenVersion,
      permissions: ["system:admin"],
      now: input.now,
    })
    if (human instanceof Error || human === "forbidden") return human
    const credentialGuards = bearer.assertions(input.now)
    if (credentialGuards instanceof Error) return "forbidden"
    const assertions = [...credentialGuards, ...human.assertions]
    if (input.stepUpToken !== null) {
      if (!/^[0-9a-f]{64}$/.test(input.stepUpToken)) return "forbidden"
      const hash = await new SystemPrincipalSecretService().hashRawSecret(input.stepUpToken)
      if (hash instanceof Error) return hash
      try {
        const parameters = [authentication.accountId, hash, input.now.getTime()]
        const accepted = await this.c.env.DB.prepare(stepUpSql)
          .bind(...parameters)
          .first<number>("accepted")
        if (accepted !== 1) return "forbidden"
        assertions.push(
          this.c.env.DB.prepare(`SELECT CASE WHEN (${stepUpSql})=1 THEN 1
          ELSE json_extract('{}','record_source_freeze_authorization_changed') END`).bind(
            ...parameters,
          ),
        )
      } catch (cause) {
        return new Error("record source freeze authorization unavailable", { cause })
      }
    }
    return { actorAccountId: authentication.accountId, assertions }
  }
}
