import type { SystemD1Context } from "@system/configuration/system-context"
import { SystemPrincipalEntity } from "@system/domain/entities/system-principal.entity"

type PrincipalRow = Readonly<{
  id: string
  account_id: string
  kind: unknown
  name: string
  connector_id: string | null
  revision: number
  created_at: number
  updated_at: number
}>

type Context = SystemD1Context

export type FindSystemPrincipalProps =
  | Readonly<{ principalId: string; accountId?: never }>
  | Readonly<{ principalId?: never; accountId: string }>

/** Accountと分離したSystem Principalの分類・名称・Connector対応を保存する。 */
export class SystemPrincipalRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findMany(
    query?: Readonly<{ accountIds: ReadonlyArray<string> }>,
  ): Promise<ReadonlyArray<SystemPrincipalEntity> | Error> {
    if (query?.accountIds.length === 0) return []
    try {
      const result = await this.c.env.DB.prepare(
        `SELECT id, account_id, kind, name, connector_id, revision, created_at, updated_at
         FROM system_principals
         ${query === undefined ? "" : "WHERE account_id IN (SELECT value FROM json_each(?1))"}
         ORDER BY kind, id`,
      )
        .bind(...(query === undefined ? [] : [JSON.stringify([...new Set(query.accountIds)])]))
        .all<PrincipalRow>()
      if (!result.success) return new Error("failed to list System Principals")

      const principals: Array<SystemPrincipalEntity> = []
      for (const row of result.results) {
        const principal = this.restore(row)
        if (principal instanceof Error) return principal
        principals.push(principal)
      }
      return Object.freeze(principals)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to list System Principals")
    }
  }

  async find(props: FindSystemPrincipalProps): Promise<SystemPrincipalEntity | null | Error> {
    try {
      const row =
        props.principalId !== undefined
          ? await this.c.env.DB.prepare(
              `SELECT id, account_id, kind, name, connector_id, revision, created_at, updated_at
         FROM system_principals
         WHERE id = ?1
         LIMIT 1`,
            )
              .bind(props.principalId)
              .first<PrincipalRow>()
          : await this.c.env.DB.prepare(
              `SELECT id, account_id, kind, name, connector_id, revision, created_at, updated_at
         FROM system_principals
         WHERE account_id = ?1
         LIMIT 1`,
            )
              .bind(props.accountId)
              .first<PrincipalRow>()

      return row === null ? null : this.restore(row)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read System Principal")
    }
  }

  async create(
    principal: SystemPrincipalEntity,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<"created" | "conflict" | Error> {
    try {
      const statements = [
        this.c.env.DB.prepare(
          `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
           VALUES (?1, 'active', 0, ?2, ?2)`,
        ).bind(principal.accountId, principal.createdAt.getTime()),
        this.c.env.DB.prepare(
          `INSERT INTO system_principals
             (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
           WHERE ?3 <> 'human'
             AND (?3 <> 'connector' OR EXISTS (
               SELECT 1 FROM system_connectors WHERE id = ?5 AND status = 'active'
             ))`,
        ).bind(
          principal.id,
          principal.accountId,
          principal.kind,
          principal.name,
          principal.connectorId,
          principal.revision,
          principal.createdAt.getTime(),
          principal.updatedAt.getTime(),
        ),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE abs(-9223372036854775808) END AS ok",
        ),
        ...auditStatements,
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("System Principal creation batch did not succeed")
      }
      return "created"
    } catch (caught) {
      if (caught instanceof Error && caught.message.toLowerCase().includes("unique")) {
        return "conflict"
      }
      return caught instanceof Error ? caught : new Error("failed to create System Principal")
    }
  }

  async update(
    principal: SystemPrincipalEntity,
    expectedRevision: number,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<"updated" | "conflict" | "not_found" | Error> {
    const current = await this.find({ principalId: principal.id })
    if (current === null) return "not_found"
    if (current instanceof Error) return current
    if (current.revision !== expectedRevision) return "conflict"

    try {
      const statements = [
        this.c.env.DB.prepare(
          `UPDATE system_principals
           SET name = ?2, revision = ?3, updated_at = ?4
           WHERE id = ?1 AND revision = ?5`,
        ).bind(
          principal.id,
          principal.name,
          principal.revision,
          principal.updatedAt.getTime(),
          expectedRevision,
        ),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE abs(-9223372036854775808) END AS ok",
        ),
        ...auditStatements,
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("System Principal update batch did not succeed")
      }
      return "updated"
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("integer overflow")) return "conflict"
      return caught instanceof Error ? caught : new Error("failed to update System Principal")
    }
  }

  private restore(row: PrincipalRow): SystemPrincipalEntity | Error {
    return SystemPrincipalEntity.create({
      id: row.id,
      accountId: row.account_id,
      kind: row.kind,
      name: row.name,
      connectorId: row.connector_id,
      revision: row.revision,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    })
  }
}
