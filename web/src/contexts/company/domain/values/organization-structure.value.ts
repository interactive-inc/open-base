import { periodsContainPeriod } from "@/contexts/company/domain/definitions/periods-contain-period.definition"
import type { WorkforcePeriodVersion } from "@/contexts/company/domain/entities/workforce-schedule.entity"
import type { OrganizationInvariantViolation } from "@/contexts/company/domain/definitions/organization-invariant.definition"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import type { OrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export const organizationUnitKinds = ["COMPANY", "DIVISION", "DEPARTMENT", "TEAM", "OTHER"] as const

export type OrganizationUnitKind = (typeof organizationUnitKinds)[number]

/**
 * OrgUnit identity に対する有効期間付きの名称・分類・親子関係。
 * 訂正は同じ periodId の新 revision、改組は新しい periodId として追記する。
 */
export type OrganizationUnitPeriod = WorkforcePeriodVersion &
  Readonly<{
    organizationUnitId: OrganizationUnitId
    code: string
    officialName: string
    kind: OrganizationUnitKind
    parentOrganizationUnitId: OrganizationUnitId | null
  }>

/** 一回のCompany組織解決で固定するOrgUnit projection。 */
export type OrganizationUnitSnapshot = Readonly<{
  revision: number
  asOf: CalendarDate
  units: ReadonlyArray<OrganizationUnitPeriod>
}>

/**
 * 組織単位の全有効期間を一つの整合した組織構造として扱う集約ルート。
 */
export class OrganizationStructureValue {
  readonly revision: number
  readonly asOf: CalendarDate
  readonly units: ReadonlyArray<OrganizationUnitPeriod>

  private static violation(
    code: OrganizationInvariantViolation["code"],
    message: string,
  ): OrganizationInvariantViolation {
    return Object.freeze({ code, message })
  }

  private static isValidText(value: string, maxLength: number): boolean {
    return value.length > 0 && value.length <= maxLength && value.trim() === value
  }

  private static periodsOverlap(
    left: WorkforcePeriodVersion,
    right: WorkforcePeriodVersion,
  ): boolean {
    return (
      (right.endsOn === null || left.startsOn < right.endsOn) &&
      (left.endsOn === null || right.startsOn < left.endsOn)
    )
  }

  private static containsDate(period: WorkforcePeriodVersion, date: CalendarDate): boolean {
    return period.startsOn <= date && (period.endsOn === null || date < period.endsOn)
  }

  private static freezePeriod(period: OrganizationUnitPeriod): OrganizationUnitPeriod {
    return Object.freeze({ ...period })
  }

  private constructor(snapshot: OrganizationUnitSnapshot) {
    this.revision = snapshot.revision
    this.asOf = snapshot.asOf
    this.units = Object.freeze(
      snapshot.units.map((period) => OrganizationStructureValue.freezePeriod(period)),
    )
    Object.freeze(this)
  }

  static restore(
    snapshot: OrganizationUnitSnapshot,
  ): OrganizationStructureValue | OrganizationInvariantViolation {
    if (
      !Number.isSafeInteger(snapshot.revision) ||
      snapshot.revision < 0 ||
      !isCalendarDate(snapshot.asOf)
    ) {
      return OrganizationStructureValue.violation(
        "invalid_snapshot",
        "organization snapshot is not canonical",
      )
    }

    const periodIds = new Set<string>()
    for (const period of snapshot.units) {
      if (
        !Number.isSafeInteger(period.revision) ||
        period.revision < 1 ||
        !Number.isSafeInteger(period.recordedAt) ||
        period.recordedAt < 0 ||
        !isCalendarDate(period.startsOn) ||
        (period.endsOn !== null &&
          (!isCalendarDate(period.endsOn) || period.startsOn >= period.endsOn)) ||
        !OrganizationStructureValue.isValidText(period.code, 64) ||
        !OrganizationStructureValue.isValidText(period.officialName, 200) ||
        !organizationUnitKinds.includes(period.kind)
      ) {
        return OrganizationStructureValue.violation(
          "invalid_period",
          "organization unit period is not canonical",
        )
      }
      if (periodIds.has(period.periodId)) {
        return OrganizationStructureValue.violation(
          "duplicate_period",
          "organization snapshot contains more than one latest period version",
        )
      }
      periodIds.add(period.periodId)

      const parentIsValid =
        period.kind === "COMPANY"
          ? period.parentOrganizationUnitId === null
          : period.parentOrganizationUnitId !== null &&
            period.parentOrganizationUnitId !== period.organizationUnitId
      if (!parentIsValid) {
        return OrganizationStructureValue.violation(
          "invalid_parent",
          "organization unit has an invalid parent",
        )
      }
    }

    const entity = new OrganizationStructureValue(snapshot)
    const activePeriods = entity.activePeriods
    for (const [index, left] of activePeriods.entries()) {
      for (const right of activePeriods.slice(index + 1)) {
        if (!OrganizationStructureValue.periodsOverlap(left, right)) continue
        if (left.organizationUnitId === right.organizationUnitId) {
          return OrganizationStructureValue.violation(
            "organization_unit_overlap",
            "organization unit periods overlap",
          )
        }
        if (left.code === right.code) {
          return OrganizationStructureValue.violation(
            "organization_code_overlap",
            "organization unit codes overlap",
          )
        }
        if (left.kind === "COMPANY" && right.kind === "COMPANY") {
          return OrganizationStructureValue.violation(
            "organization_unit_overlap",
            "company root periods overlap",
          )
        }
      }
    }

    for (const child of activePeriods) {
      if (child.parentOrganizationUnitId === null) continue
      if (
        !periodsContainPeriod(
          activePeriods.filter(
            (candidate) => candidate.organizationUnitId === child.parentOrganizationUnitId,
          ),
          child,
        )
      ) {
        return OrganizationStructureValue.violation(
          "parent_not_active",
          "parent organization unit is not active for the full child period",
        )
      }
    }

    if (entity.boundaryDates.some((date) => entity.hasHierarchyCycleAt(date))) {
      return OrganizationStructureValue.violation(
        "hierarchy_cycle",
        "organization hierarchy contains a cycle",
      )
    }

    return entity
  }

  get activePeriods(): ReadonlyArray<OrganizationUnitPeriod> {
    return Object.freeze(this.units.filter((period) => !period.isVoid))
  }

  get boundaryDates(): ReadonlyArray<CalendarDate> {
    return Object.freeze(
      [
        ...new Set(
          this.activePeriods.flatMap((period) => [
            period.startsOn,
            ...(period.endsOn === null ? [] : [period.endsOn]),
          ]),
        ),
      ].sort(),
    )
  }

  containsUnitForPeriod(
    organizationUnitId: OrganizationUnitId,
    period: WorkforcePeriodVersion,
  ): boolean {
    return periodsContainPeriod(
      this.activePeriods.filter((unit) => unit.organizationUnitId === organizationUnitId),
      period,
    )
  }

  private hasHierarchyCycleAt(date: CalendarDate): boolean {
    const parents = new Map<OrganizationUnitId, OrganizationUnitId>()
    for (const period of this.activePeriods) {
      if (
        OrganizationStructureValue.containsDate(period, date) &&
        period.parentOrganizationUnitId !== null
      ) {
        parents.set(period.organizationUnitId, period.parentOrganizationUnitId)
      }
    }

    for (const unitId of parents.keys()) {
      const path = new Set<OrganizationUnitId>()
      let current: OrganizationUnitId | undefined = unitId
      while (current !== undefined) {
        if (path.has(current)) return true
        path.add(current)
        current = parents.get(current)
      }
    }
    return false
  }
}
