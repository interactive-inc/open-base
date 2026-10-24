import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { z } from "zod"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { createEmployeeAdoptionFixture } from "@/contexts/company/test/employee-resource-adoption.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture() {
  const context = await createEmployeeAdoptionFixture()
  for (const resource of context.resources) {
    await context.database.batch([
      context.database
        .prepare(`INSERT INTO company_resource_revisions
          (organization_id, resource_type, resource_id, revision, organization_revision,
            state, effective_from, effective_to, attributes_json, command_id, actor_account_id, reason, recorded_at)
          VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6, ?7, ?8, 'confirmed-history-import', '7a0b75ec-d7b9-4f49-b023-432c8f109a40', 'Historical import', 10)`)
        .bind(
          resource.organizationId,
          resource.type,
          resource.id,
          resource.revision,
          resource.state,
          resource.effectiveFrom,
          resource.effectiveTo,
          JSON.stringify(resource.attributes),
        ),
      context.database
        .prepare(`INSERT INTO company_resource_heads
          (organization_id, resource_type, resource_id, revision, organization_revision,
            state, effective_from, effective_to, attributes_json, updated_at)
          VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6, ?7, ?8, 10)
          ON CONFLICT (organization_id, resource_type, resource_id) DO UPDATE SET
            revision = excluded.revision, organization_revision = excluded.organization_revision, state = excluded.state, effective_from = excluded.effective_from,
            effective_to = excluded.effective_to, attributes_json = excluded.attributes_json`)
        .bind(
          resource.organizationId,
          resource.type,
          resource.id,
          resource.revision,
          resource.state,
          resource.effectiveFrom,
          resource.effectiveTo,
          JSON.stringify(resource.attributes),
        ),
    ])
  }
  await execSql(
    context.database,
    `UPDATE company_organizations SET revision = 1 WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'; UPDATE company_organizations SET revision = 2 WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
  )
  const publicHistory = async () =>
    (
      await context.database
        .prepare("SELECT * FROM company_resource_revisions ORDER BY 1, 2, 3, 4")
        .all()
    ).results
  return { ...context, publicHistory }
}

test("確認済みの公開履歴を再作成せず、既存の人物・雇用と接続して再送できる", async () => {
  const context = await fixture()
  const legacy = await context.legacy()
  const publicHistory = await context.publicHistory()
  const input = { ...(await context.input()), reuseExistingHistory: true }
  const response = await context.post(input)
  expect(response.status).toBe(200)
  expect(await context.legacy()).toEqual(legacy)
  expect(await context.publicHistory()).toEqual(publicHistory)
  expect(
    await context.database
      .prepare("SELECT count(*) AS count FROM company_workforce_resource_bindings")
      .first<number>("count"),
  ).toBe(2)
  expect(
    await context.database
      .prepare("SELECT revision FROM company_organizations")
      .first<number>("revision"),
  ).toBe(input.expectedRevision + 1)
  expect((await context.post(input)).status).toBe(200)
  expect(await context.publicHistory()).toEqual(publicHistory)
  expect(
    await context.database
      .prepare("SELECT revision FROM company_organizations")
      .first<number>("revision"),
  ).toBe(input.expectedRevision + 1)
  const receipt = z
    .object({ source_json: z.string(), actor_account_id: z.string(), reason: z.string() })
    .parse(
      await context.database.prepare("SELECT * FROM company_employee_resource_adoptions").first(),
    )
  expect(receipt.actor_account_id).toBe(context.actor.accountId)
  expect(receipt.reason).toBe(input.reason)
  expect(JSON.parse(receipt.source_json).publicResources).toHaveLength(5)
  expect(JSON.parse(receipt.source_json).publicResources[0]).toMatchObject({
    commandId: "confirmed-history-import",
    actorAccountId: "7a0b75ec-d7b9-4f49-b023-432c8f109a40",
    reason: "Historical import",
    recordedAt: 10,
  })
})

test("明示した接続指定がなければ、従来どおり既存の公開IDとの衝突を拒否する", async () => {
  const context = await fixture()
  expect((await context.post(await context.input())).status).toBe(409)
  expect(
    await context.database
      .prepare("SELECT count(*) AS count FROM company_workforce_resource_bindings")
      .first<number>("count"),
  ).toBe(0)
})

test.each(["past-name", "missing-revision"])(
  "確認内容が公開履歴と違う場合は、現在値が一致していても拒否する: %s",
  async (difference) => {
    const context = await fixture()
    const original = await context.input()
    const resources = original.resources.map((resource) => ({ ...resource }))
    if (difference === "past-name") {
      const former = resources[0]!
      resources[0] = { ...former, attributes: { officialName: "Unconfirmed history" } }
    }
    if (difference === "missing-revision") resources.splice(0, 1)
    const before = await context.publicHistory()
    expect(
      (await context.post({ ...original, resources, reuseExistingHistory: true })).status,
    ).toBe(422)
    expect(await context.publicHistory()).toEqual(before)
    expect(
      await context.database
        .prepare("SELECT count(*) AS count FROM company_workforce_resource_bindings")
        .first<number>("count"),
    ).toBe(0)
  },
)

test("公開履歴の追記も確認digestへ含め、確認後の変更で接続しない", async () => {
  const context = await fixture()
  const input = { ...(await context.input()), reuseExistingHistory: true }
  await execSql(
    context.database,
    `INSERT INTO company_resource_revisions
    (organization_id, resource_type, resource_id, revision, organization_revision, state,
      effective_from, effective_to, attributes_json, command_id, actor_account_id, reason, recorded_at)
    SELECT organization_id, resource_type, resource_id, 3, 3, state, '2027-01-01', effective_to,
      attributes_json, 'later-public-change', actor_account_id, 'Later evidence', 20
    FROM company_resource_revisions WHERE resource_type = 'person' AND revision = 2`,
  )
  expect((await context.post(input)).status).toBe(409)
  expect(
    await context.database
      .prepare("SELECT count(*) AS count FROM company_workforce_resource_bindings")
      .first<number>("count"),
  ).toBe(0)
})

test("現在のprojectionが保存済みの最終版と一致しなければ接続しない", async () => {
  const context = await fixture()
  await execSql(
    context.database,
    `UPDATE company_resource_heads
    SET attributes_json = json_set(attributes_json, '$.phone', 'unconfirmed')
    WHERE resource_type = 'person'`,
  )
  expect(
    (await context.post({ ...(await context.input()), reuseExistingHistory: true })).status,
  ).toBe(422)
  expect(
    await context.database
      .prepare("SELECT count(*) AS count FROM company_workforce_resource_bindings")
      .first<number>("count"),
  ).toBe(0)
})

test("接続記録の保存失敗では対応・会社版・commandを全取消し、同じ依頼で再試行できる", async () => {
  const context = await fixture()
  const input = { ...(await context.input()), reuseExistingHistory: true }
  const before = await context.publicHistory()
  await execSql(
    context.database,
    `CREATE TRIGGER fail_existing_adoption BEFORE INSERT ON company_employee_resource_adoptions
    BEGIN SELECT RAISE(ABORT, 'injected adoption receipt failure'); END;`,
  )
  expect((await context.post(input)).status).toBe(503)
  expect(
    await context.database
      .prepare("SELECT count(*) AS count FROM company_workforce_resource_bindings")
      .first<number>("count"),
  ).toBe(0)
  expect(
    await context.database
      .prepare("SELECT count(*) AS count FROM company_command_receipts")
      .first<number>("count"),
  ).toBe(0)
  expect(
    await context.database
      .prepare("SELECT revision FROM company_organizations")
      .first<number>("revision"),
  ).toBe(input.expectedRevision)
  expect(await context.publicHistory()).toEqual(before)
  await execSql(context.database, "DROP TRIGGER fail_existing_adoption")
  expect((await context.post(input)).status).toBe(200)
})

test("保存直前の別変更を拒否し、再確認した同じキーでは一度だけ接続する", async () => {
  const context = await fixture()
  const input = { ...(await context.input()), reuseExistingHistory: true }
  const batch = context.database.batch.bind(context.database)
  const intercepted = spyOn(context.database, "batch").mockImplementationOnce(
    async (statements) => {
      await execSql(context.database, "UPDATE company_organizations SET revision = revision + 1")
      return batch(statements)
    },
  )
  try {
    expect((await context.post(input)).status).toBe(409)
  } finally {
    intercepted.mockRestore()
  }
  expect(
    await context.database
      .prepare("SELECT count(*) AS count FROM company_workforce_resource_bindings")
      .first<number>("count"),
  ).toBe(0)
  expect(
    (await context.post({ ...(await context.input()), reuseExistingHistory: true })).status,
  ).toBe(200)
})

test("再送も権限を要求し、同じキーの接続方式変更を拒否する", async () => {
  const context = await fixture()
  const original = await context.input()
  const input = { ...original, reuseExistingHistory: true }
  expect((await context.post(input)).status).toBe(200)
  expect((await context.post(original)).status).toBe(409)
  context.actors.current = CompanyActorValue.restore({
    accountId: context.actor.accountId,
    employeeId: context.actor.employeeId,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: ["company:read"],
  })
  expect((await context.post(input)).status).toBe(403)
})
