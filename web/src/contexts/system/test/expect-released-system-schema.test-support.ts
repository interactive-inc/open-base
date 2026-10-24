import { expect } from "bun:test"
import { Database } from "bun:sqlite"

/** UUID の主キーへの作り直しで足した列と trigger。作成時の migration には無い。 */
const REBUILD_COLUMNS = new Set(["id", "legacy_id"])
const REBUILD_TRIGGER = /_(identity_update|legacy_id_insert)$/u

/**
 * 作成時に公開した migration と canonical DDL が、後の UUID の主キーへの作り直しを除いて同じ
 * table・列・index・trigger を作ることを確かめる。作り直した table は主キーの列と識別子を守る trigger
 * だけが変わり、旧来の主キーは一意な属性として残る。
 */
export function expectReleasedSystemSchema(
  props: Readonly<{
    released: ReadonlyArray<string>
    canonical: ReadonlyArray<string>
    rebuiltTables: ReadonlyArray<string>
  }>,
): void {
  const rebuilt = new Set(props.rebuiltTables)
  const released = new Database(":memory:")
  const canonical = new Database(":memory:")
  try {
    for (const sql of props.released) released.exec(sql)
    for (const sql of props.canonical) canonical.exec(sql)
    const shape = (database: Database) => {
      const tables = database
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .all()
        .map((table) => table.name)
      return {
        tables: Object.fromEntries(
          tables.map((table) => [
            table,
            database
              .query<
                {
                  name: string
                  type: string
                  notnull: number
                  dflt_value: string | null
                  pk: number
                },
                []
              >(`SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info('${table}')`)
              .all()
              .filter((column) => !(rebuilt.has(table) && REBUILD_COLUMNS.has(column.name)))
              .map((column) => (rebuilt.has(table) ? { ...column, pk: 0 } : column)),
          ]),
        ),
        objects: database
          .query<{ type: string; name: string; tbl_name: string; sql: string }, []>(
            "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type IN ('index', 'trigger') AND sql IS NOT NULL ORDER BY type, name",
          )
          .all()
          .filter((object) => !(object.type === "trigger" && REBUILD_TRIGGER.test(object.name))),
      }
    }
    expect(shape(canonical)).toEqual(shape(released))
    for (const table of rebuilt)
      expect(
        canonical
          .query<{ name: string }, [string]>(
            "SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ?1",
          )
          .all(table)
          .map((trigger) => trigger.name),
      ).toContain(`${table}_identity_update`)
  } finally {
    released.close()
    canonical.close()
  }
}
