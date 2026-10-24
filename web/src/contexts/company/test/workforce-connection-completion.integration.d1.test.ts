import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { createEmployeeAdoptionFixture } from "@/contexts/company/test/employee-resource-adoption.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const path = "/company/workforce-connection-completions"

function complete(
  fixture: Awaited<ReturnType<typeof createEmployeeAdoptionFixture>>,
  key: string,
  reason = "All employees are connected to the published history",
) {
  return fixture.app.request(
    path,
    {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": key },
      body: JSON.stringify({ reason }),
    },
    fixture.environment,
  )
}

test("未接続が残る間は記録せず、全件の接続後に一度だけ記録して再送は同じ結果を返す", async () => {
  const f = await createEmployeeAdoptionFixture()
  const before = await f.app.request(path, {}, f.environment)
  expect((await before.json()) as unknown).toMatchObject({
    completion: null,
    unconnectedEmployeeCount: 1,
    unconnectedEmploymentCount: 1,
  })
  const incomplete = await complete(f, "completion-early")
  expect({ status: incomplete.status, body: await incomplete.json() }).toEqual({
    status: 409,
    body: { code: "workforce_connection_incomplete" },
  })

  const adopted = await f.post(await f.input())
  expect(adopted.status).toBe(200)
  const first = await complete(f, "completion-1")
  expect(first.status).toBe(201)
  const saved = await first.json()
  expect(saved).toMatchObject({
    commandId: "completion-1",
    actorAccountId: "7a0b75ec-d7b9-4f49-b023-432c8f109a40",
    employeeCount: 1,
    employmentCount: 1,
  })
  const replay = await complete(f, "completion-1")
  expect({ status: replay.status, body: await replay.json() }).toEqual({ status: 200, body: saved })
  const other = await complete(f, "completion-2")
  expect({ status: other.status, body: await other.json() }).toEqual({
    status: 409,
    body: { code: "workforce_connection_already_completed" },
  })
  const status = await f.app.request(path, {}, f.environment)
  expect((await status.json()) as unknown).toEqual({
    completion: saved,
    unconnectedEmployeeCount: 0,
    unconnectedEmploymentCount: 0,
  })

  for (const sql of [
    "UPDATE company_workforce_connection_completions SET reason = 'changed'",
    "DELETE FROM company_workforce_connection_completions",
  ]) {
    const failure = await execSql(f.database, sql).then(
      () => null,
      (error: unknown) => error,
    )
    expect(String(failure)).toContain("company_workforce_connection_completion_immutable")
  }
})

test("Company管理資格が無ければ接続の状態も完了も扱わない", async () => {
  const f = await createEmployeeAdoptionFixture()
  f.actors.current = CompanyActorValue.restore({
    accountId: "7a0b75ec-d7b9-4f49-b023-432c8f109a40",
    employeeId: null,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: ["company:read", "company:write"],
  })
  expect((await f.app.request(path, {}, f.environment)).status).toBe(403)
  expect((await complete(f, "completion-forbidden")).status).toBe(403)
})

test("完了を記録した会社では、公開履歴へ未接続の従業員への発令を拒否する", async () => {
  const f = await createEmployeeAdoptionFixture()
  // 未接続の従業員が残る記録済みの状態は通常の経路では作れないので、DBの検査だけを外して作る。
  await execSql(
    f.database,
    `DROP TRIGGER company_workforce_connection_completions_requires_connection;
    INSERT INTO company_workforce_connection_completions
    (organization_id, command_id, actor_account_id, reason, employee_count, employment_count, completed_at)
    VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'completion-test', '7a0b75ec-d7b9-4f49-b023-432c8f109a40', 'Test', 1, 1, 0);`,
  )
  const rejected = await f.personnel(
    {
      kind: "returned",
      employeeCode: "ADOPT-001",
      eventOn: restoreCalendarDate("2026-08-20"),
    },
    "unconnected-return",
  )
  expect(rejected).toBeInstanceOf(Error)
  expect(rejected).toMatchObject({ code: "unconnected_employee" })
})
