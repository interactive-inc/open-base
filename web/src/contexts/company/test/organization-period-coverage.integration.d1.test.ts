import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import {
  createEmployeeAdoptionFixture,
  adoptionEmployeeId,
} from "@/contexts/company/test/employee-resource-adoption.test-support"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import { OrganizationStructureValue } from "@/contexts/company/domain/values/organization-structure.value"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture() {
  const f = await createEmployeeAdoptionFixture()
  const root = await f.database
    .prepare(
      "SELECT period_id AS periodId, organization_unit_id AS unitId, code, official_name AS name, starts_on AS startsOn FROM company_organization_unit_period_versions WHERE kind = 'COMPANY' LIMIT 1",
    )
    .first<{ periodId: string; unitId: string; code: string; name: string; startsOn: string }>()
  const employmentId = await f.database
    .prepare("SELECT id FROM company_employments WHERE employee_id = ?1")
    .bind(adoptionEmployeeId)
    .first<string>("id")
  const accountId = f.actors.current?.accountId
  if (root === null || employmentId === null || accountId === undefined)
    throw new Error("organization fixture missing")
  const operation = async (create: (id: string) => D1PreparedStatement[], count?: number) => {
    const revision = await f.database
      .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
      .first<number>("revision")
    if (revision === null) throw new Error("organization revision missing")
    const id = crypto.randomUUID()
    const changes = create(id)
    return f.database.batch([
      f.database
        .prepare(
          "INSERT INTO company_organization_change_operations (id, expected_revision, change_count, applied_count, resulting_revision, status, recorded_at, actor_account_id, reason, evidence_references_json, request_fingerprint) VALUES (?1, ?2, ?3, 0, ?2 + ?3, 'PENDING', 0, ?4, 'Confirmed period change', '[]', ?5)",
        )
        .bind(id, revision, count ?? changes.length, accountId, "0".repeat(64)),
      ...changes,
      f.database
        .prepare(
          "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = ?1",
        )
        .bind(id),
    ])
  }
  const unit = (
    id: string,
    input: {
      periodId?: string
      revision: number
      startsOn?: string
      endsOn?: string | null
      isVoid?: boolean
      unitId?: string
      parentId?: string
      kind?: string
      code?: string
    },
  ) =>
    f.database
      .prepare(
        "INSERT INTO company_organization_unit_period_versions (period_id, revision, organization_unit_id, code, official_name, kind, parent_organization_unit_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0)",
      )
      .bind(
        input.periodId ?? root.periodId,
        input.revision,
        input.unitId ?? root.unitId,
        input.code ?? root.code,
        root.name,
        input.kind ?? "COMPANY",
        input.parentId ?? null,
        input.startsOn ?? root.startsOn,
        input.endsOn ?? null,
        input.isVoid ? 1 : 0,
        id,
      )
  const assignment = (
    id: string,
    input: {
      periodId: string
      revision: number
      startsOn: string
      endsOn?: string | null
      employeeId?: string
      employmentId?: string
    },
  ) =>
    f.database
      .prepare(
        "INSERT INTO company_organization_assignment_period_versions (period_id, revision, employment_id, employee_id, organization_unit_id, assignment_type, position_title, manager_employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at) VALUES (?1, ?2, ?3, ?4, ?5, 'PRIMARY', NULL, NULL, ?6, ?7, 0, ?8, 0)",
      )
      .bind(
        input.periodId,
        input.revision,
        input.employmentId ?? employmentId,
        input.employeeId ?? adoptionEmployeeId,
        root.unitId,
        input.startsOn,
        input.endsOn ?? null,
        id,
      )
  const responsibility = (id: string) =>
    f.database
      .prepare(
        "INSERT INTO company_organization_responsibility_period_versions (period_id, revision, employment_id, employee_id, organization_unit_id, responsibility_type, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at) VALUES ('responsibility:coverage', 1, ?1, ?2, ?3, 'MANAGER', '2020-01-01', NULL, 0, ?4, 0)",
      )
      .bind(employmentId, adoptionEmployeeId, root.unitId, id)
  const splitRoot = (gap: boolean) =>
    operation((id) => [
      unit(id, { revision: 2, endsOn: "2026-08-01" }),
      unit(id, { periodId: "root:next", revision: 1, startsOn: gap ? "2026-08-02" : "2026-08-01" }),
    ])
  const state = () =>
    f.database
      .prepare(
        "SELECT (SELECT revision FROM company_organization_lifecycle_states) AS revision, (SELECT count(*) FROM company_organization_change_operations) AS operations, (SELECT count(*) FROM company_organization_unit_period_versions) AS units, (SELECT count(*) FROM company_organization_assignment_period_versions) AS assignments, (SELECT count(*) FROM company_organization_responsibility_period_versions) AS responsibilities",
      )
      .first<{
        revision: number
        operations: number
        units: number
        assignments: number
        responsibilities: number
      }>()
  return { ...f, root, operation, unit, assignment, responsibility, splitRoot, state }
}

describe("両製品のDBで連続した組織・所属期間を参照する", () => {
  test.each([false, true])(
    "組織の境界を越える所属と責務は、空白がある場合だけ拒否する: gap=%s",
    async (gap) => {
      const f = await fixture()
      await f.splitRoot(gap)
      const before = await f.state()
      const written = await f
        .operation((id) => [
          f.assignment(id, { periodId: "assignment:whole", revision: 1, startsOn: "2020-01-01" }),
        ])
        .catch((cause: unknown) => cause)
      if (gap) {
        if (!(written instanceof Error)) throw new Error("assignment crossed an organization gap")
        expect(written.message).toContain("unit is not active")
        expect(await f.state()).toEqual(before)
      } else {
        expect(written).not.toBeInstanceOf(Error)
        await f.operation((id) => [f.responsibility(id)])
        const recorded = await f.state()
        expect(recorded).toMatchObject({ assignments: 1, responsibilities: 1 })
        const cancelled = await f
          .operation((id) => [
            f.unit(id, {
              periodId: "root:next",
              revision: 2,
              startsOn: "2026-08-01",
              isVoid: true,
            }),
          ])
          .catch((cause: unknown) => cause)
        if (!(cancelled instanceof Error))
          throw new Error("unit cancellation orphaned an assignment")
        expect(cancelled.message).toContain("orphan assignment")
        expect(await f.state()).toEqual(recorded)
      }
    },
  )

  test.each([false, true])(
    "所属の境界を越える責務は、空白がある場合だけ拒否する: gap=%s",
    async (gap) => {
      const f = await fixture()
      await f.operation((id) => [
        f.assignment(id, {
          periodId: "assignment:first",
          revision: 1,
          startsOn: "2020-01-01",
          endsOn: "2026-08-01",
        }),
        f.assignment(id, {
          periodId: "assignment:next",
          revision: 1,
          startsOn: gap ? "2026-08-02" : "2026-08-01",
        }),
      ])
      const before = await f.state()
      const written = await f
        .operation((id) => [f.responsibility(id)])
        .catch((cause: unknown) => cause)
      if (gap) {
        if (!(written instanceof Error)) throw new Error("responsibility crossed an assignment gap")
        expect(written.message).toContain("matching assignment")
        expect(await f.state()).toEqual(before)
      } else {
        expect(written).not.toBeInstanceOf(Error)
        const recorded = await f.state()
        const gapAfterCorrection = await f
          .operation((id) => [
            f.assignment(id, { periodId: "assignment:next", revision: 2, startsOn: "2026-08-02" }),
          ])
          .catch((cause: unknown) => cause)
        if (!(gapAfterCorrection instanceof Error))
          throw new Error("assignment correction orphaned a responsibility")
        expect(gapAfterCorrection.message).toContain("orphan responsibility")
        expect(await f.state()).toEqual(recorded)
      }
    },
  )

  test.each([false, true])("親組織の連続期間をDomainとDBで検査する: gap=%s", async (gap) => {
    const f = await fixture()
    await f.splitRoot(gap)
    const before = await f.state()
    const written = await f
      .operation(
        (id) => [
          f.database.prepare(
            "INSERT INTO company_organization_units (id, created_at) VALUES ('0190005f-0000-7000-8000-2924942897cc', 0)",
          ),
          f.unit(id, {
            periodId: "period:child",
            revision: 1,
            startsOn: "2020-01-01",
            unitId: "0190005f-0000-7000-8000-2924942897cc",
            code: "CHILD",
            kind: "DEPARTMENT",
            parentId: f.root.unitId,
          }),
        ],
        1,
      )
      .catch((cause: unknown) => cause)
    if (gap) {
      if (!(written instanceof Error)) throw new Error("child crossed a parent gap")
      expect(written.message).toContain("orphan organization unit")
      expect(await f.state()).toEqual(before)
    } else {
      expect(written).not.toBeInstanceOf(Error)
      const read = await new OrganizationUnitReadAdapter(drizzle(f.database)).readSnapshot(
        restoreCalendarDate("2026-09-07"),
      )
      if (!read.ok) throw new Error("organization snapshot missing")
      expect(OrganizationStructureValue.restore(read.snapshot)).toBeInstanceOf(
        OrganizationStructureValue,
      )
      expect(
        OrganizationStructureValue.restore({
          ...read.snapshot,
          units: read.snapshot.units.map((unit) =>
            unit.periodId === "root:next"
              ? { ...unit, startsOn: restoreCalendarDate("2026-08-02") }
              : unit,
          ),
        }),
      ).toMatchObject({ code: "parent_not_active" })
    }
  })

  test("他人の所属で責務の空白を埋めない", async () => {
    const f = await fixture()
    await execSql(
      f.database,
      "INSERT INTO company_employees (id, official_name, employee_code, created_at, updated_at) VALUES ('1953cffc-119b-42c7-bbab-82c56499e4ac', 'Other Member', 'OTHER', 0, 0); INSERT INTO company_employments (id, employee_id, contract_name, employment_type, hire_date, status, created_at, updated_at) VALUES ('8c13d695-9339-4f3e-a451-d2657893dbca', '1953cffc-119b-42c7-bbab-82c56499e4ac', 'Other Member', 'PART_TIME', '2020-01-01', 'ACTIVE', 0, 0);",
    )
    await f.operation((id) => [
      f.assignment(id, {
        periodId: "assignment:owner",
        revision: 1,
        startsOn: "2020-01-01",
        endsOn: "2026-08-01",
      }),
      f.assignment(id, {
        periodId: "assignment:other",
        revision: 1,
        startsOn: "2026-08-01",
        employeeId: "1953cffc-119b-42c7-bbab-82c56499e4ac",
        employmentId: "8c13d695-9339-4f3e-a451-d2657893dbca",
      }),
    ])
    const before = await f.state()
    const written = await f
      .operation((id) => [f.responsibility(id)])
      .catch((cause: unknown) => cause)
    if (!(written instanceof Error)) throw new Error("another employee covered the responsibility")
    expect(written.message).toContain("matching assignment")
    expect(await f.state()).toEqual(before)
  })
})
