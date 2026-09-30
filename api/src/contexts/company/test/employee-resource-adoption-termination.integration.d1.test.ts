import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { createEmployeeAdoptionBatchFixture } from "@/contexts/company/test/employee-resource-adoption-batch.test-support"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture(hasInitialAction = true, lifecycleRevision = 1) {
  const context = await createEmployeeAdoptionBatchFixture(1)
  const employeeId = restoreWorkforceId("employee", "9db8f3c5-71a8-4a73-855b-87678fa6a32b")
  await execSql(
    context.database,
    `
    INSERT INTO company_employees (id, official_name, employee_code, email, phone, created_at, updated_at)
      VALUES ('9db8f3c5-71a8-4a73-855b-87678fa6a32b', 'Former Employee', 'ENDED-1', NULL, NULL, 0, 0);
    INSERT INTO company_employments (id, employee_id, contract_name, employment_type, hire_date, termination_date, status, created_at, updated_at)
      VALUES ('ae3bcd0b-cdd7-4cd2-9d4f-1fd1c34a36f1', '9db8f3c5-71a8-4a73-855b-87678fa6a32b', 'Former Employee', 'FULL_TIME', '2020-01-01', '2026-08-16', 'TERMINATED', 0, 0);
    INSERT INTO company_employee_lifecycle_revisions (employee_id, revision, updated_at)
      VALUES ('9db8f3c5-71a8-4a73-855b-87678fa6a32b', ${lifecycleRevision}, 0);
    INSERT INTO company_personnel_actions
      (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id, requested_by_employee_id,
       source_type, source_application_id, corrects_action_id, operation_id, payload_fingerprint, summary_json)
      VALUES ('${hasInitialAction ? "8a1f4a0e-5c2b-4d6e-9f10-2b3c4d5e6f70" : "8a1f4a0e-5c2b-4d6e-9f10-2b3c4d5e6f71"}', '9db8f3c5-71a8-4a73-855b-87678fa6a32b', 'initial_state', '2020-01-01', 0, NULL, NULL,
       'system', NULL, NULL, '8a1f4a0e-5c2b-4d6e-9f10-2b3c4d5e6f70', '${"0".repeat(64)}',
       '{"kind":"initial_state","eventOn":"2020-01-01","department":null,"positionTitle":null,"managerEmployeeCode":null,"status":"retired"}');
    INSERT INTO company_employment_period_versions (period_id, revision, employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES ('ae3bcd0b-cdd7-4cd2-9d4f-1fd1c34a36f1', 1, '9db8f3c5-71a8-4a73-855b-87678fa6a32b', '2020-01-01', '2026-08-16', 0, '8a1f4a0e-5c2b-4d6e-9f10-2b3c4d5e6f70', 0);
    INSERT INTO company_employee_status_period_versions
      (period_id, revision, employment_period_id, employee_id, status, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES ('8a1f4a0e-5c2b-4d6e-9f10-2b3c4d5e6f72', 1, 'ae3bcd0b-cdd7-4cd2-9d4f-1fd1c34a36f1', '9db8f3c5-71a8-4a73-855b-87678fa6a32b', 'active', '2020-01-01', '2026-08-16', 0, '8a1f4a0e-5c2b-4d6e-9f10-2b3c4d5e6f70', 0);
  `,
  )
  const resources = [
    {
      type: "person",
      id: "person:ended",
      effectiveTo: null,
      attributes: { officialName: "Former Employee" },
    },
    {
      type: "employee",
      id: employeeId,
      effectiveTo: null,
      attributes: { personId: "person:ended", employeeCode: "ENDED-1" },
    },
    {
      type: "employment",
      id: "ae3bcd0b-cdd7-4cd2-9d4f-1fd1c34a36f1",
      effectiveTo: "2026-08-17",
      attributes: {
        employeeId,
        officialName: "Former Employee",
        employmentType: "FULL_TIME",
        status: "RETIRED",
      },
    },
  ]
  for (const resource of resources) {
    await context.database.batch([
      context.database
        .prepare(`INSERT INTO company_resource_revisions
        (organization_id, resource_type, resource_id, revision, organization_revision, state,
         effective_from, effective_to, attributes_json, command_id, actor_account_id, reason, recorded_at)
        VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', ?1, ?2, 1, 1, 'active', '2020-01-01', ?3, ?4, 'initial-import', 'system:migration', 'Initial import', 0)`)
        .bind(
          resource.type,
          resource.id,
          resource.effectiveTo,
          JSON.stringify(resource.attributes),
        ),
      context.database
        .prepare(`INSERT INTO company_resource_heads
        (organization_id, resource_type, resource_id, revision, organization_revision, state,
         effective_from, effective_to, attributes_json, updated_at)
        VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', ?1, ?2, 1, 1, 'active', '2020-01-01', ?3, ?4, 0)`)
        .bind(
          resource.type,
          resource.id,
          resource.effectiveTo,
          JSON.stringify(resource.attributes),
        ),
    ])
  }
  context.employees.push({ employeeId, accountId: "eed91bb7-f1d9-42df-b7c3-b0d95457c577" })
  const input = await context.input()
  const correctedInput = {
    ...input,
    employees: input.employees.map((employee) =>
      employee.employeeId === employeeId
        ? {
            ...employee,
            terminationBoundaryCorrection: {
              employmentId: "ae3bcd0b-cdd7-4cd2-9d4f-1fd1c34a36f1",
              endsOn: "2026-08-17",
            },
            corrections: [
              {
                organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
                type: "employment",
                id: "ae3bcd0b-cdd7-4cd2-9d4f-1fd1c34a36f1",
                revision: 2,
                state: "active",
                effectiveFrom: "2020-01-01",
                effectiveTo: "2026-08-17",
                attributes: {
                  employeeId,
                  officialName: "Former Employee",
                  employmentType: "FULL_TIME",
                  status: "ACTIVE",
                },
              },
            ],
          }
        : employee,
    ),
  }
  return { ...context, correctedInput }
}

test.each([0, 1])(
  "初期の人事版%dから退職期間だけを追記補正し、元の退職日と全履歴を保全する",
  async (lifecycleRevision) => {
    const context = await fixture(true, lifecycleRevision)
    const before = await context.legacy()
    const response = await context.post(context.correctedInput)
    expect(await response.json()).toMatchObject({ organizationRevision: 3, replayed: false })
    expect(response.status).toBe(200)
    const after = await context.legacy()
    expect(after[0]).toEqual(before[0])
    expect(after[1]).toEqual(before[1])
    for (const index of [2, 3, 4])
      expect(after[index]).toEqual(expect.arrayContaining(before[index] ?? []))
    expect(after[3]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          period_id: "ae3bcd0b-cdd7-4cd2-9d4f-1fd1c34a36f1",
          revision: 2,
          ends_on: "2026-08-17",
        }),
      ]),
    )
    expect(after[4]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          period_id: "8a1f4a0e-5c2b-4d6e-9f10-2b3c4d5e6f72",
          revision: 2,
          ends_on: "2026-08-17",
        }),
      ]),
    )
    expect(after[2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "employment_revised",
          recorded_by_account_id: context.actor.accountId,
          corrects_action_id: "8a1f4a0e-5c2b-4d6e-9f10-2b3c4d5e6f70",
        }),
      ]),
    )
    const state = await context.state()
    expect(state[1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resource_id: "ae3bcd0b-cdd7-4cd2-9d4f-1fd1c34a36f1",
          resource_revision: 2,
          lifecycle_revision: lifecycleRevision + 1,
          last_action_id: expect.any(String),
        }),
      ]),
    )
    expect((await context.post(context.correctedInput)).status).toBe(200)
    expect(await context.legacy()).toEqual(after)
    expect(await context.state()).toEqual(state)
  },
)

test("初期取り込み後に人事版が進んだ従業員の期間を初期補正しない", async () => {
  const context = await fixture(true, 2)
  const before = await context.legacy()
  const state = await context.state()
  expect((await context.post(context.correctedInput)).status).toBe(422)
  expect(await context.legacy()).toEqual(before)
  expect(await context.state()).toEqual(state)
})

test("終了日を推測する補正や公開訂正を伴わない依頼を拒否する", async () => {
  const context = await fixture()
  const before = await context.legacy()
  for (const endsOn of ["2026-08-16", "2026-08-18"]) {
    const employees = context.correctedInput.employees.map((employee) =>
      "terminationBoundaryCorrection" in employee
        ? {
            ...employee,
            terminationBoundaryCorrection: { ...employee.terminationBoundaryCorrection, endsOn },
          }
        : employee,
    )
    expect((await context.post({ ...context.correctedInput, employees })).status).toBe(422)
  }
  const employees = context.correctedInput.employees.map((employee) => ({
    ...employee,
    corrections: undefined,
  }))
  expect((await context.post({ ...context.correctedInput, employees })).status).toBe(422)
  expect(await context.legacy()).toEqual(before)
})

test("最後の接続保存の失敗は期間補正と人事発令も取り消し、同じキーで再試行できる", async () => {
  const context = await fixture()
  const before = await context.legacy()
  const originalState = await context.state()
  await execSql(
    context.database,
    `CREATE TRIGGER fail_ended_adoption BEFORE INSERT ON company_employee_resource_adoptions
    WHEN NEW.employee_id = '9db8f3c5-71a8-4a73-855b-87678fa6a32b' BEGIN SELECT RAISE(ABORT, 'injected final failure'); END`,
  )
  expect((await context.post(context.correctedInput)).status).toBe(503)
  expect(await context.legacy()).toEqual(before)
  expect(await context.state()).toEqual(originalState)
  await execSql(context.database, "DROP TRIGGER fail_ended_adoption")
  expect((await context.post(context.correctedInput)).status).toBe(200)
})

test("初期期間の訂正元が存在しなければ架空の人事発令を参照する補正を保存しない", async () => {
  const context = await fixture(false)
  const before = await context.legacy()
  const state = await context.state()
  expect((await context.post(context.correctedInput)).status).toBe(503)
  expect(await context.legacy()).toEqual(before)
  expect(await context.state()).toEqual(state)
})
