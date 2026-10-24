import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { createCompanyAuthorityEmploymentTestContext } from "@/contexts/company/test/company-authority-employment.test-support"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { z } from "zod"
import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test.each(["office-assignment", "organizational-authority"] as const)(
  "退職は雇用に結び付く%sを終了し、過去の任用を保持する",
  async (type) => {
    const f = await createCompanyAuthorityEmploymentTestContext(type)
    const retired = await f.personnel(
      {
        kind: "retired",
        employeeCode: "EMPLOYEE-001",
        retirementOn: restoreCalendarDate("2030-06-30"),
      },
      `authority:${type}:retire`,
    )
    expect(retired).toMatchObject({ replayed: false })
    if (retired instanceof Error) throw retired
    const repository = new D1CompanyResourceRepository({ database: f.database })
    for (const [date, count] of [
      ["2030-06-30", 1],
      ["2030-07-01", 0],
    ] as const) {
      const snapshot = await repository.findMany({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        types: [type],
        effectiveOn: restoreCalendarDate(date),
      })
      if (!snapshot.ok) throw snapshot.cause
      expect(snapshot.resources).toHaveLength(count)
    }
    const saved = await f.persisted()
    expect(
      await f.personnel(
        {
          kind: "retired",
          employeeCode: "EMPLOYEE-001",
          retirementOn: restoreCalendarDate("2030-06-30"),
        },
        `authority:${type}:retire`,
      ),
    ).toMatchObject({ replayed: true })
    expect(await f.persisted()).toEqual(saved)
    expect(
      await f.personnel(
        {
          kind: "corrected",
          correctsActionId: retired.action.id,
          eventOn: restoreCalendarDate("2030-06-01"),
          reason: "Confirm corrected retirement date",
          replacementAction: {
            kind: "retired",
            employeeCode: "EMPLOYEE-001",
            retirementOn: restoreCalendarDate("2030-07-31"),
          },
        },
        `authority:${type}:correct`,
      ),
    ).toMatchObject({ replayed: false })
    for (const [date, count] of [
      ["2030-07-31", 1],
      ["2030-08-01", 0],
    ] as const) {
      const snapshot = await repository.findMany({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        types: [type],
        effectiveOn: restoreCalendarDate(date),
      })
      if (!snapshot.ok) throw snapshot.cause
      expect(snapshot.resources).toHaveLength(count)
    }
    expect(
      await f.personnel(
        {
          kind: "rehire",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-09-01"),
          employmentType: "FULL_TIME",
        },
        `authority:${type}:rehire`,
      ),
    ).toMatchObject({ replayed: false })
    const rehired = await repository.findMany({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      types: [type],
      effectiveOn: restoreCalendarDate("2030-09-01"),
    })
    if (!rehired.ok) throw rehired.cause
    expect(rehired.resources).toEqual([])
  },
)

test.each(["office-assignment", "organizational-authority"] as const)(
  "公開APIは%sを残す雇用・所属の短縮を拒否し、同時終了を受け付ける",
  async (type) => {
    const f = await createCompanyAuthorityEmploymentTestContext(type)
    const repository = new D1CompanyResourceRepository({ database: f.database })
    const snapshot = await repository.findMany({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      types: ["employment"],
    })
    if (!snapshot.ok) throw snapshot.cause
    const employment = snapshot.resources.find(
      (resource) => resource.id === f.assignment.attributes.employmentId,
    )
    if (employment === undefined) throw new Error("employment missing")
    const shortened = {
      organizationId: employment.organizationId,
      id: employment.id,
      state: employment.state,
      effectiveFrom: employment.effectiveFrom,
      type: "employment" as const,
      revision: employment.revision + 1,
      effectiveTo: "2030-07-01",
      attributes: z
        .object({
          employeeId: z.string(),
          status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]),
          employmentType: z.enum(["FULL_TIME", "PART_TIME"]),
        })
        .parse(employment.attributes),
    }
    const futureEnd = CompanyResourceChangeEntity.create({
      commandId: "authority:future-end",
      expectedRevision: await f.companyRevision(),
      actorAccountId: f.creator.accountId,
      reason: "Reserve appointment end",
      recordedAt: f.at.getTime(),
      resources: [
        {
          organizationId: f.appointment.organizationId,
          type: f.appointment.type,
          id: f.appointment.id,
          attributes: f.appointment.attributes,
          revision: 2,
          state: "void",
          effectiveFrom: restoreCalendarDate("2030-09-01"),
          effectiveTo: null,
        },
      ],
    })
    if (futureEnd instanceof Error) throw futureEnd
    expect(await repository.write(futureEnd)).toMatchObject({ kind: "applied" })
    const assignment = { ...f.assignment, revision: 2, effectiveTo: "2030-07-01" }
    if (type === "office-assignment") {
      expect(
        Number(
          (await f.write([assignment], await f.companyRevision(), "authority:close-assignment"))
            .status,
        ),
      ).toBe(201)
    }
    const before = await f.persisted()
    expect(
      Number(
        (
          await f.client.employments.$post({
            header: {
              "idempotency-key": "authority:shorten-employment",
              "if-match": String(await f.companyRevision()),
              "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
            },
            json: { reason: "Confirm employment end", resources: [shortened] },
          })
        ).status,
      ),
    ).toBe(422)
    expect(await f.persisted()).toEqual(before)
    if (type === "organizational-authority") {
      expect(
        Number(
          (await f.write([assignment], await f.companyRevision(), "authority:shorten-assignment"))
            .status,
        ),
      ).toBe(422)
      expect(await f.persisted()).toEqual(before)
    }
    const common = {
      organizationId: f.appointment.organizationId,
      id: f.appointment.id,
      state: "active" as const,
      revision: 3,
      effectiveFrom: f.appointment.effectiveFrom,
      effectiveTo: "2030-07-01",
    }
    const appointment =
      type === "office-assignment"
        ? {
            ...common,
            type,
            attributes: z
              .object({
                employeeId: z.string(),
                employmentId: z.string(),
                organizationalOfficeId: z.string(),
              })
              .parse(f.appointment.attributes),
          }
        : {
            ...common,
            type,
            attributes: z
              .object({
                employeeId: z.string(),
                employmentId: z.string(),
                scopeType: z.enum(["organization-unit", "authority-scope"]),
                scopeId: z.string(),
                authority: z.string(),
              })
              .parse(f.appointment.attributes),
          }
    const resources =
      type === "office-assignment" ? [shortened, appointment] : [assignment, appointment]
    expect(
      Number(
        (await f.write(resources, await f.companyRevision(), "authority:shorten-together")).status,
      ),
    ).toBe(201)
    if (type === "organizational-authority") {
      expect(
        Number(
          (
            await f.client.employments.$post({
              header: {
                "idempotency-key": "authority:shorten-employment-after-assignment",
                "if-match": String(await f.companyRevision()),
                "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
              },
              json: { reason: "Confirm employment end", resources: [shortened] },
            })
          ).status,
        ),
      ).toBe(201)
    }
    const saved = await f.persisted()
    const invalid = CompanyResourceChangeEntity.create({
      commandId: "authority:reopen-after-end",
      expectedRevision: await f.companyRevision(),
      actorAccountId: f.creator.accountId,
      reason: "Attempt out of employment appointment",
      recordedAt: f.at.getTime(),
      resources: [
        {
          ...appointment,
          revision: 4,
          effectiveFrom: restoreCalendarDate("2030-07-01"),
          effectiveTo: null,
        },
      ],
    })
    if (invalid instanceof Error) throw invalid
    expect(await repository.write(invalid)).toMatchObject({ kind: "invalid" })
    expect(await f.persisted()).toEqual(saved)
  },
)

test.each(["office-assignment", "organizational-authority"] as const)(
  "%sの保存失敗は退職全体を巻き戻し、再送後の公開編集を訂正で上書きしない",
  async (type) => {
    const f = await createCompanyAuthorityEmploymentTestContext(type)
    const retirement = {
      kind: "retired",
      employeeCode: "EMPLOYEE-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    } satisfies PersonnelActionInput
    const before = await f.persisted()
    await execSql(
      f.database,
      `CREATE TRIGGER reject_authority_exit BEFORE INSERT ON company_resource_revisions
      WHEN NEW.resource_type = '${type}' BEGIN SELECT RAISE(ABORT, 'injected authority exit failure'); END;`,
    )
    expect(await f.personnel(retirement, "authority:failed-exit")).toBeInstanceOf(Error)
    expect(await f.persisted()).toEqual(before)
    await execSql(f.database, "DROP TRIGGER reject_authority_exit")
    const retired = await f.personnel(retirement, "authority:failed-exit")
    if (retired instanceof Error) throw retired
    const repository = new D1CompanyResourceRepository({ database: f.database })
    const history = await repository.findEmploymentDependentHistory(
      COMPANY_DEFAULT_ORGANIZATION_ID,
      await f.companyRevision(),
    )
    if (history instanceof Error) throw history
    const head = history
      .filter((resource) => resource.id === f.appointment.id)
      .toSorted((left, right) => left.revision - right.revision)
      .at(-1)
    if (head === undefined) throw new Error("appointment history missing")
    const edit = CompanyResourceChangeEntity.create({
      commandId: "authority:manual-exit-edit",
      expectedRevision: await f.companyRevision(),
      actorAccountId: f.creator.accountId,
      reason: "Confirm appointment ended earlier",
      recordedAt: f.at.getTime(),
      resources: [
        {
          organizationId: head.organizationId,
          type: head.type,
          id: head.id,
          attributes: head.attributes,
          revision: head.revision + 1,
          state: "void",
          effectiveFrom: restoreCalendarDate("2030-06-15"),
          effectiveTo: null,
        },
      ],
    })
    if (edit instanceof Error) throw edit
    expect(await repository.write(edit)).toMatchObject({ kind: "applied" })
    const edited = await f.persisted()
    expect(
      await f.personnel(
        {
          kind: "corrected",
          correctsActionId: retired.action.id,
          eventOn: restoreCalendarDate("2030-06-01"),
          reason: "Correct retirement after appointment edit",
          replacementAction: { ...retirement, retirementOn: restoreCalendarDate("2030-07-31") },
        },
        "authority:stale-correction",
      ),
    ).toMatchObject({ code: "personnel_action_stale" })
    expect(await f.persisted()).toEqual(edited)
  },
)
