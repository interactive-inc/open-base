import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { createOrganizationProfileFixture } from "@/contexts/company/test/organization-profile.test-support"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { D1OrganizationProfileAdapter } from "@/contexts/company/infrastructure/adapters/organization/d1-organization-profile.adapter"
import { readCompanyOrganizationProfile } from "@/contexts/company/interface/operations/read-company-organization-profile"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// 全migrationを適用したローカルD1を使うため、最初のtemplate作成を含めて既定の5秒を超えることがある。
setDefaultTimeout(30_000)

describe("会社プロフィールの正本と表示の接続", () => {
  test("遡及訂正後の現在表示と指定会社版の表示が同じ確定事実を返す", async () => {
    const f = await createOrganizationProfileFixture()
    expect(Number((await f.write(await f.input())).status)).toBe(200)
    const first = (await f.publicRead()).resources[0]
    if (first === undefined) throw new Error("profile missing")
    const correction = {
      reason: "Correct original company profile",
      evidenceReferences: [
        {
          context: "company",
          kind: "source-document",
          id: "profile-source:1",
          version: "1",
        },
      ],
      corrections: [
        {
          type: "company-profile",
          id: first.id,
          revision: 2,
          correctsRevision: 1,
        },
      ],
      resources: [
        {
          ...first,
          revision: 2,
          effectiveFrom: "2026-08-01",
          attributes: { ...first.attributes, displayName: "Corrected Company" },
        },
      ],
    }
    const headers = {
      "content-type": "application/json",
      "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
      "if-match": "1",
      "idempotency-key": "profile:retroactive-correction",
    }
    const missingEvidence = await f.request("/company/profile", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...correction, evidenceReferences: undefined }),
    })
    expect(missingEvidence.status).toBe(422)
    expect((await f.publicRead()).organizationRevision).toBe(1)
    const response = await f.request("/company/profile", {
      method: "POST",
      headers,
      body: JSON.stringify(correction),
    })
    expect(response.status).toBe(201)
    const persisted = await f.database
      .prepare(
        "SELECT corrects_revision, evidence_references_json FROM company_resource_revisions WHERE resource_type = 'company-profile' AND resource_id = ? AND revision = 2",
      )
      .bind(first.id)
      .first<{ corrects_revision: number; evidence_references_json: string }>()
    expect(persisted?.corrects_revision).toBe(1)
    expect(JSON.parse(persisted?.evidence_references_json ?? "null")).toEqual(
      correction.evidenceReferences,
    )
    expect((await f.publicRead()).resources[0]?.attributes.displayName).toBe("Corrected Company")
    expect((await f.read()).name).toBe("Corrected Company")
    expect(
      await readCompanyOrganizationProfile({
        database: f.database,
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        effectiveOn: restoreCalendarDate("2026-09-07"),
        organizationRevision: 1,
      }),
    ).toMatchObject({ name: f.defaults.name })
    expect(
      await readCompanyOrganizationProfile({
        database: f.database,
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        effectiveOn: restoreCalendarDate("2026-09-07"),
        organizationRevision: 2,
      }),
    ).toMatchObject({ name: "Corrected Company" })
  })

  test("指定会社版では公開済みの法人プロフィールだけを読み、後続変更を混ぜない", async () => {
    const f = await createOrganizationProfileFixture()
    const atRevision = (organizationRevision: number) =>
      readCompanyOrganizationProfile({
        database: f.database,
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        effectiveOn: restoreCalendarDate("2026-09-07"),
        organizationRevision,
      })
    expect(await atRevision(0)).toBeNull()
    expect(Number((await f.write(await f.input())).status)).toBe(200)
    const first = (await f.publicRead()).resources[0]
    if (first === undefined) throw new Error("profile missing")
    expect(await atRevision(1)).toMatchObject({
      name: f.defaults.name,
      version: { organizationRevision: 1, resourceRevision: 1 },
    })
    expect(
      Number(
        (
          await f.publicWrite(
            {
              ...first,
              revision: 2,
              attributes: { ...first.attributes, displayName: "Later Company" },
            },
            1,
            "profile:later-version",
          )
        ).status,
      ),
    ).toBe(201)
    expect((await atRevision(1))?.name).toBe(f.defaults.name)
    expect(await atRevision(2)).toMatchObject({
      name: "Later Company",
      version: { organizationRevision: 2, resourceRevision: 2 },
    })
    expect(await atRevision(3)).toBeInstanceOf(Error)
  })

  test("既存情報を保全して公開履歴へ接続し、両方のAPIから同じ情報を変更する", async () => {
    const f = await createOrganizationProfileFixture()
    const baseline = await f.baseline()
    expect(await f.read()).toMatchObject({
      name: f.defaults.name,
      locale: null,
      timeZone: null,
      version: { resourceId: null, resourceRevision: 0 },
    })
    const input = await f.input()
    expect(Number((await f.write({ ...input, name: "Renamed Company" })).status)).toBe(200)
    const publicProfile = await f.publicRead()
    const resource = publicProfile.resources[0]
    if (resource === undefined) throw new Error("public profile missing")
    expect(resource.attributes).toMatchObject({
      displayName: "Renamed Company",
      representativeName: f.defaults.representativeName,
    })
    expect(
      Number(
        (
          await f.publicWrite(
            {
              ...resource,
              revision: resource.revision + 1,
              attributes: {
                ...resource.attributes,
                displayName: "Publicly Updated Company",
                representativeName: "New Representative",
              },
            },
            publicProfile.organizationRevision,
            "profile:public",
          )
        ).status,
      ),
    ).toBe(201)
    expect(await f.read()).toMatchObject({
      name: "Publicly Updated Company",
      representativeName: "New Representative",
      locale: "ja-JP",
      version: { resourceRevision: 2, organizationRevision: 2 },
    })
    expect(await f.baseline()).toEqual(baseline)
    const overwrite = await execSql(
      f.database,
      `UPDATE company_organizations SET name = 'Bypass' WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
    ).catch((cause: unknown) => cause)
    expect(overwrite).toBeInstanceOf(Error)
    expect(await f.state()).toEqual({ revision: 2, profiles: 2, receipts: 1 })
  })

  test("未知の代表者は旧情報で補わず、公開profileを読んだ内容をそのまま更新できる", async () => {
    const f = await createOrganizationProfileFixture()
    const resource = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "company-profile",
      id: "profile:public-first",
      revision: 1,
      state: "active",
      effectiveFrom: "2026-09-01",
      effectiveTo: null,
      attributes: {
        displayName: "Public Company",
        locale: "ja-JP",
        timeZone: "Asia/Tokyo",
        fiscalYearStartMonth: 1,
      },
    }
    const response = await f.request("/company/profile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
        "if-match": "0",
        "idempotency-key": "profile:first",
      },
      body: JSON.stringify({ reason: "Confirmed profile", resources: [resource] }),
    })
    expect(response.status).toBe(201)
    expect(await f.read()).toMatchObject({ name: "Public Company", representativeName: null })
    const current = await f.publicRead()
    const profile = current.resources[0]
    if (profile === undefined) throw new Error("profile missing")
    expect(
      Number(
        (
          await f.publicWrite(
            {
              ...profile,
              revision: 2,
              attributes: { ...profile.attributes, representativeName: "Confirmed Representative" },
            },
            current.organizationRevision,
            "profile:representative",
          )
        ).status,
      ),
    ).toBe(201)
    expect(await f.read()).toMatchObject({ representativeName: "Confirmed Representative" })
  })

  test("現在の編集は将来予約と期間の空白・取消を埋めず、旧情報へ戻らない", async () => {
    const f = await createOrganizationProfileFixture()
    expect(Number((await f.write(await f.input())).status)).toBe(200)
    const initial = await f.publicRead()
    const first = initial.resources[0]
    if (first === undefined) throw new Error("profile missing")
    expect(
      Number(
        (
          await f.publicWrite(
            {
              ...first,
              revision: 2,
              effectiveFrom: "2026-10-01",
              attributes: { ...first.attributes, displayName: "Future Company" },
            },
            1,
            "profile:future",
          )
        ).status,
      ),
    ).toBe(201)
    expect((await f.read()).name).toBe(f.defaults.name)
    expect((await f.publicRead()).resources[0]?.attributes.displayName).toBe(f.defaults.name)
    const current = await f.input()
    expect(
      Number((await f.write({ ...current, name: "Current Company" }, "profile:current")).status),
    ).toBe(200)
    expect((await f.publicRead("2026-10-01")).resources[0]?.attributes.displayName).toBe(
      "Future Company",
    )
    expect(
      Number(
        (
          await f.publicWrite(
            {
              ...first,
              revision: 4,
              effectiveTo: "2026-09-10",
              attributes: { ...first.attributes, displayName: "Bounded Company" },
            },
            3,
            "profile:bounded",
          )
        ).status,
      ),
    ).toBe(201)
    const bounded = await f.input()
    expect(bounded.version.effectiveTo).toBe("2026-09-10")
    expect(
      Number(
        (await f.write({ ...bounded, name: "Edited Bounded Company" }, "profile:bounded-edit"))
          .status,
      ),
    ).toBe(200)
    f.clock.now = new Date("2026-09-11T03:00:00.000Z")
    expect(Number((await f.client.company["organization-profile"].$get()).status)).toBe(404)
    expect((await f.publicRead()).resources).toEqual([])
    f.clock.now = new Date("2026-10-01T03:00:00.000Z")
    expect((await f.read()).name).toBe("Future Company")
    expect(
      Number(
        (
          await f.publicWrite(
            { ...first, revision: 6, state: "void", effectiveFrom: "2026-10-01" },
            5,
            "profile:void",
          )
        ).status,
      ),
    ).toBe(201)
    expect(Number((await f.client.company["organization-profile"].$get()).status)).toBe(404)
  })

  test("成功済みの再送は翌日と別の変更後も元の結果を返し、別内容と未成功の古い表示を拒否する", async () => {
    const f = await createOrganizationProfileFixture()
    const input = await f.input()
    const created = await f.write(input)
    expect(Number(created.status)).toBe(200)
    const saved = await created.json()
    expect(
      Number(
        (await f.write({ ...(await f.input()), name: "Later Company" }, "profile:later")).status,
      ),
    ).toBe(200)
    const state = await f.state()
    f.clock.now = new Date("2026-09-08T03:00:00.000Z")
    expect(await (await f.write(input)).json()).toMatchObject({ ...saved, replayed: true })
    expect(Number((await f.write({ ...input, reason: "Different reason" })).status)).toBe(409)
    expect(Number((await f.write(input, "profile:late-new")).status)).toBe(409)
    expect(await f.state()).toEqual(state)
  })

  test.each(["resource", "receipt"])(
    "%sの保存失敗を全取消し、同じ依頼で再試行する",
    async (stage) => {
      const f = await createOrganizationProfileFixture()
      const input = await f.input()
      const state = await f.state()
      const table =
        stage === "resource" ? "company_resource_revisions" : "company_profile_change_receipts"
      await execSql(
        f.database,
        `CREATE TRIGGER reject_profile BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'unavailable'); END;`,
      )
      expect(Number((await f.write(input)).status)).toBe(503)
      expect(await f.state()).toEqual(state)
      await execSql(f.database, "DROP TRIGGER reject_profile")
      expect(Number((await f.write(input)).status)).toBe(200)
    },
  )

  test("同じ依頼の同時送信は一回だけ保存し、古い画面からの別依頼を拒否する", async () => {
    const f = await createOrganizationProfileFixture()
    const input = await f.input()
    const writes = await Promise.all([f.write(input), f.write(input)])
    expect(writes.map((response) => Number(response.status))).toEqual([200, 200])
    const bodies = await Promise.all(writes.map((response) => response.json()))
    expect(
      bodies
        .map((body) => body.replayed)
        .toSorted((first, second) => Number(first) - Number(second)),
    ).toEqual([false, true])
    expect(
      Number((await f.write({ ...input, name: "Other Company" }, "profile:other")).status),
    ).toBe(409)
    expect(await f.state()).toEqual({ revision: 1, profiles: 1, receipts: 1 })
    const erased = await execSql(f.database, "DELETE FROM company_profile_change_receipts").catch(
      (cause: unknown) => cause,
    )
    expect(erased).toBeInstanceOf(Error)
  })

  test("保存直前の既存プロフィール変更を検知し、新しい事実を上書きしない", async () => {
    const f = await createOrganizationProfileFixture()
    const input = await f.input()
    const adapter = new D1OrganizationProfileAdapter(f.database)
    const prepare = adapter.prepareGuard.bind(adapter)
    const interception = spyOn(
      D1OrganizationProfileAdapter.prototype,
      "prepareGuard",
    ).mockImplementationOnce((profile) => {
      const guard = prepare(profile)
      const batch = f.database.batch.bind(f.database)
      spyOn(f.database, "batch").mockImplementationOnce(async (statements) => {
        await execSql(
          f.database,
          `UPDATE company_organizations SET representative_name = 'Changed Representative' WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
        )
        return batch(statements)
      })
      return guard
    })
    try {
      expect(Number((await f.write(input)).status)).toBe(409)
    } finally {
      interception.mockRestore()
    }
    expect((await f.baseline())?.representative_name).toBe("Changed Representative")
    expect(await f.state()).toEqual({ revision: 0, profiles: 0, receipts: 0 })
  })

  test("scopeと現在の管理資格を変更と再送で検査する", async () => {
    const f = await createOrganizationProfileFixture()
    const input = await f.input()
    expect(Number((await f.write(input)).status)).toBe(200)
    f.actor.current = CompanyActorValue.restore({
      accountId: f.actor.current.accountId,
      employeeId: f.actor.current.employeeId,
      organizationIds: ["01900060-0000-7000-8000-12268fccf2cc"],
      capabilities: ["company:admin"],
    })
    expect(Number((await f.write(input)).status)).toBe(403)
    f.actor.current = CompanyActorValue.restore({
      accountId: f.actor.current.accountId,
      employeeId: f.actor.current.employeeId,
      organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
      capabilities: ["company:read"],
    })
    expect(Number((await f.write(input)).status)).toBe(403)
  })

  test("別の公開profile identityを作らず、表現できないtimezoneも拒否する", async () => {
    const f = await createOrganizationProfileFixture()
    expect(Number((await f.write(await f.input())).status)).toBe(200)
    const first = (await f.publicRead()).resources[0]
    if (first === undefined) throw new Error("profile missing")
    expect(
      Number(
        (
          await f.publicWrite(
            { ...first, id: "profile:duplicate", revision: 1 },
            1,
            "profile:duplicate",
          )
        ).status,
      ),
    ).toBe(422)
    expect(
      Number(
        (
          await f.publicWrite(
            {
              ...first,
              revision: 2,
              attributes: { ...first.attributes, timeZone: "Unknown/Timezone" },
            },
            1,
            "profile:timezone",
          )
        ).status,
      ),
    ).toBe(422)
    expect(await f.state()).toEqual({ revision: 1, profiles: 1, receipts: 1 })
  })
  test("公開APIで使われたキーを別の編集として再利用せず、確定後の通信失敗はreceiptから復元する", async () => {
    const f = await createOrganizationProfileFixture()
    expect(Number((await f.write(await f.input())).status)).toBe(200)
    const first = (await f.publicRead()).resources[0]
    if (first === undefined) throw new Error("profile missing")
    expect(
      Number((await f.publicWrite({ ...first, revision: 2 }, 1, "profile:public-key")).status),
    ).toBe(201)
    const input = await f.input()
    expect(Number((await f.write(input, "profile:public-key")).status)).toBe(409)
    const batch = f.database.batch.bind(f.database)
    const interception = spyOn(f.database, "batch").mockImplementationOnce(async (statements) => {
      await batch(statements)
      throw new Error("Response lost after commit")
    })
    try {
      const response = await f.write(input, "profile:lost-response")
      expect(Number(response.status)).toBe(200)
      expect(await response.json()).toMatchObject({ organizationRevision: 3, replayed: true })
    } finally {
      interception.mockRestore()
    }
    expect(await f.state()).toEqual({ revision: 3, profiles: 3, receipts: 2 })
  })

  test("表示の検査後に確定した公開変更を上書きせず、保存した変更前情報を改変できない", async () => {
    const f = await createOrganizationProfileFixture()
    expect(Number((await f.write(await f.input())).status)).toBe(200)
    const input = await f.input()
    const first = (await f.publicRead()).resources[0]
    if (first === undefined) throw new Error("profile missing")
    const batch = f.database.batch.bind(f.database)
    const interception = spyOn(f.database, "batch").mockImplementationOnce(async (statements) => {
      expect(
        Number(
          (
            await f.publicWrite(
              {
                ...first,
                revision: 2,
                attributes: { ...first.attributes, displayName: "Concurrent Company" },
              },
              1,
              "profile:concurrent-public",
            )
          ).status,
        ),
      ).toBe(201)
      return batch(statements)
    })
    try {
      expect(Number((await f.write(input, "profile:stale")).status)).toBe(409)
    } finally {
      interception.mockRestore()
    }
    expect((await f.read()).name).toBe("Concurrent Company")
    const rewritten = await execSql(
      f.database,
      "UPDATE company_profile_change_receipts SET source_json = '{}' ",
    ).catch((cause: unknown) => cause)
    expect(rewritten).toBeInstanceOf(Error)
    expect(await f.state()).toEqual({ revision: 2, profiles: 2, receipts: 1 })
  })
})
