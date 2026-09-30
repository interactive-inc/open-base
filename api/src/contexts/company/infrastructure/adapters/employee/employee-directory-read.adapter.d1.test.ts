import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { testDerivedId } from "@system/test/system-test-id.test-support"
import { drizzle } from "drizzle-orm/d1"
import { employments } from "@/contexts/company/infrastructure/schema/employment"
import { alias } from "drizzle-orm/sqlite-core"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { createEmployeeEmploymentTestDatabase } from "@/contexts/company/infrastructure/adapters/employee/lib/create-employee-employment-test-database.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { testAccountId } from "@system/test/system-test-id.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const legacyAccount = testAccountId("account:legacy")

function directory(database: D1Database, now: string) {
  return new CompanyEmployeeDirectoryReadAdapter({
    env: { DB: database, NOW: now, COMPANY_TIME_ZONE: "Asia/Tokyo" },
  })
}

const publicAccountLinkSchema = `
  CREATE TABLE company_account_employee_resource_bindings (
    resource_id TEXT, organization_id TEXT, account_id TEXT, employee_id TEXT
  );
`

function publicAccountLink(accountId: string, employeeId: string, resourceId = accountId) {
  return `
    INSERT INTO company_account_employee_resource_bindings VALUES
      ('${resourceId}', '${COMPANY_DEFAULT_ORGANIZATION_ID}', '${accountId}', '${employeeId}');
    INSERT INTO company_resource_revisions VALUES
      ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'account-employee-link', '${resourceId}', 1, 'active',
       '2026-01-01', NULL, '{"accountId":"${accountId}","employeeId":"${employeeId}"}');
  `
}

const page = {
  query: null,
  organizationUnit: null,
  status: null,
  limit: 10,
  offset: 0,
}

function employmentStatuses(database: D1Database, now: string) {
  const selected = alias(employments, "selected_employment")
  const state = CompanyEmployeeDirectoryReadAdapter.employmentStateTable({
    now,
    timeZone: "Asia/Tokyo",
    alias: "selected_employment_state",
  })
  return drizzle(database)
    .select({ id: selected.id, status: state.status })
    .from(selected)
    .leftJoin(
      state.source,
      state.on({ employmentId: selected.id, employeeId: selected.employeeId }),
    )
    .orderBy(selected.id)
}

function employmentAttributes(database: D1Database, now: string, timeZone = "Asia/Tokyo") {
  const selected = alias(employments, "listed_employment")
  const state = CompanyEmployeeDirectoryReadAdapter.employmentStateTable({
    now,
    timeZone,
    alias: "listed_employment_state",
  })
  return drizzle(database)
    .select({ id: selected.id, name: state.officialName, type: state.employmentType })
    .from(selected)
    .leftJoin(
      state.source,
      state.on({ employmentId: selected.id, employeeId: selected.employeeId }),
    )
    .orderBy(selected.id)
}

async function attributeDatabase(additionalSql = "") {
  return await createEmployeeEmploymentTestDatabase(
    `
    ALTER TABLE company_employments ADD COLUMN employment_type TEXT DEFAULT 'PART_TIME';
    INSERT INTO company_workforce_resource_bindings VALUES
      ('employment', 'employment:1', '01900060-0000-7000-8000-e53d7d4223a9', 'employee:1'),
      ('employee', 'employee:1', '01900060-0000-7000-8000-e53d7d4223a9', 'employee:1');
    INSERT INTO company_resource_revisions VALUES
      ('01900060-0000-7000-8000-e53d7d4223a9', 'person', 'person:1', 1, 'active', '2026-01-01', NULL, '{"officialName":"Before Person"}'),
      ('01900060-0000-7000-8000-e53d7d4223a9', 'person', 'person:1', 2, 'active', '2026-09-01', NULL, '{"officialName":"After Person"}'),
      ('01900060-0000-7000-8000-e53d7d4223a9', 'employee', 'employee:1', 1, 'active', '2026-01-01', NULL, '{"personId":"person:1"}'),
      ('01900060-0000-7000-8000-e53d7d4223a9', 'employment', 'employment:1', 1, 'active', '2026-01-01', '2026-10-01', '{"employeeId":"employee:1","employmentType":"FULL_TIME"}'),
      ('01900060-0000-7000-8000-e53d7d4223a9', 'employment', 'employment:1', 2, 'active', '2026-09-01', '2026-10-01', '{"employeeId":"employee:1","employmentType":"PART_TIME"}');
    ${additionalSql}
  `,
    false,
  )
}

describe("氏名・雇用区分の時点参照", () => {
  test("業務が指定した暦日では実行時刻や会社タイムゾーンを要求しない", async () => {
    const database = await attributeDatabase()
    const selected = alias(employments, "scheduled_employment")
    for (const scenario of [
      { date: "2026-08-31", name: "Before Person", type: "FULL_TIME", status: "ACTIVE" },
      { date: "2026-09-01", name: "After Person", type: "PART_TIME", status: "ACTIVE" },
      { date: "2026-10-01", name: "After Person", type: "PART_TIME", status: "TERMINATED" },
    ] satisfies ReadonlyArray<{
      date: string
      name: string
      type: "FULL_TIME" | "PART_TIME"
      status: "ACTIVE" | "TERMINATED"
    }>) {
      const state = CompanyEmployeeDirectoryReadAdapter.employmentStateTable({
        asOf: restoreCalendarDate(scenario.date),
        alias: "scheduled_employment_state",
      })
      expect(
        await drizzle(database)
          .select({ name: state.officialName, type: state.employmentType, status: state.status })
          .from(selected)
          .leftJoin(
            state.source,
            state.on({ employmentId: selected.id, employeeId: selected.employeeId }),
          ),
      ).toEqual([{ name: scenario.name, type: scenario.type, status: scenario.status }])
    }
  })

  test("会社営業日で名前と雇用区分が切り替わり、退職後は最終在籍日の区分を保つ", async () => {
    const database = await attributeDatabase(`
      INSERT INTO company_resource_revisions VALUES
        ('01900060-0000-7000-8000-e53d7d4223a9', 'employment', 'employment:1', 3, 'void', '2026-11-01', NULL, '{"employeeId":"employee:1","employmentType":"FULL_TIME"}');
    `)
    expect(await employmentAttributes(database, "2026-08-31T14:59:59Z")).toEqual([
      { id: "employment:1", name: "Before Person", type: "FULL_TIME" },
    ])
    expect(await employmentAttributes(database, "2026-08-31T15:00:00Z")).toEqual([
      { id: "employment:1", name: "After Person", type: "PART_TIME" },
    ])
    expect(await employmentAttributes(database, "2026-12-01T00:00:00Z")).toEqual([
      { id: "employment:1", name: "After Person", type: "PART_TIME" },
    ])
    expect(
      await employmentAttributes(database, "2026-08-31T15:00:00Z", "America/Los_Angeles"),
    ).toEqual([{ id: "employment:1", name: "Before Person", type: "FULL_TIME" }])
  })

  test("同じ有効日の訂正を優先し、遡及した版の番号だけで将来の区分を上書きしない", async () => {
    const database = await attributeDatabase(`
      INSERT INTO company_resource_revisions VALUES
        ('01900060-0000-7000-8000-e53d7d4223a9', 'employment', 'employment:1', 3, 'active', '2026-01-01', '2026-10-01', '{"employeeId":"employee:1","employmentType":"FULL_TIME"}');
    `)
    expect((await employmentAttributes(database, "2026-09-01T00:00:00Z"))[0]?.type).toBe(
      "PART_TIME",
    )
    await execSql(
      database,
      `INSERT INTO company_resource_revisions VALUES
      ('01900060-0000-7000-8000-e53d7d4223a9', 'employment', 'employment:1', 4, 'active', '2026-09-01', '2026-10-01', '{"employeeId":"employee:1","employmentType":"FULL_TIME"}');`,
    )
    expect((await employmentAttributes(database, "2026-09-01T00:00:00Z"))[0]?.type).toBe(
      "FULL_TIME",
    )
  })

  test("接続済み雇用の欠落・取消・期間外・不正区分・所有者不一致を旧台帳で補わない", async () => {
    for (const mutation of [
      "DELETE FROM company_resource_revisions WHERE resource_type = 'employment';",
      "UPDATE company_resource_revisions SET state = 'void' WHERE resource_type = 'employment';",
      "UPDATE company_resource_revisions SET effective_to = '2026-06-01' WHERE resource_type = 'employment';",
      'UPDATE company_resource_revisions SET attributes_json = \'{"employeeId":"employee:1","employmentType":"UNKNOWN"}\' WHERE resource_type = \'employment\';',
      'UPDATE company_resource_revisions SET attributes_json = \'{"employeeId":"employee:other","employmentType":"FULL_TIME"}\' WHERE resource_type = \'employment\';',
      "UPDATE company_resource_revisions SET organization_id = '01900060-0000-7000-8000-12268fccf2cc' WHERE resource_type = 'employment';",
      "UPDATE company_workforce_resource_bindings SET employee_id = 'employee:other' WHERE resource_type = 'employment';",
      "INSERT INTO company_workforce_resource_bindings VALUES ('employment', 'employment:1', '01900060-0000-7000-8000-12268fccf2cc', 'employee:1');",
      "DELETE FROM company_employment_period_versions;",
      "INSERT INTO company_employment_period_versions VALUES ('employment:1', 2, 'employee:1', '2026-01-01', '2026-10-01', 1);",
    ]) {
      expect(
        (await employmentAttributes(await attributeDatabase(mutation), "2026-08-01T00:00:00Z"))[0]
          ?.type,
      ).toBeNull()
    }
    expect(
      (await employmentAttributes(await attributeDatabase(), "2025-12-01T00:00:00Z"))[0]?.type,
    ).toBeNull()
  })

  test("人物履歴の欠落・取消・終了・重複・空の氏名を旧氏名で補わない", async () => {
    for (const mutation of [
      "DELETE FROM company_resource_revisions WHERE resource_type = 'person';",
      "UPDATE company_resource_revisions SET state = 'void' WHERE resource_type = 'person';",
      "UPDATE company_resource_revisions SET effective_to = '2026-06-01' WHERE resource_type = 'person';",
      "INSERT INTO company_workforce_resource_bindings VALUES ('employee', 'employee:1', '01900060-0000-7000-8000-e53d7d4223a9', 'employee:1');",
      "UPDATE company_resource_revisions SET attributes_json = '{\"officialName\":\" \"}' WHERE resource_type = 'person';",
    ]) {
      expect(
        (await employmentAttributes(await attributeDatabase(mutation), "2026-08-01T00:00:00Z"))[0]
          ?.name,
      ).toBeNull()
    }
  })

  test("未接続の雇用区分を旧台帳で補わず読取を拒否する", async () => {
    const database = await attributeDatabase(
      "DELETE FROM company_workforce_resource_bindings WHERE resource_type = 'employment';",
    )
    let failure: unknown
    try {
      await employmentAttributes(database, "2026-08-01T00:00:00Z")
    } catch (cause) {
      failure = cause
    }
    expect(failure).toBeInstanceOf(Error)
  })
})

describe("雇用状態の派生表", () => {
  test("未接続の雇用は絞り込みを通し、区分を読んだ文だけを失敗させる", async () => {
    const database = await attributeDatabase(
      "DELETE FROM company_workforce_resource_bindings WHERE resource_type = 'employment';",
    )
    const selected = alias(employments, "filtered_employment")
    const state = CompanyEmployeeDirectoryReadAdapter.employmentStateTable({
      asOf: restoreCalendarDate("2026-08-01"),
      alias: "filtered_employment_state",
    })
    const filtered = (where: ReturnType<typeof state.isEmploymentType>) =>
      drizzle(database)
        .select({ id: selected.id })
        .from(selected)
        .leftJoin(
          state.source,
          state.on({ employmentId: selected.id, employeeId: selected.employeeId }),
        )
        .where(where)
    expect(await filtered(state.hasEmploymentType)).toEqual([{ id: "employment:1" }])
    expect(await filtered(state.isEmploymentType("PART_TIME"))).toEqual([{ id: "employment:1" }])
    let failure: unknown
    try {
      await drizzle(database)
        .select({ type: state.employmentType })
        .from(selected)
        .leftJoin(
          state.source,
          state.on({ employmentId: selected.id, employeeId: selected.employeeId }),
        )
    } catch (cause) {
      failure = cause
    }
    expect(failure).toBeInstanceOf(Error)
  })

  test("接続済みの雇用は区分の一致だけを通し、重複した接続や開始前は通さない", async () => {
    const selected = alias(employments, "filtered_employment")
    for (const scenario of [
      { additional: "", date: "2026-08-01", has: true, fullTime: true, partTime: false },
      { additional: "", date: "2025-12-31", has: false, fullTime: false, partTime: false },
      {
        additional:
          "INSERT INTO company_workforce_resource_bindings VALUES ('employment', 'employment:1', '01900060-0000-7000-8000-e53d7d4223a9', 'employee:1');",
        date: "2026-08-01",
        has: false,
        fullTime: false,
        partTime: false,
      },
    ]) {
      const database = await attributeDatabase(scenario.additional)
      const state = CompanyEmployeeDirectoryReadAdapter.employmentStateTable({
        asOf: restoreCalendarDate(scenario.date),
        alias: "filtered_employment_state",
      })
      const count = async (where: ReturnType<typeof state.isEmploymentType>) =>
        (
          await drizzle(database)
            .select({ id: selected.id })
            .from(selected)
            .leftJoin(
              state.source,
              state.on({ employmentId: selected.id, employeeId: selected.employeeId }),
            )
            .where(where)
        ).length === 1
      expect({
        has: await count(state.hasEmploymentType),
        fullTime: await count(state.isEmploymentType("FULL_TIME")),
        partTime: await count(state.isEmploymentType("PART_TIME")),
      }).toEqual({ has: scenario.has, fullTime: scenario.fullTime, partTime: scenario.partTime })
    }
  })
})

describe("雇用IDごとの有効な在籍状態", () => {
  test("退職予約を現在値から読まず、退職日の翌日に状態を切り替える", async () => {
    const database = await createEmployeeEmploymentTestDatabase()
    expect(await employmentStatuses(database, "2026-09-30T14:59:59Z")).toEqual([
      { id: "employment:1", status: "ACTIVE" },
    ])
    expect(await employmentStatuses(database, "2026-09-30T15:00:00Z")).toEqual([
      { id: "employment:1", status: "TERMINATED" },
    ])
    expect(await employmentStatuses(database, "2025-12-31T00:00:00Z")).toEqual([
      { id: "employment:1", status: null },
    ])
  })

  test("将来の休職も開始日に切り替え、訂正された状態期間を優先する", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      UPDATE company_employments SET status = 'ON_LEAVE';
      INSERT INTO company_employee_status_period_versions VALUES
        ('status:1', 2, 'employment:1', 'employee:1', 'active', '2026-01-01', '2026-09-01', 0),
        ('status:leave', 1, 'employment:1', 'employee:1', 'leave', '2026-09-01', '2026-10-01', 0);
    `)
    expect(await employmentStatuses(database, "2026-08-31T14:59:59Z")).toEqual([
      { id: "employment:1", status: "ACTIVE" },
    ])
    expect(await employmentStatuses(database, "2026-08-31T15:00:00Z")).toEqual([
      { id: "employment:1", status: "ON_LEAVE" },
    ])
  })

  test("再入社予約と終了済み契約を取り違えず、別従業員の雇用も混ぜない", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employees VALUES ('employee:2', 'Another Person', 'E002', NULL, NULL);
      INSERT INTO company_workforce_resource_bindings VALUES
        ('employee', 'employee:2', '${COMPANY_DEFAULT_ORGANIZATION_ID}', 'employee:2');
      INSERT INTO company_resource_revisions VALUES
        ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'person', 'person:2', 1, 'active', '2026-01-01', NULL, '{"officialName":"Another Person"}'),
        ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'employee', 'employee:2', 1, 'active', '2026-01-01', NULL, '{"personId":"person:2","employeeCode":"E002"}');
      INSERT INTO company_employments VALUES ('employment:2', 'employee:2', 'ACTIVE', '2026-01-01', NULL), ('employment:rehire', 'employee:1', 'ACTIVE', '2026-12-01', NULL);
      INSERT INTO company_employment_period_versions VALUES ('employment:2', 1, 'employee:2', '2026-01-01', NULL, 0), ('employment:rehire', 1, 'employee:1', '2026-12-01', NULL, 0);
      INSERT INTO company_employee_status_period_versions VALUES ('status:2', 1, 'employment:2', 'employee:2', 'leave', '2026-01-01', NULL, 0), ('status:rehire', 1, 'employment:rehire', 'employee:1', 'active', '2026-12-01', NULL, 0);
    `)
    expect(await employmentStatuses(database, "2026-11-01T00:00:00Z")).toEqual([
      { id: "employment:1", status: "TERMINATED" },
      { id: "employment:2", status: "ON_LEAVE" },
      { id: "employment:rehire", status: null },
    ])
    expect(await employmentStatuses(database, "2026-12-01T00:00:00Z")).toEqual([
      { id: "employment:1", status: "TERMINATED" },
      { id: "employment:2", status: "ON_LEAVE" },
      { id: "employment:rehire", status: "ACTIVE" },
    ])
  })

  test("履歴欠落・状態重複・期間外・取消は表示用statusで補わない", async () => {
    for (const additional of [
      "DELETE FROM company_employment_period_versions;",
      "DELETE FROM company_employee_status_period_versions;",
      "INSERT INTO company_employee_status_period_versions VALUES ('status:overlap', 1, 'employment:1', 'employee:1', 'active', '2026-01-01', '2026-10-01', 0);",
      "UPDATE company_employee_status_period_versions SET starts_on = '2025-01-01';",
      "INSERT INTO company_employment_period_versions VALUES ('employment:1', 2, 'employee:1', '2026-01-01', '2026-10-01', 1);",
    ]) {
      const database = await createEmployeeEmploymentTestDatabase(additional)
      expect(await employmentStatuses(database, "2026-08-01T00:00:00Z")).toEqual([
        { id: "employment:1", status: null },
      ])
    }
  })

  test("雇用期間の重複では対象の契約を任意に選ばない", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employments VALUES ('employment:other', 'employee:1', 'ACTIVE', '2026-01-01', NULL);
      INSERT INTO company_employment_period_versions VALUES ('employment:other', 1, 'employee:1', '2026-01-01', NULL, 0);
      INSERT INTO company_employee_status_period_versions VALUES ('status:other', 1, 'employment:other', 'employee:1', 'active', '2026-01-01', NULL, 0);
    `)
    expect(await employmentStatuses(database, "2026-08-01T00:00:00Z")).toEqual([
      { id: "employment:1", status: null },
      { id: "employment:other", status: null },
    ])
  })
})

describe("Company directoryの在籍時点", () => {
  test("公開履歴に未接続の従業員が残る場合は一覧・単体・一括・Account参照を同じ読取の中で拒否する", async () => {
    const database = await createEmployeeEmploymentTestDatabase(publicAccountLinkSchema, false)
    const reader = directory(database, "2026-09-01T00:00:00Z")
    const employeeId = restoreWorkforceId("employee", "employee:1")
    const batch = spyOn(database, "batch")
    const prepare = spyOn(database, "prepare")
    for (const read of [
      reader.findById(employeeId),
      reader.list(page),
      reader.findForEmployeeIds([employeeId]),
      reader.findForAccountIds([zAccountId.parse(legacyAccount)]),
    ]) {
      const result = await read
      expect(result).toBeInstanceOf(Error)
      expect((result as Error).message).toBe("Company employee public binding is incomplete")
    }
    // 束縛の確認は読取と同じbatchに入り、別の往復を増やさない。
    expect(batch).toHaveBeenCalledTimes(4)
    expect(prepare.mock.calls.some(([query]) => /LIMIT 1\s*$/u.test(String(query)))).toBe(true)
    batch.mockRestore()
    prepare.mockRestore()
  })

  test("Employee IDの一括参照は重複を除き、100件を超えても指定した基準日を使う", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employees VALUES ('employee:200', 'Another Person', NULL, NULL, NULL);
      INSERT INTO company_workforce_resource_bindings VALUES
        ('employee', 'employee:200', '${COMPANY_DEFAULT_ORGANIZATION_ID}', 'employee:200');
      INSERT INTO company_resource_revisions VALUES
        ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'person', 'person:200', 1, 'active', '2026-01-01', NULL, '{"officialName":"Another Person"}'),
        ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'employee', 'employee:200', 1, 'active', '2026-01-01', NULL, '{"personId":"person:200","employeeCode":null}');
    `)
    const employeeId = restoreWorkforceId("employee", "employee:1")
    const ids = Array.from({ length: 201 }, (_, index) =>
      restoreWorkforceId("employee", `employee:${index}`),
    )
    const result = await new CompanyEmployeeDirectoryReadAdapter({
      env: { DB: database, NOW: "2026-12-01T00:00:00Z", COMPANY_TIME_ZONE: "Asia/Tokyo" },
      asOf: restoreCalendarDate("2026-09-01"),
    }).findForEmployeeIds([...ids, employeeId])
    expect(result).toMatchObject([
      { id: employeeId, employment: { status: "ACTIVE" } },
      { id: "employee:200", employment: null },
    ])
    expect(result).toHaveLength(2)
    expect(await directory(database, "2026-12-01T00:00:00Z").findForEmployeeIds([])).toEqual([])
  })

  test("Employee ID一括参照の一部が欠けた場合は成功分だけを返さない", async () => {
    const database = await createEmployeeEmploymentTestDatabase()
    const batch = database.batch.bind(database)
    const incomplete = spyOn(database, "batch").mockImplementation(
      async <T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> =>
        (await batch<T>(statements)).slice(0, -1),
    )
    try {
      const ids = Array.from({ length: 100 }, (_, index) =>
        restoreWorkforceId("employee", testDerivedId("employee", index)),
      )
      expect(
        await directory(database, "2026-09-01T00:00:00Z").findForEmployeeIds(ids),
      ).toBeInstanceOf(Error)
    } finally {
      incomplete.mockRestore()
    }
  })

  test("Accountの解決も同じ在籍と所属の終了境界を使う", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      ${publicAccountLinkSchema}
      ${publicAccountLink("c0975461-26d2-43a1-86d2-124bd000d9c9", "employee:1")}
      INSERT INTO company_organization_unit_period_versions VALUES
        ('unit-period:1', 1, '0190005f-0000-7000-8000-2fcb85764fe2', 'UNIT', 'Example Unit', '2026-01-01', '2026-10-01', 0);
      INSERT INTO company_organization_assignment_period_versions VALUES
        ('assignment:1', 1, 'employee:1', '0190005f-0000-7000-8000-2fcb85764fe2', 'PRIMARY', NULL, 'employment:1', '2026-01-01', '2026-10-01', 0);
    `)
    const accountId = zAccountId.parse("c0975461-26d2-43a1-86d2-124bd000d9c9")
    const before = await directory(database, "2026-09-30T14:59:59Z").findForAccountIds([
      accountId,
      accountId,
    ])
    expect(before).toMatchObject([
      {
        accountId,
        employee: {
          employment: { status: "ACTIVE" },
          primaryAssignment: { organizationUnitName: "Example Unit" },
        },
      },
    ])
    const after = await directory(database, "2026-09-30T15:00:00Z").findForAccountIds([accountId])
    expect(after).toMatchObject([
      {
        accountId,
        employee: {
          employment: { status: "TERMINATED" },
          primaryAssignment: null,
        },
      },
    ])
  })

  test("一つのAccountに複数の従業員がある場合は選ばずに拒否する", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      ${publicAccountLinkSchema}
      INSERT INTO company_employees VALUES ('employee:2', 'Another Person', 'E002', NULL, NULL);
      INSERT INTO company_workforce_resource_bindings VALUES
        ('employee', 'employee:2', '${COMPANY_DEFAULT_ORGANIZATION_ID}', 'employee:2');
      INSERT INTO company_resource_revisions VALUES
        ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'person', 'person:2', 1, 'active', '2026-01-01', NULL, '{"officialName":"Another Person"}'),
        ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'employee', 'employee:2', 1, 'active', '2026-01-01', NULL, '{"personId":"person:2","employeeCode":"E002"}');
      ${publicAccountLink("c0975461-26d2-43a1-86d2-124bd000d9c9", "employee:1", "link:1")}
      ${publicAccountLink("c0975461-26d2-43a1-86d2-124bd000d9c9", "employee:2", "link:2")}
    `)
    expect(
      await directory(database, "2026-09-01T00:00:00Z").findForAccountIds([
        zAccountId.parse("c0975461-26d2-43a1-86d2-124bd000d9c9"),
      ]),
    ).toBeInstanceOf(Error)
  })

  test("100件を超えるAccountも分割し、未紐付けは候補に含めない", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      ${publicAccountLinkSchema}
      ${publicAccountLink("6d819592-afad-4669-a64e-5ce92ac9809b", "employee:1")}
    `)
    const accountIds = Array.from({ length: 201 }, (_, index) =>
      zAccountId.parse(testDerivedId("account", index)),
    )
    expect(
      await directory(database, "2026-09-01T00:00:00Z").findForAccountIds(accountIds),
    ).toMatchObject([
      {
        accountId: "6d819592-afad-4669-a64e-5ce92ac9809b",
        employee: { employment: { status: "ACTIVE" } },
      },
    ])
  })

  test("旧対応表だけのAccountは従業員として解決しない", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      ${publicAccountLinkSchema}
      CREATE TABLE company_account_employee_links (account_id TEXT, employee_id TEXT);
      INSERT INTO company_account_employee_links VALUES ('${legacyAccount}', 'employee:1');
    `)
    expect(
      await directory(database, "2026-09-01T00:00:00Z").findForAccountIds([
        zAccountId.parse(legacyAccount),
      ]),
    ).toEqual([])
  })

  test("退職予約済みでも発効前は在籍し、発効後は退職と表示する", async () => {
    const database = await createEmployeeEmploymentTestDatabase()
    expect(await directory(database, "2026-09-30T14:59:59Z").findByCode("E001")).toMatchObject({
      employment: { id: "employment:1", status: "ACTIVE" },
    })
    expect(await directory(database, "2026-09-30T15:00:00Z").findByCode("E001")).toMatchObject({
      employment: { id: "employment:1", status: "TERMINATED" },
    })
  })

  test("一覧の状態フィルタと件数も期間履歴に一致する", async () => {
    const database = await createEmployeeEmploymentTestDatabase()
    const reader = directory(database, "2026-09-01T00:00:00Z")
    expect(await reader.list({ ...page, status: "active" })).toMatchObject({
      total: 1,
      employees: [{ id: "employee:1", employment: { status: "ACTIVE" } }],
    })
    expect(await reader.list({ ...page, status: "retired" })).toEqual({ total: 0, employees: [] })
  })

  test("将来の再雇用予約を現在の雇用として表示しない", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employments VALUES
        ('employment:rehire', 'employee:1', 'ACTIVE', '2026-12-01', NULL);
      INSERT INTO company_employment_period_versions VALUES
        ('employment:rehire', 1, 'employee:1', '2026-12-01', NULL, 0);
      INSERT INTO company_employee_status_period_versions VALUES
        ('status:rehire', 1, 'employment:rehire', 'employee:1', 'active', '2026-12-01', NULL, 0);
    `)
    expect(await directory(database, "2026-10-01T00:00:00Z").findByCode("E001")).toMatchObject({
      employment: { id: "employment:1", status: "TERMINATED" },
    })
    expect(await directory(database, "2026-12-01T00:00:00Z").findByCode("E001")).toMatchObject({
      employment: { id: "employment:rehire", status: "ACTIVE" },
    })
  })

  test("初回入社前の人を在籍中として表示しない", async () => {
    const database = await createEmployeeEmploymentTestDatabase()
    expect(await directory(database, "2025-12-31T00:00:00Z").findByCode("E001")).toBeNull()
  })

  test("最新訂正で取り消した雇用を表示用tableから復活させない", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employment_period_versions VALUES
        ('employment:1', 2, 'employee:1', '2026-01-01', '2026-10-01', 1);
    `)
    expect(await directory(database, "2026-09-01T00:00:00Z").findByCode("E001")).toMatchObject({
      employment: null,
    })
  })

  test("雇用中の状態が欠落した場合は一覧と単体の両方をエラーにする", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employee_status_period_versions VALUES
        ('status:1', 2, 'employment:1', 'employee:1', 'active', '2026-01-01', '2026-10-01', 1);
    `)
    const reader = directory(database, "2026-09-01T00:00:00Z")
    expect(await reader.findByCode("E001")).toBeInstanceOf(Error)
    expect(await reader.list({ ...page, status: "active" })).toBeInstanceOf(Error)
  })

  test("重複する雇用状態を一件に丸めずエラーにする", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employee_status_period_versions VALUES
        ('status:duplicate', 1, 'employment:1', 'employee:1', 'leave', '2026-07-01', '2026-10-01', 0);
    `)
    const reader = directory(database, "2026-09-01T00:00:00Z")
    expect(await reader.findByCode("E001")).toBeInstanceOf(Error)
    expect(await reader.list(page)).toBeInstanceOf(Error)
  })

  test("主務が重複する場合は先頭の所属だけを返さない", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_organization_unit_period_versions VALUES
        ('unit-period:1', 1, '0190005f-0000-7000-8000-2fcb85764fe2', 'UNIT', 'Example Unit', '2026-01-01', NULL, 0);
      INSERT INTO company_organization_assignment_period_versions VALUES
        ('assignment:1', 1, 'employee:1', '0190005f-0000-7000-8000-2fcb85764fe2', 'PRIMARY', NULL, 'employment:1', '2026-01-01', NULL, 0),
        ('assignment:2', 1, 'employee:1', '0190005f-0000-7000-8000-2fcb85764fe2', 'PRIMARY', NULL, 'employment:1', '2026-01-01', NULL, 0);
    `)
    const reader = directory(database, "2026-09-01T00:00:00Z")
    expect(await reader.findByCode("E001")).toBeInstanceOf(Error)
    expect(await reader.list(page)).toBeInstanceOf(Error)
  })
})

function employeeNamesReader(
  props: Omit<Parameters<typeof CompanyEmployeeDirectoryReadAdapter.findNames>[0], "employeeIds">,
) {
  return {
    findForEmployeeIds: (
      employeeIds: ReadonlyArray<ReturnType<typeof restoreWorkforceId<"employee">>>,
    ) => CompanyEmployeeDirectoryReadAdapter.findNames({ ...props, employeeIds }),
  }
}

const employeeId = restoreWorkforceId("employee", "employee:1")
const history = `
  UPDATE company_employees SET official_name = 'Future Person';
  INSERT INTO company_workforce_resource_bindings VALUES
    ('employee', 'employee:1', '${COMPANY_DEFAULT_ORGANIZATION_ID}', 'employee:1');
  INSERT INTO company_resource_revisions VALUES
    ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'employee', 'employee:1', 1, 'active', '2026-01-01', NULL, '{"personId":"person:1"}'),
    ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'person', 'person:1', 1, 'active', '2026-01-01', NULL, '{"officialName":"Current Person"}'),
    ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'person', 'person:1', 2, 'active', '2026-07-01', NULL, '{"officialName":"Future Person"}');
`

describe("Company従業員名の期間参照", () => {
  test("D1とDrizzleで同じ会社営業日に切り替え、同日の訂正を優先する", async () => {
    const database = await createEmployeeEmploymentTestDatabase(
      history +
        `
      INSERT INTO company_resource_revisions VALUES
        ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'person', 'person:1', 3, 'active', '2026-07-01', NULL, '{"officialName":"Corrected Person"}');
    `,
      false,
    )
    for (const source of [database, drizzle(database)]) {
      for (const instant of ["2026-06-30T14:59:59Z", "2026-06-30T15:00:00Z"]) {
        const names = await employeeNamesReader({
          database: source,
          now: instant,
          timeZone: "Asia/Tokyo",
        }).findForEmployeeIds([employeeId, employeeId])
        if (names instanceof Error) throw names
        expect(names.size).toBe(1)
        expect(names.get(employeeId)).toBe(
          instant.endsWith("14:59:59Z") ? "Current Person" : "Corrected Person",
        )
      }
    }
    expect(
      await database
        .prepare("SELECT official_name FROM company_employees")
        .first<string>("official_name"),
    ).toBe("Future Person")
    expect(
      await database
        .prepare("SELECT count(*) AS total FROM company_resource_revisions")
        .first<number>("total"),
    ).toBe(4)
  })

  test("接続済みの開始前・期間終了・人物取消では旧氏名へ戻さない", async () => {
    for (const suffix of [
      "UPDATE company_resource_revisions SET effective_to = '2026-07-01' WHERE resource_type = 'employee';",
      "UPDATE company_resource_revisions SET state = 'cancelled' WHERE resource_type = 'person' AND revision = 2;",
      "DELETE FROM company_resource_revisions WHERE resource_type = 'person';",
    ]) {
      const database = await createEmployeeEmploymentTestDatabase(history + suffix, false)
      for (const now of ["2025-12-31T00:00:00Z", "2026-07-01T00:00:00Z"]) {
        const names = await employeeNamesReader({
          database,
          now,
          timeZone: "Asia/Tokyo",
        }).findForEmployeeIds([employeeId])
        expect(names).toEqual(new Map())
      }
    }
  })

  test("未接続の従業員名は旧台帳で補わず、201件の参照を拒否する", async () => {
    const database = await createEmployeeEmploymentTestDatabase("", false)
    const ids = Array.from({ length: 201 }, (_, index) =>
      restoreWorkforceId("employee", `employee:${index}`),
    )
    const names = await employeeNamesReader({
      database,
      now: "2026-07-01T00:00:00Z",
      timeZone: "Asia/Tokyo",
    }).findForEmployeeIds([...ids, employeeId])
    expect(names).toBeInstanceOf(Error)
  })

  test("空の参照はDB・時計を使用せず、非空なら不明なtimezoneを拒否する", async () => {
    const database = await createEmployeeEmploymentTestDatabase()
    const prepare = spyOn(database, "prepare")
    try {
      for (const timeZone of [undefined, "Invalid/Zone"]) {
        const repository = employeeNamesReader({
          database,
          now: "2026-07-01T00:00:00Z",
          timeZone,
        })
        expect(await repository.findForEmployeeIds([])).toEqual(new Map())
        expect(await repository.findForEmployeeIds([employeeId])).toBeInstanceOf(Error)
      }
      expect(prepare).not.toHaveBeenCalled()
    } finally {
      prepare.mockRestore()
    }
  })

  test("同じ従業員への重複した公開対応は一つを選ばず拒否する", async () => {
    const database = await createEmployeeEmploymentTestDatabase(
      history +
        `
      INSERT INTO company_workforce_resource_bindings VALUES
        ('employee', 'employee:1', '${COMPANY_DEFAULT_ORGANIZATION_ID}', 'employee:1');
    `,
    )
    expect(
      await employeeNamesReader({
        database,
        now: "2026-07-01T00:00:00Z",
        timeZone: "Asia/Tokyo",
      }).findForEmployeeIds([employeeId]),
    ).toBeInstanceOf(Error)
  })

  test("旧氏名の変更を公開履歴へ混ぜず、DB障害では部分結果を返さない", async () => {
    const database = await createEmployeeEmploymentTestDatabase(
      "UPDATE company_employees SET official_name = '';",
    )
    const repository = employeeNamesReader({
      database,
      now: "2026-07-01T00:00:00Z",
      timeZone: "Asia/Tokyo",
    })
    expect(await repository.findForEmployeeIds([employeeId])).toEqual(
      new Map([[employeeId, "Example Person"]]),
    )
    const outage = spyOn(database, "prepare").mockImplementation(() => {
      throw new Error("Database unavailable")
    })
    try {
      expect(await repository.findForEmployeeIds([employeeId])).toBeInstanceOf(Error)
    } finally {
      outage.mockRestore()
    }
  })
})
