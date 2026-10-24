import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import {
  organizationChangeOperations,
  organizationLifecycleStates,
  organizationUnitPeriodVersions,
  organizationUnits,
} from "@/contexts/company/infrastructure/schema/organization"
import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/bun-sqlite"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { testLiteralId } from "@system/test/system-test-id.test-support"

const companyPeriodId = testLiteralId("period:company")
const companyUnitId = testLiteralId("company")
const firstActionId = testLiteralId("action:1")
const secondActionId = testLiteralId("action:2")

function createDatabase() {
  const sqlite = new Database(":memory:")
  sqlite.exec(`
    CREATE TABLE company_organization_units (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
    CREATE TABLE company_organization_change_operations (
      id TEXT PRIMARY KEY,
      expected_revision INTEGER NOT NULL,
      change_count INTEGER NOT NULL,
      applied_count INTEGER NOT NULL,
      resulting_revision INTEGER NOT NULL,
      status TEXT NOT NULL,
      recorded_at INTEGER NOT NULL
    );
    CREATE TABLE company_organization_unit_period_versions (
      period_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      organization_unit_id TEXT NOT NULL,
      code TEXT NOT NULL,
      official_name TEXT NOT NULL,
      kind TEXT NOT NULL,
      parent_organization_unit_id TEXT,
      starts_on TEXT NOT NULL,
      ends_on TEXT,
      is_void INTEGER NOT NULL,
      recorded_by_action_id TEXT NOT NULL,
      recorded_at INTEGER NOT NULL,
      PRIMARY KEY (period_id, revision)
    );
    CREATE TABLE company_organization_lifecycle_states (
      id INTEGER PRIMARY KEY,
      revision INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    INSERT INTO company_organization_lifecycle_states VALUES (1, 2, 2);
    INSERT INTO company_organization_units VALUES ('${companyUnitId}', 1);
    INSERT INTO company_organization_unit_period_versions VALUES
      ('${companyPeriodId}', 1, '${companyUnitId}', 'OLD', 'Old', 'COMPANY', NULL,
       '2026-01-01', NULL, 0, '${firstActionId}', 1),
      ('${companyPeriodId}', 2, '${companyUnitId}', 'ROOT', 'Company', 'COMPANY', NULL,
       '2026-01-01', NULL, 0, '${secondActionId}', 2);
  `)
  const database = drizzle(sqlite, {
    schema: {
      organizationLifecycleStates,
      organizationChangeOperations,
      organizationUnitPeriodVersions,
      organizationUnits,
    },
  }) as unknown as DrizzleD1Database<{
    organizationLifecycleStates: typeof organizationLifecycleStates
    organizationChangeOperations: typeof organizationChangeOperations
    organizationUnitPeriodVersions: typeof organizationUnitPeriodVersions
    organizationUnits: typeof organizationUnits
  }>
  return { database, sqlite }
}

describe("OrganizationUnitReadAdapter", () => {
  test("最新revisionだけをopaque OrgUnit snapshotへ復元する", async () => {
    const { database, sqlite } = createDatabase()
    const repository = new OrganizationUnitReadAdapter(database)

    expect(await repository.readSnapshot(restoreCalendarDate("2026-06-01"))).toEqual({
      ok: true,
      snapshot: {
        revision: 2,
        asOf: restoreCalendarDate("2026-06-01"),
        units: [
          {
            periodId: restoreWorkforceId("period", companyPeriodId),
            revision: 2,
            organizationUnitId: restoreWorkforceId("organization_unit", companyUnitId),
            code: "ROOT",
            officialName: "Company",
            kind: "COMPANY",
            parentOrganizationUnitId: null,
            startsOn: restoreCalendarDate("2026-01-01"),
            endsOn: null,
            isVoid: false,
            recordedByActionId: restoreWorkforceId("personnel_action", secondActionId),
            recordedAt: 2,
          },
        ],
      },
    })
    expect(await repository.readRevision()).toEqual({ ok: true, revision: 2 })
    sqlite.close()
  })

  test("singleton state欠損をfail closedにする", async () => {
    const { database, sqlite } = createDatabase()
    sqlite.run("DELETE FROM company_organization_lifecycle_states")

    const result = await new OrganizationUnitReadAdapter(database).readRevision()
    expect(result.ok).toBeFalse()
    if (!result.ok) {
      expect(result.cause).toEqual(
        expect.objectContaining({ code: "invalid_organization_lifecycle_state" }),
      )
    }
    sqlite.close()
  })

  test("未完了の原子変更があればsnapshotを返さない", async () => {
    const { database, sqlite } = createDatabase()
    sqlite.run(
      `INSERT INTO company_organization_change_operations
       VALUES ('action:pending', 2, 1, 0, 3, 'PENDING', 3)`,
    )

    const result = await new OrganizationUnitReadAdapter(database).readSnapshot(
      restoreCalendarDate("2026-06-01"),
    )
    expect(result.ok).toBeFalse()
    sqlite.close()
  })
})
