import type { SystemD1Context } from "@system/configuration/system-context"
import { SystemTotpCredentialEntity } from "@system/domain/entities/system-totp-credential.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

type Context = SystemD1Context

type CredentialRow = Readonly<{
  account_id: string
  secret_ciphertext: string
  status: string
  last_used_step: number | null
  recovery_code_hashes: string
  created_at: number
  updated_at: number
  enabled_at: number | null
}>

/**
 * 書き込みの種類。`update` は読んだ時点の `updatedAt` と状態のままの行だけを書き換え、
 * 並行するrequestが先に同じコードや復旧コードを使っていれば batch ごと取り消す。
 */
export type SystemTotpCredentialWrite =
  | Readonly<{ kind: "begin"; credential: SystemTotpCredentialEntity }>
  | Readonly<{
      kind: "update"
      previous: SystemTotpCredentialEntity
      credential: SystemTotpCredentialEntity
    }>
  | Readonly<{ kind: "delete"; previous: SystemTotpCredentialEntity }>

const COLUMNS = `account_id, secret_ciphertext, status, last_used_step, recovery_code_hashes,
  created_at, updated_at, enabled_at`

const ABORT_WHEN_NO_ROWS_CHANGED =
  "SELECT CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END"

/** 認証アプリの登録を読み書きする。書き込みは監査文と同じbatchで確定させる。 */
export class SystemTotpCredentialRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(accountId: AccountId): Promise<SystemTotpCredentialEntity | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT ${COLUMNS} FROM system_totp_credentials WHERE account_id = ?1`,
      )
        .bind(accountId)
        .first<CredentialRow>()

      return row === null ? null : toEntity(row)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read TOTP credential")
    }
  }

  /**
   * 登録を書き込む。条件に合う行が無ければ（有効な登録の上書き、並行する更新）`conflict` を返す。
   * `extraStatements` はログインの challenge の消費のように、同じbatchで確定させたい文である。
   */
  async write(
    write: SystemTotpCredentialWrite,
    extraStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<"written" | "conflict" | Error> {
    try {
      const statements = [...this.prepare(write), ...extraStatements]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("TOTP credential write batch did not succeed")
      }

      return "written"
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("malformed JSON")) return "conflict"

      return caught instanceof Error ? caught : new Error("failed to write TOTP credential")
    }
  }

  private prepare(write: SystemTotpCredentialWrite): ReadonlyArray<D1PreparedStatement> {
    const database = this.c.env.DB
    const guard = database.prepare(ABORT_WHEN_NO_ROWS_CHANGED)

    if (write.kind === "begin") {
      const credential = write.credential

      // 有効な登録は上書きしない。作りかけ（pending）の登録だけを新しい秘密鍵で作り直す。
      return [
        database
          .prepare(
            `INSERT INTO system_totp_credentials (${COLUMNS})
             SELECT ?1, ?2, 'pending', NULL, '[]', ?3, ?3, NULL
             WHERE EXISTS (
               SELECT 1 FROM system_accounts account
               WHERE account.id = ?1 AND account.status = 'active' AND account.closed_at IS NULL
             )
             ON CONFLICT (account_id) DO UPDATE SET
               secret_ciphertext = excluded.secret_ciphertext,
               last_used_step = NULL,
               recovery_code_hashes = '[]',
               created_at = excluded.created_at,
               updated_at = excluded.updated_at
             WHERE system_totp_credentials.status = 'pending'`,
          )
          .bind(credential.accountId, credential.secretCiphertext, credential.createdAt.getTime()),
        guard,
      ]
    }

    if (write.kind === "update") {
      const credential = write.credential

      return [
        database
          .prepare(
            `UPDATE system_totp_credentials
             SET status = ?3, last_used_step = ?4, recovery_code_hashes = ?5,
                 updated_at = ?6, enabled_at = ?7
             WHERE account_id = ?1 AND updated_at = ?2 AND status = ?8`,
          )
          .bind(
            credential.accountId,
            write.previous.updatedAt.getTime(),
            credential.status,
            credential.lastUsedStep,
            JSON.stringify(credential.recoveryCodeHashes),
            credential.updatedAt.getTime(),
            credential.enabledAt?.getTime() ?? null,
            write.previous.status,
          ),
        guard,
      ]
    }

    return [
      database
        .prepare(
          `DELETE FROM system_totp_credentials
           WHERE account_id = ?1 AND updated_at = ?2 AND status = ?3`,
        )
        .bind(write.previous.accountId, write.previous.updatedAt.getTime(), write.previous.status),
      guard,
      database
        .prepare("DELETE FROM system_totp_login_challenges WHERE account_id = ?1")
        .bind(write.previous.accountId),
    ]
  }
}

function toEntity(row: CredentialRow): SystemTotpCredentialEntity | Error {
  return SystemTotpCredentialEntity.create({
    accountId: row.account_id,
    secretCiphertext: row.secret_ciphertext,
    status: row.status,
    lastUsedStep: row.last_used_step,
    recoveryCodeHashes: parseHashes(row.recovery_code_hashes),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    enabledAt: row.enabled_at === null ? null : new Date(row.enabled_at),
  })
}

function parseHashes(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
