import { createEmployeeAdoptionFixture } from "@/contexts/company/test/employee-resource-adoption.test-support"
import type { AdoptionResource } from "@/contexts/company/test/employee-resource-adoption.test-support"
import { prepareUnpublishedEmployment } from "@/contexts/company/test/unpublished-employment.test-support"
import { EmployeeResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/employee-resource-adoption/employee-resource-adoption-snapshot.adapter"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"

/** 一括接続の追加従業員の ID。index は 1 から始まる。 */
export function batchEmployeeId(index: number): string {
  return deterministicCompanyId("test-employee", `batch-${index}`)
}

/** 一括接続の追加従業員の雇用 ID。 */
export function batchEmploymentId(index: number): string {
  return deterministicCompanyId("test-employment", `batch-${index}`)
}

/** 一括接続の追加従業員に対応する Account の ID。 */
export function batchAccountId(index: number): string {
  return deterministicCompanyId("test-account", `batch-${index}`)
}

/** 状態の比較で一度に読む行数。長い確認履歴の行でも応答が大きくなりすぎない数にする。 */
const STATE_PAGE_SIZE = 100

/** 公開Account対応だけが先に存在し、全員の接続を同時に必要とする会社を用意する。 */
export async function createEmployeeAdoptionBatchFixture(
  count = 2,
  extraPersonRevisions = 0,
  transformHistory: (resource: AdoptionResource) => AdoptionResource = (resource) => resource,
) {
  const context = await createEmployeeAdoptionFixture()
  const resources: AdoptionResource[] = [...context.resources]
  const employees = [
    {
      employeeId: "50737555-5956-4b7d-8755-4e3b9660f143",
      accountId: "7a0b75ec-d7b9-4f49-b023-432c8f109a40",
    },
  ]
  for (const index of Array.from({ length: count - 1 }, (_, offset) => offset + 1)) {
    const employeeId = restoreWorkforceId("employee", batchEmployeeId(index))
    const employmentId = restoreWorkforceId("employment", batchEmploymentId(index))
    const accountId = batchAccountId(index)
    const officialName = `Person ${index}`
    const employeeCode = `BATCH-${index}`
    await context.database.batch([
      context.database
        .prepare(`INSERT INTO company_employees
        (id, official_name, employee_code, email, phone, created_at, updated_at)
        VALUES (?1, ?2, ?3, NULL, NULL, 0, 0)`)
        .bind(employeeId, officialName, employeeCode),
      context.database
        .prepare(`INSERT INTO company_employments
        (id, employee_id, contract_name, employment_type, hire_date, termination_date, status, created_at, updated_at)
        VALUES (?1, ?2, 'Confirmed Contract', 'PART_TIME', '2020-01-01', NULL, 'ACTIVE', 0, 0)`)
        .bind(employmentId, employeeId),
      context.database
        .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
        VALUES (?1, 'active', 0, 0, 0)`)
        .bind(accountId),
      context.database
        .prepare(
          "INSERT INTO company_account_employee_links (account_id, employee_id) VALUES (?1, ?2)",
        )
        .bind(accountId, employeeId),
      context.database
        .prepare(`INSERT INTO company_account_profiles
        (organization_id, account_id, display_name, created_at, updated_at)
        VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', ?1, ?2, 0, 0)`)
        .bind(accountId, officialName),
    ])
    const initial = await prepareUnpublishedEmployment(context.database, {
      employeeId,
      employmentId,
      effectiveOn: restoreCalendarDate("2020-01-01"),
      status: "active",
      occurredAt: new Date("2020-01-01T00:00:00Z"),
      actorAccountId: context.actor.accountId,
      operationId: deterministicCompanyId("test-operation", `historical-${index}`),
      reason: "Confirmed historical registration",
    })
    await context.database.batch([...initial])
    const person: AdoptionResource = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "person",
      id: `person:batch-${index}`,
      revision: 1,
      state: "active",
      effectiveFrom: "2020-01-01",
      effectiveTo: null,
      attributes: { officialName, email: null, phone: null },
    }
    resources.push(
      person,
      {
        ...person,
        type: "employee",
        id: employeeId,
        attributes: { personId: person.id, employeeCode },
      },
      {
        ...person,
        type: "employment",
        id: employmentId,
        attributes: {
          employeeId,
          employmentType: "PART_TIME",
          officialName: "Confirmed Contract",
          status: "ACTIVE",
        },
      },
    )
    employees.push({ employeeId, accountId })
  }
  const latestPeople = new Map<string, AdoptionResource>()
  for (const resource of resources) {
    if (resource.type === "person") latestPeople.set(resource.id, resource)
  }
  for (const person of latestPeople.values()) {
    for (const offset of Array.from({ length: extraPersonRevisions }, (_, index) => index + 1)) {
      resources.push({ ...person, revision: person.revision + offset })
    }
  }
  const prepareResource = (
    resource: Omit<AdoptionResource, "type"> & Readonly<{ type: string }>,
  ) => {
    return [
      context.database
        .prepare(`INSERT INTO company_resource_revisions
        (organization_id, resource_type, resource_id, revision, organization_revision,
         state, effective_from, effective_to, attributes_json, command_id, actor_account_id, reason, recorded_at)
        VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6, ?7, ?8, 'confirmed-history-import', '7a0b75ec-d7b9-4f49-b023-432c8f109a40', ?9, 10)`)
        .bind(
          resource.organizationId,
          resource.type,
          resource.id,
          resource.revision,
          resource.state,
          resource.effectiveFrom,
          resource.effectiveTo,
          JSON.stringify(resource.attributes),
          resource.type === "person" && resource.revision > 2
            ? "確認".repeat(1000)
            : "Historical import",
        ),
      context.database
        .prepare(`INSERT INTO company_resource_heads
        (organization_id, resource_type, resource_id, revision, organization_revision,
         state, effective_from, effective_to, attributes_json, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6, ?7, ?8, 10)
        ON CONFLICT (organization_id, resource_type, resource_id) DO UPDATE SET
          revision = excluded.revision, organization_revision = excluded.organization_revision,
          state = excluded.state, effective_from = excluded.effective_from,
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
    ]
  }
  const seedResource = async (...args: Parameters<typeof prepareResource>) => {
    await context.database.batch(prepareResource(...args))
  }
  // 1資源2statementを50件ずつ送り、1回100statement以内で履歴順を保つ。
  // 値と検証用triggerは維持し、大量履歴の準備を数千回のHTTP要求にしない。
  for (let offset = 0; offset < resources.length; offset += 50) {
    await context.database.batch(
      resources
        .slice(offset, offset + 50)
        .flatMap((resource) => prepareResource(transformHistory(resource))),
    )
  }
  await context.database.batch(
    Array.from({ length: 2 + extraPersonRevisions }, (_, index) =>
      context.database.prepare("UPDATE company_organizations SET revision = ?1").bind(index + 1),
    ),
  )
  for (const employee of employees) {
    const resourceId = deterministicCompanyId("account-link", employee.employeeId)
    await seedResource({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "account-employee-link",
      id: resourceId,
      revision: 1,
      state: "active",
      effectiveFrom: "2020-01-01",
      effectiveTo: null,
      attributes: { accountId: employee.accountId, employeeId: employee.employeeId },
    })
    await context.database
      .prepare(`INSERT INTO company_account_employee_resource_bindings
      (resource_id, account_id, employee_id, recorded_at) VALUES (?1, ?2, ?3, 10)`)
      .bind(resourceId, employee.accountId, employee.employeeId)
      .run()
  }
  const input = async () => {
    const snapshots = await new EmployeeResourceAdoptionSnapshotAdapter(context.database).findMany(
      employees.map((employee) => employee.employeeId),
    )
    if (snapshots instanceof Error) throw snapshots
    return {
      expectedRevision: snapshots[0]!.props.value.organizationRevision!,
      observedOn: "2026-09-07",
      reason: "Confirmed against personnel records",
      employees: snapshots.map((snapshot) => ({
        employeeId: snapshot.props.value.employee.id,
        snapshotDigest: snapshot.props.digest,
      })),
    }
  }
  const post = (body: unknown, key = "adoption-batch-command") =>
    context.app.request(
      "/company/employee-resource-adoption-batches",
      {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify(body),
      },
      context.environment,
    )
  const state = async () =>
    Promise.all(
      [
        "company_organizations",
        "company_workforce_resource_bindings",
        "company_command_receipts",
        "company_employee_resource_adoptions",
        "company_resource_revisions",
        "company_resource_heads",
        "company_account_employee_resource_bindings",
      ].map(async (table) => {
        // 確認履歴は合計で数MBになり、ローカルD1が一度に返せる応答を超えるため、全列の順で分けて読む。
        const columns =
          (await context.database
            .prepare(`SELECT count(*) AS count FROM pragma_table_info('${table}')`)
            .first<number>("count")) ?? 0
        const order = Array.from({ length: columns }, (_, index) => index + 1).join(", ")
        const rows: Array<Record<string, unknown>> = []
        for (let offset = 0; ; offset += STATE_PAGE_SIZE) {
          const page = await context.database
            .prepare(`SELECT * FROM ${table} ORDER BY ${order} LIMIT ?1 OFFSET ?2`)
            .bind(STATE_PAGE_SIZE, offset)
            .all<Record<string, unknown>>()
          rows.push(...page.results)
          if (page.results.length < STATE_PAGE_SIZE) return rows
        }
      }),
    )
  return {
    ...context,
    input,
    post,
    state,
    employees,
    singleInput: context.input,
    singlePost: context.post,
  }
}
