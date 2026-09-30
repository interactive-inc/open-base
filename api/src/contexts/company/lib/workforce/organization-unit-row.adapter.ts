import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { InvalidOrganizationUnitProjectionError } from "@/contexts/company/domain/errors"
import {
  organizationUnitKinds,
  type OrganizationUnitPeriod,
  type OrganizationUnitSnapshot,
} from "@/contexts/company/domain/definitions/organization-unit.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"

export type OrganizationUnitProjectionRow = Readonly<{
  periodId: string
  revision: number
  organizationUnitId: string
  code: string
  officialName: string
  kind: string
  parentOrganizationUnitId: string | null
  startsOn: string
  endsOn: string | null
  isVoid: boolean
  recordedByActionId: string
  recordedAt: number | Date
}>

function timestamp(value: number | Date): number {
  return value instanceof Date ? value.getTime() : value
}

/** append-only rowsからperiodごとの最新revisionだけを決定的に選ぶ。 */
export function projectOrganizationUnitSnapshot(
  props: Readonly<{
    revision: number
    asOf: string
    rows: ReadonlyArray<OrganizationUnitProjectionRow>
  }>,
): OrganizationUnitSnapshot {
  const latestRows = new Map<string, OrganizationUnitProjectionRow>()
  for (const row of props.rows) {
    const current = latestRows.get(row.periodId)
    if (current === undefined || current.revision < row.revision) {
      latestRows.set(row.periodId, row)
    }
  }

  const units: OrganizationUnitPeriod[] = [...latestRows.values()]
    .sort(
      (left, right) =>
        left.startsOn.localeCompare(right.startsOn) || left.periodId.localeCompare(right.periodId),
    )
    .map((row) => {
      if (!organizationUnitKinds.includes(row.kind as (typeof organizationUnitKinds)[number])) {
        throw new InvalidOrganizationUnitProjectionError()
      }
      return {
        periodId: restoreWorkforceId("period", row.periodId),
        revision: row.revision,
        organizationUnitId: restoreWorkforceId("organization_unit", row.organizationUnitId),
        code: row.code,
        officialName: row.officialName,
        kind: row.kind as (typeof organizationUnitKinds)[number],
        parentOrganizationUnitId:
          row.parentOrganizationUnitId === null
            ? null
            : restoreWorkforceId("organization_unit", row.parentOrganizationUnitId),
        startsOn: restoreCalendarDate(row.startsOn),
        endsOn: row.endsOn === null ? null : restoreCalendarDate(row.endsOn),
        isVoid: row.isVoid,
        recordedByActionId: restoreWorkforceId("personnel_action", row.recordedByActionId),
        recordedAt: timestamp(row.recordedAt),
      }
    })

  return {
    revision: props.revision,
    asOf: restoreCalendarDate(props.asOf),
    units,
  }
}
