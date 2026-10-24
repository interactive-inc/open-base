import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { decodeEmployeeLifecycleEventCursor } from "@/contexts/company/domain/definitions/decode-employee-lifecycle-event-cursor.definition"
import { encodeEmployeeLifecycleEventCursor } from "@/contexts/company/domain/definitions/encode-employee-lifecycle-event-cursor.definition"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import {
  CompanyOperationError,
  CompanyUnavailableError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import {
  PersonnelActionAdapter,
  type PersonnelActionListRecord,
} from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action.adapter"

export type EmployeeLifecycleEvent = PersonnelActionListRecord & {
  displayStatus: "correction" | "corrected" | "scheduled" | "confirmed"
}

type Context = CompanyContext

/** ひとりの従業員について確定済み人事発令をページングして読む。 */
export class EmployeeLifecycleEventListAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async list(input: {
    employeeId: EmployeeId
    from: string | null
    to: string | null
    limit: number
    cursor: string | null
  }): Promise<
    | { data: ReadonlyArray<EmployeeLifecycleEvent>; nextCursor: string | null }
    | CompanyOperationError
  > {
    if (
      (input.from !== null && !isCalendarDate(input.from)) ||
      (input.to !== null && !isCalendarDate(input.to)) ||
      (input.from !== null && input.to !== null && input.from > input.to) ||
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100
    ) {
      return new CompanyValidationError(
        "履歴の期間指定が不正です",
        "personnel_action_invalid_transition",
      )
    }
    const decoded = input.cursor === null ? null : decodeEmployeeLifecycleEventCursor(input.cursor)
    if (decoded instanceof CompanyValidationError) return decoded
    if (
      decoded !== null &&
      (decoded.employeeId !== input.employeeId ||
        decoded.from !== input.from ||
        decoded.to !== input.to ||
        decoded.limit !== input.limit)
    ) {
      return new CompanyValidationError("履歴カーソルが不正です", "invalid_lifecycle_cursor")
    }

    const repository = new PersonnelActionAdapter(this.c)
    const anchorRowId =
      decoded?.anchorRowId ??
      (await repository.maxRowIdForEmployee({
        employeeId: input.employeeId,
        from: input.from,
        to: input.to,
      }))
    if (anchorRowId instanceof CompanyOperationError) return anchorRowId
    const rows = await repository.listForEmployee({
      employeeId: input.employeeId,
      from: input.from,
      to: input.to,
      anchorRowId,
      position:
        decoded === null
          ? null
          : { eventOn: decoded.eventOn, recordedAt: decoded.recordedAt, id: decoded.id },
      limit: input.limit + 1,
    })
    if (rows instanceof CompanyOperationError) return rows

    const businessDate = resolveCompanyBusinessDate({
      now: this.c.env.NOW ?? new Date().toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (typeof businessDate !== "string") {
      return new CompanyUnavailableError(
        "会社営業日を解決できません",
        "company_timezone_unavailable",
        { cause: businessDate },
      )
    }
    const page = rows.slice(0, input.limit)
    const data = page.map((row) => ({
      ...row,
      displayStatus:
        row.kind === "corrected"
          ? ("correction" as const)
          : row.corrected
            ? ("corrected" as const)
            : row.eventOn > businessDate
              ? ("scheduled" as const)
              : ("confirmed" as const),
    }))
    const last = page.at(-1)
    const nextCursor =
      rows.length <= input.limit || last === undefined
        ? null
        : encodeEmployeeLifecycleEventCursor({
            version: 1,
            employeeId: input.employeeId,
            from: input.from,
            to: input.to,
            anchorRowId,
            eventOn: last.eventOn,
            recordedAt: last.recordedAt,
            id: last.id,
            limit: input.limit,
          })
    return { data, nextCursor }
  }
}
