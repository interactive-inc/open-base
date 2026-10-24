import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { drizzle } from "drizzle-orm/d1"
import { z } from "zod"
import { UpdateOrganizationUnit } from "@/contexts/company/application/organization/update-organization-unit"
import { DeleteOrganizationUnit } from "@/contexts/company/application/organization/delete-organization-unit"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import {
  CompanyConflictError,
  CompanyForbiddenError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import { OrganizationWorkforceChangeRepository } from "@/contexts/company/infrastructure/repositories/organization/organization-workforce-change.repository"
import { createEmployeeAdoptionFixture } from "@/contexts/company/test/employee-resource-adoption.test-support"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const observedSchema = z.object({
  name: z.string(),
  organization_revision: z.number(),
  as_of: z.string(),
})

async function fixture() {
  const base = await createEmployeeAdoptionFixture()
  const adoption = await base.post(await base.input(), "observed-edit-employee-adoption")
  if (adoption.status !== 200) throw new Error(`employee adoption failed: ${adoption.status}`)
  const company: CompanyContext = {
    env: base.environment,
    var: {
      database: drizzle(base.database),
      auditContext: {
        requestId: crypto.randomUUID(),
        clientName: "api",
        clientIp: null,
        externalRequestId: null,
      },
    },
  }
  const path = "/company/organization-units/OBSERVED"
  const request = (method: string, target: string, key: string, body?: unknown) =>
    base.app.request(
      target,
      {
        method,
        headers: {
          "content-type": "application/json",
          // 既存の組織APIは冪等キーを操作IDに使うため、名前付きキーを同じ UUID へ写す。
          "idempotency-key": deterministicCompanyId("test-operation", key),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
      base.environment,
    )
  expect(
    (
      await request("POST", "/company/organization-units", "create-observed", {
        code: "OBSERVED",
        name: "Confirmed name",
        parent_code: null,
      })
    ).status,
  ).toBe(201)
  const read = async () => {
    const response = await request("GET", path, "read")
    expect(response.status).toBe(200)
    return observedSchema.parse(await response.json())
  }
  const observe = async () => {
    const observed = await read()
    return {
      expected_organization_revision: observed.organization_revision,
      expected_as_of: observed.as_of,
    }
  }
  const mutate = (
    method: "PUT" | "DELETE",
    expectation: Awaited<ReturnType<typeof observe>>,
    key: string,
    name = "Another person's change",
  ) =>
    request(method, path, key, {
      ...expectation,
      ...(method === "PUT" ? { name, parent_code: null } : {}),
    })
  const state = () =>
    base.database
      .prepare(`SELECT
    (SELECT revision FROM company_organization_lifecycle_states WHERE id = 1) AS revision,
    (SELECT count(*) FROM company_organization_unit_period_versions) AS periods,
    (SELECT count(*) FROM company_organization_change_operations) AS operations,
    (SELECT count(*) FROM company_resource_revisions) AS resources,
    (SELECT count(*) FROM company_command_receipts) AS receipts`)
      .first()
  return { ...base, company, request, path, read, observe, mutate, state }
}

describe("organization edits preserve the version the caller observed", () => {
  test("一覧と詳細が同じ組織版と会社営業日を返す", async () => {
    const f = await fixture()
    const detail = await f.read()
    const response = await f.request("GET", "/company/organization-units", "list")
    expect(response.status).toBe(200)
    const listed = z.array(observedSchema).parse(await response.json())
    expect(listed).toContainEqual(detail)
    expect(detail.as_of).toBe("2026-09-07")
  })

  for (const method of ["PUT", "DELETE"] as const) {
    test(`${method}: 確認後に変更された組織を上書き・取消しせず、再確認後にだけ保存する`, async () => {
      const f = await fixture()
      const observed = await f.observe()
      expect((await f.mutate("PUT", observed, "first-editor")).status).toBe(200)
      const before = await f.state()
      const stale = await f.mutate(
        method,
        observed,
        "stale-editor",
        "Would overwrite the confirmed change",
      )
      expect(stale.status).toBe(409)
      expect(await stale.json()).toMatchObject({ code: "personnel_action_stale" })
      expect(await f.state()).toEqual(before)
      expect((await f.read()).name).toBe("Another person's change")
      expect(
        (await f.mutate(method, await f.observe(), "stale-editor", "Confirmed again")).status,
      ).toBe(method === "PUT" ? 200 : 204)
    })

    test(`${method}: 会社営業日をまたいだ未成功の依頼を拒否する`, async () => {
      const f = await fixture()
      f.clock.now = new Date("2026-09-07T14:59:59Z")
      const observed = await f.observe()
      const before = await f.state()
      f.clock.now = new Date("2026-09-07T15:00:00Z")
      const latest = await f.observe()
      expect(latest.expected_organization_revision).toBe(observed.expected_organization_revision)
      expect(latest.expected_as_of).toBe("2026-09-08")
      expect((await f.mutate(method, observed, "midnight")).status).toBe(409)
      expect(await f.state()).toEqual(before)
      expect((await f.mutate(method, latest, "midnight")).status).toBe(method === "PUT" ? 200 : 204)
    })

    test(`${method}: 成功済みの同一依頼は後日も再実行せず、確認条件の変更と失権は拒否する`, async () => {
      const f = await fixture()
      const observed = await f.observe()
      const expectedStatus = method === "PUT" ? 200 : 204
      expect((await f.mutate(method, observed, "completed")).status).toBe(expectedStatus)
      if (method === "PUT")
        expect(
          (await f.mutate("PUT", await f.observe(), "later", "Later confirmed name")).status,
        ).toBe(200)
      const before = await f.state()
      f.clock.now = new Date("2026-09-09T00:00:00Z")
      expect((await f.mutate(method, observed, "completed")).status).toBe(expectedStatus)
      for (const changed of [
        {
          ...observed,
          expected_organization_revision: observed.expected_organization_revision + 1,
        },
        { ...observed, expected_as_of: "2026-09-09" },
      ]) {
        const response = await f.mutate(method, changed, "completed")
        expect(response.status).toBe(409)
        expect(await response.json()).toMatchObject({ code: "idempotency_conflict" })
      }
      f.actors.current = CompanyActorValue.restore({
        accountId: f.actor.accountId,
        employeeId: f.actor.employeeId,
        organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
        capabilities: ["company:read"],
      })
      expect((await f.mutate(method, observed, "completed")).status).toBe(403)
      expect(await f.state()).toEqual(before)
    })

    test(`${method}: 版・日付の省略や不正値では保存しない`, async () => {
      const f = await fixture()
      const observed = await f.observe()
      const before = await f.state()
      for (const invalid of [
        {},
        { ...observed, expected_organization_revision: -1 },
        { ...observed, expected_organization_revision: 1.5 },
        { ...observed, expected_organization_revision: Number.MAX_SAFE_INTEGER + 1 },
        {
          ...observed,
          expected_organization_revision: String(observed.expected_organization_revision),
        },
        { ...observed, expected_as_of: "2026-02-30" },
        { ...observed, expected_as_of: undefined },
      ]) {
        const response = await f.request(method, f.path, "invalid", {
          name: "Invalid",
          parent_code: null,
          ...invalid,
        })
        expect(response.status).toBe(400)
      }
      expect(await f.state()).toEqual(before)
    })

    test(`${method}: 最初の照会後に同じ依頼が確定しても保存済み結果を返す`, async () => {
      const f = await fixture()
      const observed = await f.observe()
      const company = f.company
      const repository = new OrganizationWorkforceChangeRepository(company)
      const readSnapshot = repository.readSnapshot.bind(repository)
      const interception = spyOn(
        OrganizationWorkforceChangeRepository.prototype,
        "readSnapshot",
      ).mockImplementationOnce(async (asOf) => {
        expect((await f.mutate(method, observed, "racing-replay")).status).toBe(
          method === "PUT" ? 200 : 204,
        )
        return readSnapshot(asOf)
      })
      try {
        expect((await f.mutate(method, observed, "racing-replay")).status).toBe(
          method === "PUT" ? 200 : 204,
        )
      } finally {
        interception.mockRestore()
      }
      expect(
        await f.database
          .prepare(
            "SELECT count(*) AS count FROM company_organization_change_operations WHERE id = ?1",
          )
          .bind(deterministicCompanyId("test-operation", "racing-replay"))
          .first<number>("count"),
      ).toBe(1)
    })

    test(`${method}: 同じ版からの別依頼は一つだけ確定する`, async () => {
      const f = await fixture()
      const observed = await f.observe()
      const responses = await Promise.all([
        f.mutate(method, observed, "parallel-one"),
        f.mutate(method, observed, "parallel-two"),
      ])
      expect(
        responses.map((response) => response.status).toSorted((left, right) => left - right),
      ).toEqual([method === "PUT" ? 200 : 204, 409])
    })
  }

  test("HTTP以外からの呼び出しでも確認条件と現在の権限を検査する", async () => {
    const f = await fixture()
    const observed = await f.observe()
    const company = f.company
    const repository = new OrganizationWorkforceChangeRepository(company)
    const input = {
      operationId: "a8d9afb7-6c37-41bd-a661-e97cf1d26265",
      code: "OBSERVED",
      officialName: "Direct",
      parentCode: null,
      expectedOrganizationRevision: observed.expected_organization_revision,
      expectedAsOf: observed.expected_as_of,
      now: f.clock.now,
    }
    expect((await f.mutate("PUT", observed, "intervening")).status).toBe(200)
    const before = await f.state()
    for (const operation of [UpdateOrganizationUnit, DeleteOrganizationUnit]) {
      const application = new operation({ actor: f.actor, company, repository })
      expect(await application.execute(input)).toBeInstanceOf(CompanyConflictError)
      expect(
        await application.execute({ ...input, expectedOrganizationRevision: -1 }),
      ).toBeInstanceOf(CompanyValidationError)
      expect(await application.execute({ ...input, expectedAsOf: "2026-02-30" })).toBeInstanceOf(
        CompanyValidationError,
      )
      const actor = CompanyActorValue.restore({
        accountId: f.actor.accountId,
        employeeId: null,
        organizationIds: ["01900060-0000-7000-8000-12268fccf2cc"],
        capabilities: ["company:admin"],
      })
      expect(await new operation({ actor, company, repository }).execute(input)).toBeInstanceOf(
        CompanyForbiddenError,
      )
    }
    expect(await f.state()).toEqual(before)
  })
})
