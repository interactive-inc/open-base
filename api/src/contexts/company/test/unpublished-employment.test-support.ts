import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"

type Props = Readonly<{
  employeeId: string
  employmentId: string
  effectiveOn: string
  status: "active" | "leave"
  occurredAt: Date
  actorAccountId: string | null
  operationId: string
  reason: string
}>

/**
 * 公開履歴へまだ接続していない雇用の、発令、雇用期間、在籍状態の期間、改訂番号を用意する。
 *
 * 公開 resource を持たない過去のデータを再現するテスト専用の入口である。従業員と雇用の行は
 * 呼び出し側が先に入れる。製品の登録は公開 resource を正本として書くので、この形の行を作らない。
 */
export async function prepareUnpublishedEmployment(
  database: D1Database,
  props: Props,
): Promise<ReadonlyArray<D1PreparedStatement>> {
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
  if (summary instanceof Error) throw summary
  const fingerprint = await ProposalDigestValue.create(summary)
  if (fingerprint instanceof Error) throw fingerprint
  const actionId = deterministicCompanyId("initial-employment", fingerprint.toString())
  const recordedAt = Math.floor(props.occurredAt.getTime() / 1000)

  return [
    database
      .prepare(`INSERT INTO company_personnel_actions
      (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id, requested_by_employee_id,
       source_type, source_application_id, corrects_action_id, operation_id, payload_fingerprint, summary_json)
      VALUES (?1, ?2, 'initial_state', ?3, ?4, ?5, NULL, 'system', NULL, NULL, ?6, ?7, ?8)`)
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
    database
      .prepare(`INSERT INTO company_employment_period_versions
      (period_id, revision, employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES (?1, 1, ?2, ?3, NULL, 0, ?4, ?5)`)
      .bind(props.employmentId, props.employeeId, props.effectiveOn, actionId, recordedAt),
    database
      .prepare(`INSERT INTO company_employee_status_period_versions
      (period_id, revision, employment_period_id, employee_id, status, starts_on, ends_on, is_void,
       recorded_by_action_id, recorded_at)
      VALUES (?1, 1, ?2, ?3, ?4, ?5, NULL, 0, ?6, ?7)`)
      .bind(
        deterministicCompanyId("initial-status", fingerprint.toString()),
        props.employmentId,
        props.employeeId,
        props.status,
        props.effectiveOn,
        actionId,
        recordedAt,
      ),
    database
      .prepare(`INSERT INTO company_employee_lifecycle_revisions (employee_id, revision, updated_at)
      VALUES (?1, 0, ?2)`)
      .bind(props.employeeId, recordedAt),
  ]
}
