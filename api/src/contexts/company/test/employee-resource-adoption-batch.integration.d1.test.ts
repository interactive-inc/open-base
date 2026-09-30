import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { testDerivedId } from "@system/test/system-test-id.test-support"
import { expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { z } from "zod"
import {
  batchAccountId,
  batchEmployeeId,
  createEmployeeAdoptionBatchFixture,
} from "@/contexts/company/test/employee-resource-adoption-batch.test-support"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("全Account対応が接続済みである制約を保ち、台帳と公開履歴を変えず全員を一度で接続する", async () => {
  const context = await createEmployeeAdoptionBatchFixture()
  const legacy = await context.legacy()
  const before = await context.state()
  const input = await context.input()
  expect(
    (await context.singlePost({ ...(await context.singleInput()), reuseExistingHistory: true }))
      .status,
  ).toBe(503)
  expect(await context.state()).toEqual(before)
  const response = await context.post(input)
  expect(
    z
      .object({
        employeeIds: z.array(z.string()),
        organizationRevision: z.number(),
        replayed: z.boolean(),
      })
      .strict()
      .parse(await response.json()),
  ).toEqual({
    employeeIds: input.employees.map((employee) => employee.employeeId),
    organizationRevision: 3,
    replayed: false,
  })
  expect(response.status).toBe(200)
  expect(await context.legacy()).toEqual(legacy)
  const after = await context.state()
  expect(after[4]).toEqual(before[4])
  expect(after[5]).toEqual(before[5])
  expect(after[6]).toEqual(before[6])
  expect(after[1]).toHaveLength(4)
  expect(after[2]).toHaveLength(1)
  expect(after[3]).toHaveLength(2)
  expect(after[3]).toEqual(
    expect.arrayContaining(
      input.employees.map((employee) =>
        expect.objectContaining({
          employee_id: employee.employeeId,
          snapshot_digest: employee.snapshotDigest,
          actor_account_id: context.actor.accountId,
          reason: input.reason,
          expected_revision: 2,
          organization_revision: 3,
        }),
      ),
    ),
  )
})

test("翌日の並び替えた再送も元の結果を返し、対象・理由・actorを変えた同じキーを拒否する", async () => {
  const context = await createEmployeeAdoptionBatchFixture()
  const input = await context.input()
  expect((await context.post(input)).status).toBe(200)
  const after = await context.state()
  context.clock.now = new Date("2026-09-08T00:00:00Z")
  const replay = await context.post({ ...input, employees: input.employees.toReversed() })
  expect(replay.status).toBe(200)
  expect(await replay.json()).toMatchObject({ organizationRevision: 3, replayed: true })
  expect((await context.post({ ...input, reason: "Changed reason" })).status).toBe(409)
  expect((await context.post({ ...input, employees: input.employees.slice(0, 1) })).status).toBe(
    409,
  )
  context.actors.current = CompanyActorValue.restore({
    accountId: batchAccountId(1),
    employeeId: batchEmployeeId(1),
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: ["company:admin"],
  })
  expect((await context.post(input)).status).toBe(409)
  expect(await context.state()).toEqual(after)
})

test("新しい接続は当日の確認を要求し、対象漏れや最後の従業員の不一致で一部を接続しない", async () => {
  const context = await createEmployeeAdoptionBatchFixture()
  const input = await context.input()
  const before = await context.state()
  expect((await context.post({ ...input, observedOn: "2026-09-06" })).status).toBe(409)
  expect((await context.post({ ...input, employees: input.employees.slice(0, 1) })).status).toBe(
    503,
  )
  expect(await context.state()).toEqual(before)
  await context.database
    .prepare(
      `UPDATE company_account_profiles SET display_name = 'Unconfirmed name' WHERE account_id = '${batchAccountId(1)}'`,
    )
    .run()
  expect((await context.post(input)).status).toBe(409)
  const changed = await context.state()
  expect((await context.post(await context.input())).status).toBe(422)
  expect(await context.state()).toEqual(changed)
})

test("最後の移行証跡の保存失敗も全取消し、同じキーで再試行できる", async () => {
  const context = await createEmployeeAdoptionBatchFixture()
  const input = await context.input()
  const before = await context.state()
  await execSql(
    context.database,
    `CREATE TRIGGER fail_batch_adoption BEFORE INSERT ON company_employee_resource_adoptions
    WHEN NEW.employee_id = '${batchEmployeeId(1)}' BEGIN SELECT RAISE(ABORT, 'injected last receipt failure'); END`,
  )
  expect((await context.post(input)).status).toBe(503)
  expect(await context.state()).toEqual(before)
  await execSql(context.database, "DROP TRIGGER fail_batch_adoption")
  expect((await context.post(input)).status).toBe(200)
})

test("保存直前の最後のsnapshot変更を検出し、全員の接続と監査を取り消す", async () => {
  const context = await createEmployeeAdoptionBatchFixture()
  const input = await context.input()
  const before = await context.state()
  const batch = context.database.batch.bind(context.database)
  const intercepted = spyOn(context.database, "batch").mockImplementationOnce(
    async (statements) => {
      await context.database
        .prepare(
          `UPDATE company_account_profiles SET updated_at = updated_at + 1 WHERE account_id = '${batchAccountId(1)}'`,
        )
        .run()
      return batch(statements)
    },
  )
  try {
    expect((await context.post(input)).status).toBe(409)
  } finally {
    intercepted.mockRestore()
  }
  expect(await context.state()).toEqual(before)
  expect((await context.post(await context.input())).status).toBe(200)
})

test("保存直前に同じ依頼が確定しても、一度だけ接続して再送結果を返す", async () => {
  const context = await createEmployeeAdoptionBatchFixture()
  const input = await context.input()
  const batch = context.database.batch.bind(context.database)
  const intercepted = spyOn(context.database, "batch").mockImplementationOnce(
    async (statements) => {
      expect((await context.post(input)).status).toBe(200)
      return batch(statements)
    },
  )
  try {
    const response = await context.post(input)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ replayed: true, organizationRevision: 3 })
  } finally {
    intercepted.mockRestore()
  }
  const state = await context.state()
  expect(state[1]).toHaveLength(4)
  expect(state[2]).toHaveLength(1)
  expect(state[3]).toHaveLength(2)
})

test("再送も現在のCompany管理資格を要求する", async () => {
  const context = await createEmployeeAdoptionBatchFixture()
  const input = await context.input()
  expect((await context.post(input)).status).toBe(200)
  const after = await context.state()
  const accesses: ReadonlyArray<
    Pick<Parameters<typeof CompanyActorValue.restore>[0], "organizationIds" | "capabilities">
  > = [
    { organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID], capabilities: ["company:read"] },
    { organizationIds: ["01900060-0000-7000-8000-12268fccf2cc"], capabilities: ["company:admin"] },
  ]
  for (const access of accesses) {
    context.actors.current = CompanyActorValue.restore({
      accountId: context.actor.accountId,
      employeeId: context.actor.employeeId,
      ...access,
    })
    expect((await context.post(input)).status).toBe(403)
  }
  context.actors.current = undefined
  expect((await context.post(input)).status).toBe(401)
  expect(await context.state()).toEqual(after)
})

test("未知の従業員・重複・空集合・任意履歴やactorの注入を拒否する", async () => {
  const context = await createEmployeeAdoptionBatchFixture()
  const input = await context.input()
  const before = await context.state()
  for (const employees of [
    [],
    [input.employees[0], input.employees[0]],
    Array.from({ length: 251 }, (_, index) => ({
      employeeId: testDerivedId("employee", index),
      snapshotDigest: "a".repeat(64),
    })),
  ]) {
    expect((await context.post({ ...input, employees })).status).toBe(400)
  }
  expect((await context.post({ ...input, resources: [] })).status).toBe(400)
  expect(
    (await context.post({ ...input, actorAccountId: "5ceca380-7edc-4c23-980b-d7c1f0df3783" }))
      .status,
  ).toBe(400)
  expect(
    (
      await context.post({
        ...input,
        employees: [
          { employeeId: "a5438ed0-be24-4fee-afe4-037ae70145b7", snapshotDigest: "a".repeat(64) },
        ],
      })
    ).status,
  ).toBe(404)
  expect(await context.state()).toEqual(before)
})

test("250人を100個のbind上限や人数分のtransactionに分割せず接続する", async () => {
  const context = await createEmployeeAdoptionBatchFixture(250)
  const input = await context.input()
  const intercepted = spyOn(context.database, "batch")
  try {
    const response = await context.post(input)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ organizationRevision: 3, replayed: false })
    expect(intercepted).toHaveBeenCalledTimes(1)
    expect(intercepted.mock.calls[0]![0].length).toBeLessThanOrEqual(33)
  } finally {
    intercepted.mockRestore()
  }
  const state = await context.state()
  expect(state[1]).toHaveLength(500)
  expect(state[3]).toHaveLength(250)
}, 30_000)
