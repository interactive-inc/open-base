import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { systemWorkItemRevisions } from "@system/infrastructure/schema/system-work-item"

test("work revision declarations match the indexes and unique constraint in canonical SQL", () => {
  const database = new Database(":memory:")

  try {
    database.exec(readFileSync(new URL("./system-work-item.sql", import.meta.url), "utf8"))
    const definition = getTableConfig(systemWorkItemRevisions)
    const indexes = database
      .query<{ name: string; unique: number; origin: string }, []>(
        "PRAGMA index_list(system_work_item_revisions)",
      )
      .all()

    for (const declared of definition.indexes) {
      expect(indexes.map((index) => index.name)).toContain(declared.config.name)
    }

    const revisionColumns = ["work_item_id", "revision"]
    expect(
      definition.uniqueConstraints.map((constraint) =>
        constraint.columns.map((column) => column.name),
      ),
    ).toContainEqual(revisionColumns)
    const uniqueColumns = indexes
      .filter((index) => index.unique === 1 && index.origin === "u")
      .map((index) =>
        database
          .query<{ name: string }, [string]>("SELECT name FROM pragma_index_info(?) ORDER BY seqno")
          .all(index.name)
          .map((column) => column.name),
      )
    expect(uniqueColumns).toContainEqual(revisionColumns)
  } finally {
    database.close()
  }
})
