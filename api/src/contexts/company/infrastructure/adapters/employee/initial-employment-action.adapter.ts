import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { AbortWhenPreviousStatementChangedNoRowsAdapter } from "@/contexts/company/infrastructure/adapters/database/abort-when-previous-statement-changed-no-rows.adapter"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"

type Props = Readonly<{
  employeeId: string
  employmentId: string
  effectiveOn: CalendarDate
  status: "active" | "leave"
  occurredAt: Date
  actorAccountId: string | null
  operationId: string
  reason: string
}>

export type InitialEmploymentAction = Readonly<{
  actionId: string
  /** 発令の行と改訂番号 0 の文。従業員の投影の後、雇用の投影の前に置く。 */
  statements: ReadonlyArray<D1PreparedStatement>
}>

type Context = D1Database

/**
 * 最初の雇用の発令（initial_state）と改訂番号だけを記録する。
 *
 * 従業員と雇用の表、期間は公開 resource の投影が書く。発令は、その従業員にまだ発令、雇用期間、
 * 改訂番号が無いときだけ記録し、既にあれば batch 全体を中断する。
 */
export class InitialEmploymentActionAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(props: Props): Promise<InitialEmploymentAction | Error> {
    if (
      !isCalendarDate(props.effectiveOn) ||
      !Number.isFinite(props.occurredAt.getTime()) ||
      props.operationId.length === 0 ||
      props.operationId.length > 128 ||
      props.reason.trim().length === 0 ||
      props.reason.length > 2000
    ) {
      return new Error("invalid initial employment fact")
    }
    const summary = CanonicalSystemJsonValue.create({
      kind: "initial_state",
      department: null,
      positionTitle: null,
      managerEmployeeCode: null,
      eventOn: props.effectiveOn,
      status: props.status,
      employeeId: props.employeeId,
      employmentId: props.employmentId,
      actorAccountId: props.actorAccountId,
      reason: props.reason,
    })
    if (summary instanceof Error) return summary
    const fingerprint = await ProposalDigestValue.create(summary)
    if (fingerprint instanceof Error) return fingerprint
    const actionId = deterministicCompanyId("initial-employment", fingerprint.toString())
    const recordedAt = Math.floor(props.occurredAt.getTime() / 1000)

    return {
      actionId,
      statements: [
        this.c
          .prepare(`INSERT INTO company_personnel_actions
          (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id, requested_by_employee_id,
           source_type, source_application_id, corrects_action_id, operation_id, payload_fingerprint, summary_json)
          SELECT ?1, ?2, 'initial_state', ?3, ?4, ?5, NULL, 'system', NULL, NULL, ?6, ?7, ?8
          WHERE NOT EXISTS (SELECT 1 FROM company_personnel_actions WHERE employee_id = ?2)
            AND NOT EXISTS (SELECT 1 FROM company_employment_period_versions WHERE employee_id = ?2)
            AND NOT EXISTS (SELECT 1 FROM company_employee_lifecycle_revisions WHERE employee_id = ?2)`)
          .bind(
            actionId,
            props.employeeId,
            props.effectiveOn,
            recordedAt,
            props.actorAccountId,
            props.operationId,
            fingerprint.toString(),
            summary.toString(),
          ),
        new AbortWhenPreviousStatementChangedNoRowsAdapter(
          this.c,
        ).abortWhenPreviousStatementChangedNoRows(),
        this.c
          .prepare(`INSERT INTO company_employee_lifecycle_revisions (employee_id, revision, updated_at)
          VALUES (?1, 0, ?2)`)
          .bind(props.employeeId, recordedAt),
      ],
    }
  }
}
