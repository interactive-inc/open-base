import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { AccountEmployeeLinkReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/account-employee-link-read.adapter"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { OrganizationWorkforceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-workforce-snapshot.adapter"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import * as links from "@/contexts/company/interface/routes/company.account-employee-links"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture() {
  const f = await createGovernanceTaskTestContext()
  const person = f.people[1]!
  const source = f.resources.find(
    (entry) =>
      entry.type === "account-employee-link" && entry.attributes.accountId === person.accountId,
  )
  if (source === undefined) throw new Error("account link fixture missing")
  const resource = {
    ...source,
    type: "account-employee-link",
    attributes: { accountId: person.accountId, employeeId: person.employeeId },
  } satisfies CompanyResourceProps
  let actor: CompanyActorValue | undefined = CompanyActorValue.restore({
    ...f.creator,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: ["company:admin"],
  })
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (c, next) => {
    if (actor !== undefined) c.set("companyActor", actor)
    c.set("companyClock", () => f.at)
    c.set("database", f.context.var.database)
    c.set("auditContext", f.context.var.auditContext)
    await next()
  })
  app.onError((error, c) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return c.json({ code: error.code }, error.status)
  })
  const routes = app.get("/links", ...links.GET).post("/links", ...links.POST)
  const client = hc<typeof routes>("http://localhost", {
    fetch: Object.assign(
      async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
        routes.request(input, init, f.context.env),
      { preconnect: fetch.preconnect },
    ),
  })
  const revision = async () => {
    const value = await f.database
      .prepare(
        `SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
      )
      .first<number>("revision")
    if (value === null) throw new Error("Company revision missing")
    return value
  }
  type Resource = Parameters<typeof client.links.$post>[0]["json"]["resources"][number]
  const post = async (
    next: Resource,
    key: string = crypto.randomUUID(),
    expectedRevision?: number,
  ) =>
    client.links.$post({
      header: {
        "x-company-organization-id": next.organizationId,
        "idempotency-key": key,
        "if-match": String(expectedRevision ?? (await revision())),
      },
      json: { reason: "Confirm Account correspondence period", resources: [next] },
    })
  const persisted = () =>
    f.database
      .prepare(`SELECT json_array(
    (SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'),
    (SELECT count(*) FROM company_resource_revisions), (SELECT count(*) FROM company_resource_heads),
    (SELECT count(*) FROM company_command_receipts), (SELECT count(*) FROM company_account_employee_links),
    (SELECT count(*) FROM company_account_employee_resource_bindings)) AS snapshot`)
      .first<string>("snapshot")
  const expectPresence = async (date: string, present: boolean) => {
    const asOf = restoreCalendarDate(date)
    const found = await new AccountEmployeeLinkReadAdapter(f.context).find({
      kind: "by_account",
      accountId: restoreWorkforceId("system_account", person.accountId),
      asOf,
    })
    expect(found).toMatchObject({ ok: true, records: present ? [{ link: person }] : [] })
    const directory = await new CompanyEmployeeDirectoryReadAdapter({
      env: f.context.env,
      asOf,
    }).findForAccountIds([person.accountId])
    if (directory instanceof Error) throw directory
    expect(directory.map((entry) => entry.employee.id)).toEqual(present ? [person.employeeId] : [])
    const snapshot = await new OrganizationWorkforceSnapshotAdapter(f.context).readAllSnapshot(asOf)
    if (!snapshot.ok) throw snapshot.cause
    expect(
      snapshot.schedules.find((entry) => entry.employee.id === person.employeeId)?.accountLink,
    ).toEqual(
      present
        ? { ...person, accountId: restoreWorkforceId("system_account", person.accountId) }
        : null,
    )
    const published = await new D1CompanyResourceRepository({ database: f.database }).findMany({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      types: ["account-employee-link"],
      ids: [resource.id],
      effectiveOn: asOf,
    })
    if (!published.ok) throw published.cause
    expect(published.resources.length).toBe(present ? 1 : 0)
  }
  return {
    ...f,
    person,
    resource,
    client,
    revision,
    post,
    persisted,
    expectPresence,
    setActor: (next: CompanyActorValue | undefined) => {
      actor = next
    },
  }
}

describe("Account対応の公開履歴と会社の参照", () => {
  test("公開対応の取消後に既存の不変な対応表から資格を復活させない", async () => {
    const f = await fixture()
    await f.expectPresence("2030-01-01", true)
    expect(Number((await f.post({ ...f.resource, revision: 2, state: "void" })).status)).toBe(201)
    await f.expectPresence("2030-01-01", false)
    expect(
      await f.database
        .prepare("SELECT employee_id FROM company_account_employee_links WHERE account_id = ?1")
        .bind(f.person.accountId)
        .first<string>("employee_id"),
    ).toBe(f.person.employeeId)
  })
  test("将来の終了と再開、終了日の訂正で同じ日付の公開API・名簿・資格が一致する", async () => {
    const f = await fixture()
    const end = {
      ...f.resource,
      revision: 2,
      effectiveFrom: "2030-07-01",
      state: "void",
    } satisfies Parameters<typeof f.post>[0]
    expect(Number((await f.post(end)).status)).toBe(201)
    await f.expectPresence("2030-06-30", true)
    await f.expectPresence("2030-07-01", false)
    expect(
      Number((await f.post({ ...f.resource, revision: 3, effectiveFrom: "2030-09-01" })).status),
    ).toBe(201)
    await f.expectPresence("2030-08-31", false)
    await f.expectPresence("2030-09-01", true)
    expect(
      Number(
        (
          await f.post({
            ...f.resource,
            revision: 4,
            effectiveFrom: "2030-07-01",
            effectiveTo: "2030-08-01",
          })
        ).status,
      ),
    ).toBe(201)
    await f.expectPresence("2030-07-31", true)
    await f.expectPresence("2030-08-01", false)
    await f.expectPresence("2030-09-01", true)
    const before = new AccountEmployeeLinkReadAdapter({
      ...f.context,
      env: { ...f.context.env, NOW: "2030-07-31T14:59:59Z" },
    })
    const after = new AccountEmployeeLinkReadAdapter({
      ...f.context,
      env: { ...f.context.env, NOW: "2030-07-31T15:00:00Z" },
    })
    const query = {
      kind: "by_account",
      accountId: restoreWorkforceId("system_account", f.person.accountId),
    } satisfies Parameters<typeof before.find>[0]
    expect(await before.find(query)).toMatchObject({ records: [{ link: f.person }] })
    expect(await after.find(query)).toMatchObject({ records: [] })
  })
  test("別の相手への付替えと別IDによる重複登録、存在しないAccountを拒否する", async () => {
    const f = await fixture()
    const before = await f.persisted()
    for (const next of [
      {
        ...f.resource,
        revision: 2,
        attributes: { ...f.resource.attributes, employeeId: f.people[2]!.employeeId },
      },
      {
        ...f.resource,
        revision: 2,
        attributes: { ...f.resource.attributes, accountId: f.people[2]!.accountId },
      },
      { ...f.resource, id: "link:duplicate" },
      {
        ...f.resource,
        revision: 2,
        attributes: { ...f.resource.attributes, accountId: "edc7ed60-7891-449f-a5fe-4f9e49b81a2a" },
      },
      { ...f.resource, effectiveFrom: "2020-01-01", revision: 2 },
    ]) {
      expect(Number((await f.post(next)).status)).toBe(422)
      expect(await f.persisted()).toBe(before)
    }
    await f.expectPresence("2030-01-01", true)
  })
  test("同時再送と異なるキーの競合で対応の改訂は一度だけ保存する", async () => {
    const f = await fixture()
    const expectedRevision = await f.revision()
    const next = { ...f.resource, revision: 2, effectiveTo: "2030-07-01" }
    expect(
      (
        await Promise.all([
          f.post(next, "link:retry", expectedRevision),
          f.post(next, "link:retry", expectedRevision),
        ])
      )
        .map((response) => Number(response.status))
        .sort((a, b) => a - b),
    ).toEqual([200, 201])
    const saved = await f.persisted()
    expect(
      Number(
        (await f.post({ ...next, effectiveTo: "2030-08-01" }, "link:retry", expectedRevision))
          .status,
      ),
    ).toBe(409)
    expect(await f.persisted()).toBe(saved)
    const revision = await f.revision()
    const later = { ...next, revision: 3, effectiveTo: "2030-09-01" }
    expect(
      (
        await Promise.all([
          f.post(later, "link:first", revision),
          f.post(later, "link:other", revision),
        ])
      )
        .map((response) => Number(response.status))
        .sort((a, b) => a - b),
    ).toEqual([201, 409])
  })
  test("新しい対応の保存失敗で公開履歴・対応・証跡を全て戻し、再試行できる", async () => {
    const f = await fixture()
    const common = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      revision: 1,
      state: "active",
      effectiveFrom: restoreCalendarDate("2030-01-01"),
      effectiveTo: null,
    } satisfies Omit<typeof f.resource, "type" | "id" | "attributes">
    await f.write([
      {
        ...common,
        type: "person",
        id: "person:new-link",
        attributes: { officialName: "Example Person", email: null, phone: null },
      },
      {
        ...common,
        type: "employee",
        id: "7e872dde-51a8-4551-a45f-35639886d177",
        attributes: { personId: "person:new-link", employeeCode: "LINK-NEW" },
      },
      {
        ...common,
        type: "employment",
        id: "4b5c6d7e-8f9a-4b0c-9d1e-2f3a4b5c6d7e",
        attributes: {
          employeeId: "7e872dde-51a8-4551-a45f-35639886d177",
          employmentType: "FULL_TIME",
          status: "ACTIVE",
        },
      },
    ])
    const next = {
      ...common,
      type: "account-employee-link",
      id: "5c6d7e8f-9a0b-4c1d-8e2f-3a4b5c6d7e8f",
      attributes: {
        accountId: "58dc1933-304b-4601-992a-beed89f1b842",
        employeeId: "7e872dde-51a8-4551-a45f-35639886d177",
      },
    } satisfies Parameters<typeof f.post>[0]
    const withoutAccount = await f.persisted()
    expect(Number((await f.post(next, "link:missing-account")).status)).toBe(422)
    expect(await f.persisted()).toBe(withoutAccount)
    await f.database
      .prepare(
        "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('58dc1933-304b-4601-992a-beed89f1b842', 'active', 0, 0, 0)",
      )
      .run()
    const before = await f.persisted()
    const revision = await f.revision()
    await execSql(
      f.database,
      "CREATE TRIGGER reject_account_link BEFORE INSERT ON company_account_employee_resource_bindings BEGIN SELECT RAISE(ABORT, 'injected link failure'); END;",
    )
    expect(Number((await f.post(next, "link:create", revision)).status)).toBe(503)
    expect(await f.persisted()).toBe(before)
    await execSql(f.database, "DROP TRIGGER reject_account_link")
    expect(Number((await f.post(next, "link:create", revision)).status)).toBe(201)
    const saved = await f.persisted()
    expect(Number((await f.post(next, "link:create", revision)).status)).toBe(200)
    expect(await f.persisted()).toBe(saved)
    expect(
      await new CompanyEmployeeDirectoryReadAdapter({
        env: f.context.env,
        asOf: restoreCalendarDate("2030-01-01"),
      }).findForAccountIds([zAccountId.parse("58dc1933-304b-4601-992a-beed89f1b842")]),
    ).toMatchObject([{ employee: { id: "7e872dde-51a8-4551-a45f-35639886d177" } }])
    for (const sql of [
      "UPDATE company_account_employee_resource_bindings SET account_id = 'account:changed'",
      "DELETE FROM company_account_employee_resource_bindings",
    ]) {
      expect(
        await f.database
          .prepare(sql)
          .run()
          .catch((cause: unknown) => cause),
      ).toBeInstanceOf(Error)
    }
  })
  test("変更と成功済み再送でもCompanyの操作資格とorganizationを再検査する", async () => {
    const f = await fixture()
    const revision = await f.revision()
    const next = { ...f.resource, revision: 2, effectiveTo: "2030-07-01" }
    expect(Number((await f.post(next, "link:authorized", revision)).status)).toBe(201)
    const saved = await f.persisted()
    for (const [actor, status] of [
      [undefined, 401],
      [
        CompanyActorValue.restore({
          ...f.creator,
          organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
          capabilities: ["company:read"],
        }),
        403,
      ],
      [
        CompanyActorValue.restore({
          ...f.creator,
          organizationIds: ["01900060-0000-7000-8000-12268fccf2cc"],
          capabilities: ["company:admin"],
        }),
        403,
      ],
    ] satisfies ReadonlyArray<readonly [CompanyActorValue | undefined, number]>) {
      f.setActor(actor)
      expect(Number((await f.post(next, "link:authorized", revision)).status)).toBe(status)
      expect(await f.persisted()).toBe(saved)
    }
  })
})
