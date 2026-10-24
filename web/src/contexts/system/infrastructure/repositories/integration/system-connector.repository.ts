import type { SystemD1Context } from "@system/configuration/system-context"
import { SystemConnectorEntity } from "@system/domain/entities/system-connector.entity"

export type SystemConnectorWriteResult =
  | Readonly<{ kind: "created"; connector: SystemConnectorEntity }>
  | Readonly<{ kind: "replayed"; connector: SystemConnectorEntity }>
  | Readonly<{ kind: "conflict" }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

type ConnectorRow = Readonly<Record<string, unknown>>
type Context = SystemD1Context

/** Connector定義のD1永続化。 */
export class SystemConnectorRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findMany(): Promise<ReadonlyArray<SystemConnectorEntity> | Error> {
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT id, key, name, direction, transport, status, revision, created_at, updated_at
         FROM system_connectors ORDER BY key`,
      ).all<ConnectorRow>()
      const connectors: SystemConnectorEntity[] = []
      for (const row of rows.results) {
        const connector = toConnector(row)
        if (connector instanceof Error) return connector
        connectors.push(connector)
      }
      return Object.freeze(connectors)
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to find System Connectors")
    }
  }

  async write(
    connector: SystemConnectorEntity,
    auditStatements: ReadonlyArray<D1PreparedStatement> = [],
  ): Promise<SystemConnectorWriteResult> {
    try {
      const statements = [
        this.c.env.DB.prepare(
          `INSERT INTO system_connectors
             (id, key, name, direction, transport, status, revision, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
        ).bind(
          connector.id,
          connector.key,
          connector.name,
          connector.direction,
          connector.transport,
          connector.status,
          connector.revision,
          connector.createdAt.getTime(),
          connector.updatedAt.getTime(),
        ),
        ...auditStatements,
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return { kind: "unavailable", cause: new Error("connector creation batch failed") }
      }
      return { kind: "created", connector }
    } catch (cause) {
      const existing = await this.findByKey(connector.key)
      if (existing instanceof Error) return { kind: "unavailable", cause }
      if (existing === null) return { kind: "unavailable", cause }
      return sameConnector(existing, connector)
        ? { kind: "replayed", connector: existing }
        : { kind: "conflict" }
    }
  }

  async find(id: string): Promise<SystemConnectorEntity | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT id, key, name, direction, transport, status, revision, created_at, updated_at
         FROM system_connectors WHERE id = ?1 LIMIT 1`,
      )
        .bind(id)
        .first<ConnectorRow>()
      return row === null ? null : toConnector(row)
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to find System Connector")
    }
  }

  async update(
    connector: SystemConnectorEntity,
    expectedRevision: number,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<"updated" | "conflict" | "not_found" | Error> {
    const current = await this.find(connector.id)
    if (current === null) return "not_found"
    if (current instanceof Error) return current
    if (current.revision !== expectedRevision) return "conflict"
    try {
      const statements = [
        this.c.env.DB.prepare(
          `UPDATE system_connectors
           SET name = ?2, status = ?3, revision = ?4, updated_at = ?5
           WHERE id = ?1 AND revision = ?6`,
        ).bind(
          connector.id,
          connector.name,
          connector.status,
          connector.revision,
          connector.updatedAt.getTime(),
          expectedRevision,
        ),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE abs(-9223372036854775808) END AS ok",
        ),
        ...auditStatements,
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("connector update batch failed")
      }
      return "updated"
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("integer overflow")) return "conflict"
      return caught instanceof Error ? caught : new Error("failed to update System Connector")
    }
  }

  private async findByKey(key: string): Promise<SystemConnectorEntity | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT id, key, name, direction, transport, status, revision, created_at, updated_at
         FROM system_connectors WHERE key = ?1 LIMIT 1`,
      )
        .bind(key)
        .first<ConnectorRow>()
      return row === null ? null : toConnector(row)
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to find System Connector")
    }
  }
}

function toConnector(row: ConnectorRow): SystemConnectorEntity | Error {
  return SystemConnectorEntity.create({
    id: row.id,
    key: row.key,
    name: row.name,
    direction: row.direction,
    transport: row.transport,
    status: row.status,
    revision: row.revision,
    createdAt: typeof row.created_at === "number" ? new Date(row.created_at) : row.created_at,
    updatedAt: typeof row.updated_at === "number" ? new Date(row.updated_at) : row.updated_at,
  })
}

function sameConnector(left: SystemConnectorEntity, right: SystemConnectorEntity): boolean {
  return (
    left.id === right.id &&
    left.key === right.key &&
    left.name === right.name &&
    left.direction === right.direction &&
    left.transport === right.transport &&
    left.status === right.status &&
    left.revision === right.revision
  )
}
