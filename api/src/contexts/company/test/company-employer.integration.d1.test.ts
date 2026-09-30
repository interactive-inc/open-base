import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { expect, setDefaultTimeout, test } from "bun:test"
import { createCompanyEmployerTestContext } from "@/contexts/company/test/company-employer.test-support"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("雇用主の未記録を保持し、同じ会社版の法人と雇用を原子的に接続する", async () => {
  const f = await createCompanyEmployerTestContext()
  const beforeRevision = await f.companyRevision()
  expect((await f.readEmployer("2030-06-01"))[0]?.attributes.employerLegalEntityId).toBeUndefined()
  const response = await f.write([f.employment, f.legalEntity], beforeRevision, "employer:initial")
  expect(Number(response.status)).toBe(201)
  expect((await f.readEmployer("2030-06-01"))[0]?.attributes.employerLegalEntityId).toBe(
    f.legalEntity.id,
  )
  expect(
    (await f.readEmployer("2030-06-01", beforeRevision))[0]?.attributes.employerLegalEntityId,
  ).toBeUndefined()
  const saved = await f.persisted()
  expect(
    Number(
      (await f.write([f.employment, f.legalEntity], beforeRevision, "employer:initial")).status,
    ),
  ).toBe(200)
  expect(await f.persisted()).toEqual(saved)
})

test("未来の雇用主変更を前倒しせず、旧法人の終了と同じ会社版で移管する", async () => {
  const f = await createCompanyEmployerTestContext()
  expect(
    Number(
      (await f.write([f.legalEntity, f.employment], await f.companyRevision(), "employer:initial"))
        .status,
    ),
  ).toBe(201)
  const confirmedRevision = await f.companyRevision()
  const before = await f.persisted()
  const closed = { ...f.legalEntity, revision: 2, effectiveTo: "2030-07-01" }
  expect(Number((await f.write([closed], confirmedRevision, "employer:orphan")).status)).toBe(422)
  expect(await f.persisted()).toEqual(before)
  const next = { ...f.legalEntity, id: "legal:next", effectiveFrom: "2030-07-01" }
  const moved = {
    ...f.employment,
    revision: f.employment.revision + 1,
    effectiveFrom: "2030-07-01",
    attributes: { ...f.employment.attributes, employerLegalEntityId: next.id },
  }
  expect(
    Number((await f.write([moved, closed, next], confirmedRevision, "employer:move")).status),
  ).toBe(201)
  expect((await f.readEmployer("2030-06-30"))[0]?.attributes.employerLegalEntityId).toBe(
    f.legalEntity.id,
  )
  expect((await f.readEmployer("2030-07-01"))[0]?.attributes.employerLegalEntityId).toBe(next.id)
  expect(
    (await f.readEmployer("2030-07-01", confirmedRevision))[0]?.attributes.employerLegalEntityId,
  ).toBe(f.legalEntity.id)
})

test("退職後に法人を終了でき、退職の確定履歴から雇用主を失わない", async () => {
  const f = await createCompanyEmployerTestContext()
  expect(
    Number(
      (await f.write([f.legalEntity, f.employment], await f.companyRevision(), "employer:initial"))
        .status,
    ),
  ).toBe(201)
  const retired = await f.personnel(
    {
      kind: "retired",
      employeeCode: "EMPLOYEE-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    },
    "employer:retire",
  )
  if (retired instanceof Error) throw retired
  expect(
    Number(
      (
        await f.write(
          [{ ...f.legalEntity, revision: 2, effectiveTo: "2030-07-01" }],
          await f.companyRevision(),
          "employer:close",
        )
      ).status,
    ),
  ).toBe(201)
  expect((await f.readEmployer("2030-06-30"))[0]?.attributes.employerLegalEntityId).toBe(
    f.legalEntity.id,
  )
  expect((await f.readEmployer("2030-07-01"))[0]?.attributes).toMatchObject({
    employerLegalEntityId: f.legalEntity.id,
    status: "TERMINATED",
  })
})

test("法人の欠落と雇用開始前の未成立期間を拒否し、nullは未記録として保持する", async () => {
  const f = await createCompanyEmployerTestContext()
  const revision = await f.companyRevision()
  const before = await f.persisted()
  expect(Number((await f.write([f.employment], revision, "employer:missing")).status)).toBe(422)
  expect(await f.persisted()).toEqual(before)
  expect(
    Number(
      (
        await f.write(
          [f.employment, { ...f.legalEntity, effectiveFrom: "2030-07-01" }],
          revision,
          "employer:not-yet",
        )
      ).status,
    ),
  ).toBe(422)
  expect(await f.persisted()).toEqual(before)
  expect(
    Number(
      (
        await f.write(
          [
            {
              ...f.employment,
              attributes: { ...f.employment.attributes, employerLegalEntityId: null },
            },
          ],
          revision,
          "employer:unknown",
        )
      ).status,
    ),
  ).toBe(201)
  expect((await f.readEmployer("2030-06-01"))[0]?.attributes.employerLegalEntityId).toBeNull()
})

test("退職訂正の期間が閉鎖済み法人を越える場合は全体を拒否し、延長確認後に再試行できる", async () => {
  const f = await createCompanyEmployerTestContext()
  expect(
    Number(
      (await f.write([f.legalEntity, f.employment], await f.companyRevision(), "employer:initial"))
        .status,
    ),
  ).toBe(201)
  const retired = await f.personnel(
    {
      kind: "retired",
      employeeCode: "EMPLOYEE-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    },
    "employer:retire",
  )
  if (retired instanceof Error) throw retired
  expect(
    Number(
      (
        await f.write(
          [{ ...f.legalEntity, revision: 2, effectiveTo: "2030-07-01" }],
          await f.companyRevision(),
          "employer:close",
        )
      ).status,
    ),
  ).toBe(201)
  const before = await f.persisted()
  const correction = {
    kind: "corrected" as const,
    eventOn: restoreCalendarDate("2030-06-01"),
    correctsActionId: retired.action.id,
    reason: "Correct retirement",
    replacementAction: {
      kind: "retired" as const,
      employeeCode: "EMPLOYEE-001",
      retirementOn: restoreCalendarDate("2030-07-31"),
    },
  }
  expect(await f.personnel(correction, "employer:correct")).toMatchObject({
    code: "invalid_employment_employer",
  })
  expect(await f.persisted()).toEqual(before)
  expect(
    Number(
      (
        await f.write(
          [{ ...f.legalEntity, revision: 3, effectiveTo: "2030-08-01" }],
          await f.companyRevision(),
          "employer:extend",
        )
      ).status,
    ),
  ).toBe(201)
  const applied = await f.personnel(correction, "employer:correct")
  if (applied instanceof Error) throw applied
  expect((await f.readEmployer("2030-07-31"))[0]?.attributes).toMatchObject({
    status: "ACTIVE",
    employerLegalEntityId: f.legalEntity.id,
  })
  const rehired = await f.personnel(
    {
      kind: "rehire",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-09-01"),
      employmentType: "FULL_TIME",
    },
    "employer:rehire",
  )
  if (rehired instanceof Error) throw rehired
  const employment = await f.database
    .prepare(
      "SELECT attributes_json FROM company_resource_heads WHERE resource_type = 'employment' AND resource_id <> ? AND json_extract(attributes_json, '$.employeeId') = ?",
    )
    .bind(f.employment.id, f.employment.attributes.employeeId)
    .first<{ attributes_json: string }>()
  expect(employment).not.toBeNull()
  expect(employment?.attributes_json).not.toContain("employerLegalEntityId")
})

test("休職と復職で雇用主と後続の将来変更を失わない", async () => {
  const f = await createCompanyEmployerTestContext()
  const next = { ...f.legalEntity, id: "legal:next", effectiveFrom: "2030-09-01" }
  expect(
    Number(
      (
        await f.write(
          [f.legalEntity, next, f.employment],
          await f.companyRevision(),
          "employer:initial",
        )
      ).status,
    ),
  ).toBe(201)
  expect(
    Number(
      (
        await f.write(
          [
            {
              ...f.employment,
              revision: f.employment.revision + 1,
              effectiveFrom: "2030-09-01",
              attributes: { ...f.employment.attributes, employerLegalEntityId: next.id },
            },
          ],
          await f.companyRevision(),
          "employer:future",
        )
      ).status,
    ),
  ).toBe(201)
  for (const input of [
    {
      kind: "leave_started" as const,
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-07-01"),
    },
    {
      kind: "returned" as const,
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-08-01"),
    },
  ]) {
    const applied = await f.personnel(input, `employer:${input.kind}`)
    if (applied instanceof Error) throw applied
  }
  expect((await f.readEmployer("2030-07-01"))[0]?.attributes).toMatchObject({
    status: "ON_LEAVE",
    employerLegalEntityId: f.legalEntity.id,
  })
  expect((await f.readEmployer("2030-08-01"))[0]?.attributes).toMatchObject({
    status: "ACTIVE",
    employerLegalEntityId: f.legalEntity.id,
  })
  expect((await f.readEmployer("2030-09-01"))[0]?.attributes.employerLegalEntityId).toBe(next.id)
})

test("別会社の法人、閲覧だけの権限、古い会社版を雇用主の確定に使わない", async () => {
  const f = await createCompanyEmployerTestContext()
  await f.database
    .prepare(
      "INSERT INTO company_organizations(id, revision, created_at, updated_at) VALUES ('01900060-0000-7000-8000-12268fccf2cc', 0, 1, 1)",
    )
    .run()
  const foreign = CompanyResourceChangeEntity.create({
    commandId: "employer:foreign",
    actorAccountId: f.creator.accountId,
    expectedRevision: 0,
    recordedAt: 1,
    reason: "Other company",
    resources: [
      {
        ...f.legalEntity,
        id: "legal:foreign",
        organizationId: "01900060-0000-7000-8000-12268fccf2cc",
        effectiveFrom: restoreCalendarDate(f.legalEntity.effectiveFrom),
      },
    ],
  })
  if (foreign instanceof Error) throw foreign
  expect(
    await new D1CompanyResourceRepository({ database: f.database }).write(foreign),
  ).toMatchObject({
    kind: "applied",
  })
  const before = await f.persisted()
  const revision = await f.companyRevision()
  expect(
    Number(
      (
        await f.write(
          [
            {
              ...f.employment,
              attributes: { ...f.employment.attributes, employerLegalEntityId: "legal:foreign" },
            },
          ],
          revision,
          "employer:foreign-link",
        )
      ).status,
    ),
  ).toBe(422)
  expect(await f.persisted()).toEqual(before)
  expect(Number((await f.write([f.legalEntity], revision, "employer:legal")).status)).toBe(201)
  expect(Number((await f.write([f.employment], revision, "employer:stale")).status)).toBe(409)
  const after = await f.persisted()
  f.setActor(
    CompanyActorValue.restore({
      ...f.creator,
      organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
      capabilities: ["company:read"],
    }),
  )
  expect(
    Number((await f.write([f.employment], await f.companyRevision(), "employer:readonly")).status),
  ).toBe(403)
  expect(await f.persisted()).toEqual(after)
})

test("変更履歴の保存失敗で法人・雇用・会社版を全取消し、同じ依頼を再試行できる", async () => {
  const f = await createCompanyEmployerTestContext()
  const revision = await f.companyRevision()
  const before = await f.persisted()
  await execSql(
    f.database,
    "CREATE TRIGGER test_employer_history_failure BEFORE INSERT ON company_resource_revisions WHEN NEW.resource_type = 'employment' BEGIN SELECT RAISE(ABORT, 'test_employer_history_failure'); END;",
  )
  expect(
    Number((await f.write([f.employment, f.legalEntity], revision, "employer:retry")).status),
  ).toBe(503)
  expect(await f.persisted()).toEqual(before)
  expect((await f.readEmployer("2030-06-01"))[0]?.attributes.employerLegalEntityId).toBeUndefined()
  await execSql(f.database, "DROP TRIGGER test_employer_history_failure")
  expect(
    Number((await f.write([f.employment, f.legalEntity], revision, "employer:retry")).status),
  ).toBe(201)
})
