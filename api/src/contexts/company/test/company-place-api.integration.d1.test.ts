import { expect, setDefaultTimeout, test } from "bun:test"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { createCompanyPlaceTestContext } from "@/contexts/company/test/company-place.test-support"
import { createCompanyPlaceHttpTestClient } from "@/contexts/company/test/company-place-http.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test.each(["legalEntity", "site", "unit"] as const)(
  "公開APIは %s の単独短縮を422とし、関連記録の同時短縮を確定する",
  async (kind) => {
    const f = await createCompanyPlaceTestContext()
    const request = createCompanyPlaceHttpTestClient(f.database)
    const created = await request({
      path: "/company/organization-changes",
      resources: f.resources,
      revision: 0,
    })
    expect({ status: created.status, body: await created.json() }).toMatchObject({ status: 201 })
    const before = await f.saved()
    const target = { ...f[kind], revision: 2, effectiveTo: restoreCalendarDate("2030-07-01") }
    const path =
      kind === "legalEntity"
        ? "/company/profile"
        : kind === "site"
          ? "/company/definitions"
          : "/company/organization-changes"
    const rejected = await request({ path, resources: [target], revision: 1 })
    expect(rejected.status).toBe(422)
    expect(await f.saved()).toEqual(before)
    const resources = f.resources
      .map((resource) => ({ ...resource, revision: 2, effectiveTo: target.effectiveTo }))
      .toReversed()
    const accepted = await request({
      path: "/company/organization-changes",
      resources,
      revision: 1,
    })
    expect({ status: accepted.status, body: await accepted.json() }).toMatchObject({
      status: 201,
      body: { organizationRevision: 2, replayed: false },
    })
    const saved = await f.saved()
    expect(
      (await request({ path: "/company/organization-changes", resources, revision: 1 })).status,
    ).toBe(200)
    expect(await f.saved()).toEqual(saved)
    expect(
      (
        await request({
          path: "/company/organization-changes",
          resources,
          revision: 1,
          commandId: "different-command",
        })
      ).status,
    ).toBe(409)
    expect(await f.saved()).toEqual(saved)
  },
)

test.each(["missing-site", "missing-unit"])(
  "公開定義APIは存在しない勤務場所の参照を422にする: %s",
  async (kind) => {
    const f = await createCompanyPlaceTestContext()
    expect(
      await f.write({ resources: [f.legalEntity, f.site, f.unit], expectedRevision: 0 }),
    ).toMatchObject({ kind: "applied" })
    const before = await f.saved()
    const attributes = {
      ...f.workplace.attributes,
      siteId: kind === "missing-site" ? "site:missing" : f.site.id,
      organizationUnitId:
        kind === "missing-unit"
          ? "0190005f-0000-7000-8000-ccdf3ed2f2b6"
          : "0190005f-0000-7000-8000-3d39a82ae356",
    }
    const request = createCompanyPlaceHttpTestClient(f.database)
    expect(
      (
        await request({
          path: "/company/definitions",
          resources: [{ ...f.workplace, attributes }],
          revision: 1,
        })
      ).status,
    ).toBe(422)
    expect(await f.saved()).toEqual(before)
  },
)

test.each(["read-only", "other-organization"])(
  "原子的な拠点変更も現在の会社権限を要求する: %s",
  async (kind) => {
    const f = await createCompanyPlaceTestContext()
    const actor = CompanyActorValue.restore({
      accountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
      employeeId: null,
      organizationIds:
        kind === "other-organization"
          ? ["01900060-0000-7000-8000-12268fccf2cc"]
          : [COMPANY_DEFAULT_ORGANIZATION_ID],
      capabilities: kind === "read-only" ? ["company:read"] : ["company:write"],
    })
    const request = createCompanyPlaceHttpTestClient(f.database, actor)
    const before = await f.saved()
    expect(
      (
        await request({
          path: "/company/organization-changes",
          resources: f.resources,
          revision: 0,
        })
      ).status,
    ).toBe(403)
    expect(await f.saved()).toEqual(before)
    const permitted = createCompanyPlaceHttpTestClient(f.database)
    expect(
      (
        await permitted({
          path: "/company/organization-changes",
          resources: f.resources,
          revision: 0,
        })
      ).status,
    ).toBe(201)
    const saved = await f.saved()
    expect(
      (
        await request({
          path: "/company/organization-changes",
          resources: f.resources,
          revision: 0,
        })
      ).status,
    ).toBe(403)
    expect(await f.saved()).toEqual(saved)
  },
)
