import {
  type OrganizationRevisionReadResult,
  type OrganizationUnitReadPort,
  type OrganizationUnitSnapshotReadResult,
} from "@/contexts/company/domain/definitions/organization-change.definition"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import {
  InvalidOrganizationLifecycleStateError,
  WorkforceSnapshotChangedError,
} from "@/contexts/company/domain/errors"
import { projectOrganizationUnitSnapshot } from "@/contexts/company/lib/workforce/organization-unit-row.adapter"
import {
  organizationChangeOperations,
  organizationLifecycleStates,
  organizationUnitPeriodVersions,
} from "@/contexts/company/infrastructure/schema/organization"
import { asc, eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"

type OrganizationDatabase = Pick<
  DrizzleD1Database<{
    organizationLifecycleStates: typeof organizationLifecycleStates
    organizationChangeOperations: typeof organizationChangeOperations
    organizationUnitPeriodVersions: typeof organizationUnitPeriodVersions
  }>,
  "select"
>
type OrganizationUnitReadAdapterContext = OrganizationDatabase
type Context = OrganizationUnitReadAdapterContext

/** Company組織のappend-only tablesをrevision付き共通snapshot portへ接続する。 */
export class OrganizationUnitReadAdapter implements OrganizationUnitReadPort {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  static fromContext(c: CompanyContext): OrganizationUnitReadAdapter {
    return new OrganizationUnitReadAdapter(c.var.database)
  }

  private async revision(): Promise<number> {
    const pending = await this.c
      .select({ id: organizationChangeOperations.id })
      .from(organizationChangeOperations)
      .where(eq(organizationChangeOperations.status, "PENDING"))
      .limit(1)
    if (pending.length !== 0) throw new InvalidOrganizationLifecycleStateError()

    const rows = await this.c
      .select({ revision: organizationLifecycleStates.revision })
      .from(organizationLifecycleStates)
      .where(eq(organizationLifecycleStates.id, 1))
      .limit(2)
    const revision = rows[0]?.revision
    if (rows.length !== 1 || !Number.isSafeInteger(revision) || revision < 0) {
      throw new InvalidOrganizationLifecycleStateError()
    }
    return revision
  }

  async readRevision(): Promise<OrganizationRevisionReadResult> {
    try {
      return { ok: true, revision: await this.revision() }
    } catch (cause) {
      return { ok: false, cause }
    }
  }

  async readSnapshot(asOf: CalendarDate): Promise<OrganizationUnitSnapshotReadResult> {
    try {
      const revision = await this.revision()
      const rows = await this.c
        .select()
        .from(organizationUnitPeriodVersions)
        .orderBy(
          asc(organizationUnitPeriodVersions.periodId),
          asc(organizationUnitPeriodVersions.revision),
        )
      if ((await this.revision()) !== revision) throw new WorkforceSnapshotChangedError()

      return {
        ok: true,
        snapshot: projectOrganizationUnitSnapshot({ revision, asOf, rows }),
      }
    } catch (cause) {
      return { ok: false, cause }
    }
  }
}
