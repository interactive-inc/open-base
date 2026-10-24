import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { PublishSystemProcedure } from "@system/application/workflow/publish-system-procedure"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { readFileSync } from "node:fs"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const schema = [
  readFileSync(new URL("../infrastructure/schema/system-core.sql", import.meta.url), "utf8"),
  readFileSync(new URL("../infrastructure/schema/system-workflow.sql", import.meta.url), "utf8"),
  readFileSync(
    new URL("../infrastructure/schema/system-decision-policy.sql", import.meta.url),
    "utf8",
  ),
  readFileSync(new URL("../infrastructure/schema/system-procedure.sql", import.meta.url), "utf8"),
].join("\n")

async function createFixture(): Promise<{
  database: D1Database
  repository: SystemD1ProcedureRepository
}> {
  const database = await createLocalD1Database({ schema })
  await database
    .prepare(
      `INSERT INTO system_accounts
         (id, status, token_version, created_at, updated_at)
       VALUES ('3ba00d8d-82f5-498d-b03a-bf4f72a88a4d', 'active', 0, 100, 100)`,
    )
    .run()

  return {
    database,
    repository: new SystemD1ProcedureRepository({ env: { DB: database } }),
  }
}

describe("System procedure application", () => {
  test("初版と次版を公開し、現在版だけを読む", async () => {
    const fixture = await createFixture()
    const publish = new PublishSystemProcedure(fixture.repository)
    const first = await publish.run({
      key: "change",
      expectedRevision: 0,
      title: "Change",
      category: "operation",
      description: null,
      inputSchema: { type: "object" },
      decisionPolicy: { steps: [] },
      completionOperationKey: null,
      createdByAccountId: zAccountId.parse("3ba00d8d-82f5-498d-b03a-bf4f72a88a4d"),
      createdAt: new Date(100),
    })
    const second = await publish.run({
      key: "change",
      expectedRevision: 1,
      title: "Change v2",
      category: "operation",
      description: "safe",
      inputSchema: { required: ["reason"], type: "object" },
      decisionPolicy: { steps: [{ key: "review" }] },
      completionOperationKey: "apply-change",
      createdByAccountId: zAccountId.parse("3ba00d8d-82f5-498d-b03a-bf4f72a88a4d"),
      createdAt: new Date(110),
    })

    expect(first).not.toBeInstanceOf(Error)
    expect(second).not.toBeInstanceOf(Error)
    expect(await fixture.repository.findNumber(procedureKeySchema.parse("change"))).toBe(1)
    const current = await fixture.repository.find(procedureKeySchema.parse("change"))
    expect(current).toMatchObject({ revision: 2, title: "Change v2" })
    expect(
      await fixture.database
        .prepare("SELECT count(*) AS count FROM system_procedure_definition_revisions")
        .first<number>("count"),
    ).toBe(2)
  })

  test("同じexpected revisionの並行公開は一方だけを受理する", async () => {
    const fixture = await createFixture()
    const publish = new PublishSystemProcedure(fixture.repository)
    const initial = await publish.run({
      key: "change",
      expectedRevision: 0,
      title: "Change",
      category: "operation",
      description: null,
      inputSchema: {},
      decisionPolicy: {},
      completionOperationKey: null,
      createdByAccountId: zAccountId.parse("3ba00d8d-82f5-498d-b03a-bf4f72a88a4d"),
      createdAt: new Date(100),
    })
    if (initial instanceof Error || initial === "revision_conflict") throw initial

    const results = await Promise.all([
      publish.run({
        key: "change",
        expectedRevision: 1,
        title: "Left",
        category: "operation",
        description: null,
        inputSchema: {},
        decisionPolicy: {},
        completionOperationKey: null,
        createdByAccountId: zAccountId.parse("3ba00d8d-82f5-498d-b03a-bf4f72a88a4d"),
        createdAt: new Date(110),
      }),
      publish.run({
        key: "change",
        expectedRevision: 1,
        title: "Right",
        category: "operation",
        description: null,
        inputSchema: {},
        decisionPolicy: {},
        completionOperationKey: null,
        createdByAccountId: zAccountId.parse("3ba00d8d-82f5-498d-b03a-bf4f72a88a4d"),
        createdAt: new Date(111),
      }),
    ])

    expect(results.filter((result) => result === "revision_conflict")).toHaveLength(1)
    expect(results.filter((result) => result !== "revision_conflict")).toHaveLength(1)
    expect(
      await fixture.database
        .prepare("SELECT count(*) AS count FROM system_procedure_definition_revisions")
        .first<number>("count"),
    ).toBe(2)
  })

  test("retire後は一覧と新規提案から除外する", async () => {
    const fixture = await createFixture()
    const publish = new PublishSystemProcedure(fixture.repository)
    const definition = await publish.run({
      key: "change",
      expectedRevision: 0,
      title: "Change",
      category: "operation",
      description: null,
      inputSchema: {},
      decisionPolicy: {},
      completionOperationKey: null,
      createdByAccountId: zAccountId.parse("3ba00d8d-82f5-498d-b03a-bf4f72a88a4d"),
      createdAt: new Date(100),
    })
    if (definition instanceof Error || definition === "revision_conflict") throw definition
    const retired = await fixture.repository.retire({
      key: definition.key,
      expectedRevision: 1,
      retiredAt: new Date(120),
    })

    expect(retired).toBe(true)
    expect(await fixture.repository.find(definition.key)).toBeNull()
    expect(
      await fixture.repository.findMany({
        category: null,
        limit: 10,
        offset: 0,
      }),
    ).toEqual({ definitions: [], total: 0 })
  })
})
