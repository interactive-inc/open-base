import { CompanyEmploymentResourceHistoryAdapter } from "@/contexts/company/infrastructure/adapters/employee/company-employment-resource-history.adapter"
import type { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyEmploymentResourceTimelineValue } from "@/contexts/company/domain/values/company-employment-resource-timeline.value"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { AbortWhenPreviousStatementChangedNoRowsAdapter } from "@/contexts/company/infrastructure/adapters/database/abort-when-previous-statement-changed-no-rows.adapter"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { z } from "zod"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"

const date = z.string().refine(isCalendarDate)
const periodRow = z.object({
  period_id: z.string(),
  revision: z.number().int().positive(),
  employee_id: z.string(),
  starts_on: date,
  ends_on: date.nullable(),
  is_void: z.number().int().min(0).max(1),
})
const statusRow = periodRow.extend({ status: z.enum(["active", "leave"]) })
const bindingRow = z.object({
  organization_id: z.string(),
  resource_revision: z.number().int(),
  lifecycle_revision: z.number().int(),
  last_action_id: z.string().nullable(),
})
type StatusRow = z.infer<typeof statusRow>
type Context = D1Database
type Props = Readonly<{
  resource: CompanyResourceEntity
  stagedHistory: ReadonlyArray<CompanyResourceEntity>
  change: CompanyResourceChangeEntity
  fingerprint: string
  revisionOffset: number
  /**
   * 人事発令が原因の変更で、発令の行と改訂番号を呼び出し側が書く場合に渡す。
   * 渡された場合は発令を合成せず、この発令を期間の記録元にする。在籍状態の列は、
   * 発令の基準日を含む期間があるときだけ更新する。
   */
  recordedBy?: Readonly<{ actionId: string; businessDate: string }>
}>

/** 雇用resourceの変更を、所有者とEmployee revisionを固定して期間履歴へ反映する。 */
export class CompanyEmploymentResourceProjectionAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(props: Props): Promise<ReadonlyArray<D1PreparedStatement> | Error> {
    const resource = props.resource
    const firstStaged = props.stagedHistory[0]
    if (firstStaged === undefined || props.stagedHistory.at(-1) !== resource)
      return new CompanyResourceValidationError("invalid_resource")
    const history = await new CompanyEmploymentResourceHistoryAdapter(this.c).read(resource)
    if (history instanceof Error) return history
    const timeline = CompanyEmploymentResourceTimelineValue.create([
      ...history,
      ...props.stagedHistory,
    ])
    if (timeline instanceof Error) return timeline
    const snapshot = await this.c.batch([
      this.c
        .prepare(`SELECT organization_id, resource_revision, lifecycle_revision, last_action_id
        FROM company_workforce_resource_bindings WHERE resource_type = 'employment' AND resource_id = ?1`)
        .bind(resource.id),
      this.c
        .prepare(`SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = ?1`)
        .bind(timeline.employeeId),
      this.c
        .prepare(`SELECT period_id, revision, employee_id, starts_on, ends_on, is_void
        FROM company_employment_period_versions WHERE period_id = ?1 ORDER BY revision DESC LIMIT 1`)
        .bind(resource.id),
      this.c
        .prepare(`SELECT period_id, revision, employee_id, status, starts_on, ends_on, is_void
        FROM company_employee_status_period_versions AS period WHERE employment_period_id = ?1
          AND NOT EXISTS (SELECT 1 FROM company_employee_status_period_versions AS newer
            WHERE newer.period_id = period.period_id AND newer.revision > period.revision)`)
        .bind(resource.id),
      this.c
        .prepare(`SELECT organization_id, resource_revision, lifecycle_revision, last_action_id
        FROM company_workforce_resource_bindings WHERE resource_type = 'employee' AND resource_id = ?1`)
        .bind(timeline.employeeId),
    ])
    if (snapshot.length !== 5 || snapshot.some((part) => !part.success))
      return new Error("failed to read workforce projection snapshot")
    const binding = bindingRow.nullable().safeParse(snapshot[0]?.results[0] ?? null)
    const revision = z
      .object({ revision: z.number().int().nonnegative() })
      .nullable()
      .safeParse(snapshot[1]?.results[0] ?? null)
    const previous = periodRow.nullable().safeParse(snapshot[2]?.results[0] ?? null)
    const statuses = z.array(statusRow).safeParse(snapshot[3]?.results)
    const employeeBinding = bindingRow.nullable().safeParse(snapshot[4]?.results[0] ?? null)
    if (
      !binding.success ||
      !revision.success ||
      !previous.success ||
      !statuses.success ||
      !employeeBinding.success
    ) {
      return new CompanyResourceValidationError("invalid_resource")
    }
    const baseRevision = revision.data?.revision ?? 0
    const declaredEmployee = props.change.resources.some(
      (candidate) =>
        candidate.type === "employee" &&
        candidate.id === timeline.employeeId &&
        candidate.organizationId === resource.organizationId &&
        candidate.revision === 1,
    )
    if (
      (employeeBinding.data === null && !declaredEmployee) ||
      (employeeBinding.data !== null &&
        (employeeBinding.data.organization_id !== resource.organizationId ||
          employeeBinding.data.lifecycle_revision !== baseRevision))
    ) {
      return new CompanyResourceValidationError("invalid_resource")
    }
    if (
      (binding.data === null && (firstStaged.revision !== 1 || previous.data !== null)) ||
      (binding.data !== null &&
        (binding.data.organization_id !== resource.organizationId ||
          binding.data.resource_revision !== firstStaged.revision - 1 ||
          binding.data.lifecycle_revision !== baseRevision ||
          previous.data === null))
    ) {
      return new CompanyResourceValidationError("invalid_resource")
    }
    if (
      statuses.data.some((status) => status.employee_id !== timeline.employeeId) ||
      (previous.data !== null && previous.data.employee_id !== timeline.employeeId)
    )
      return new CompanyResourceValidationError("invalid_resource")
    const startsOn = timeline.startsOn ?? previous.data?.starts_on
    if (startsOn === undefined || startsOn === null)
      return new CompanyResourceValidationError("invalid_period")
    if (previous.data !== null && startsOn !== previous.data.starts_on) {
      const previousStart = history
        .toReversed()
        .find(
          (entry) => entry.state === "active" && entry.effectiveFrom === previous.data?.starts_on,
        )
      if (
        previousStart === undefined ||
        !props.change.corrections.some(
          (correction) =>
            correction.type === "employment" &&
            correction.id === resource.id &&
            correction.correctsRevision === previousStart.revision &&
            props.stagedHistory.some((entry) => entry.revision === correction.revision),
        )
      ) {
        return new CompanyResourceValidationError("unlinked_start_correction")
      }
    }
    const isVoid = timeline.periods.length === 0
    const endsOn = isVoid ? (previous.data?.ends_on ?? null) : timeline.endsOn
    // 人事発令は雇用が複数でも改訂番号を1回だけ進めるので、雇用ごとのずれを足さない。
    const expectedRevision =
      baseRevision + (props.recordedBy === undefined ? props.revisionOffset : 0)
    const actionId = props.recordedBy?.actionId ?? crypto.randomUUID()
    const recordedAt = Math.floor(props.change.recordedAt / 1000)
    const summary = CanonicalSystemJsonValue.create({
      kind: "employment_revised",
      eventOn: resource.effectiveFrom,
      employeeId: timeline.employeeId,
      status:
        resource.state === "void" || resource.readText("status") === "TERMINATED"
          ? "retired"
          : resource.readText("status") === "ON_LEAVE"
            ? "leave"
            : "active",
      resourceId: resource.id,
      resourceRevision: resource.revision,
      resource: resource.attributes,
      reason: props.change.reason,
    })
    if (summary instanceof Error) return summary
    const actionKind = "employment_revised"
    const statements: D1PreparedStatement[] = []
    if (props.recordedBy === undefined) {
      if (revision.data === null && props.revisionOffset === 0) {
        statements.push(
          this.c
            .prepare(`INSERT INTO company_employee_lifecycle_revisions (employee_id, revision, updated_at)
          VALUES (?1, 0, ?2)`)
            .bind(timeline.employeeId, recordedAt),
        )
      }
      statements.push(
        this.c
          .prepare(`UPDATE company_employee_lifecycle_revisions SET revision = revision + 1, updated_at = ?1
        WHERE employee_id = ?2 AND revision = ?3`)
          .bind(recordedAt, timeline.employeeId, expectedRevision),
      )
      statements.push(
        new AbortWhenPreviousStatementChangedNoRowsAdapter(
          this.c,
        ).abortWhenPreviousStatementChangedNoRows(),
      )
      statements.push(
        this.c
          .prepare(`INSERT INTO company_personnel_actions
        (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id, requested_by_employee_id,
         source_type, source_application_id, corrects_action_id, operation_id, payload_fingerprint, summary_json)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, 'system', NULL, ?7, ?8, ?9, ?10)`)
          .bind(
            actionId,
            timeline.employeeId,
            actionKind,
            resource.effectiveFrom,
            recordedAt,
            props.change.actorAccountId,
            null,
            `resource:${props.fingerprint}:${props.change.resources.indexOf(resource)}`,
            props.fingerprint,
            summary.toString(),
          ),
      )
    }
    const businessDate = props.recordedBy?.businessDate
    const statusPeriod =
      businessDate === undefined
        ? timeline.periods.at(-1)
        : timeline.periods.find(
            (period) =>
              period.startsOn <= businessDate &&
              (period.endsOn === null || businessDate < period.endsOn),
          )
    // 基準日を含む期間が無い発令は、新しい雇用を在籍で作り、既存の雇用の状態は変えない。
    const status =
      isVoid || endsOn !== null
        ? "TERMINATED"
        : statusPeriod === undefined
          ? binding.data === null
            ? // 新しい雇用は、基準日より後に始まる場合も最初の期間の状態で作る。
              timeline.periods.at(-1)?.status === "leave"
              ? "ON_LEAVE"
              : "ACTIVE"
            : businessDate === undefined
              ? "ACTIVE"
              : null
          : statusPeriod.status === "leave"
            ? "ON_LEAVE"
            : "ACTIVE"
    if (binding.data === null) {
      statements.push(
        this.c
          .prepare(`INSERT INTO company_employments
        (id, employee_id, contract_name, employment_type, hire_date, status, termination_date, created_at, updated_at)
        SELECT ?1, ?2, coalesce(?3, employee.official_name), ?4, ?5, ?6,
          CASE WHEN ?7 IS NULL THEN NULL ELSE date(?7, '-1 day') END, ?8, ?8
        FROM company_employees AS employee WHERE employee.id = ?2`)
          .bind(
            resource.id,
            timeline.employeeId,
            resource.readNullableText("officialName") ?? null,
            timeline.employmentType,
            startsOn,
            status,
            endsOn,
            props.change.recordedAt,
          ),
      )
    } else {
      statements.push(
        this.c
          .prepare(`UPDATE company_employments SET
        contract_name = coalesce(?1, contract_name), employment_type = ?2,
        hire_date = CASE WHEN ?10 = 1 THEN hire_date ELSE ?3 END,
        status = coalesce(?4, status),
        termination_date = CASE WHEN ?5 = 1 THEN termination_date WHEN ?6 IS NULL THEN NULL ELSE date(?6, '-1 day') END,
        updated_at = max(updated_at, ?7) WHERE id = ?8 AND employee_id = ?9`)
          .bind(
            resource.readNullableText("officialName") ?? null,
            timeline.employmentType,
            startsOn,
            status,
            isVoid ? 1 : 0,
            endsOn,
            props.change.recordedAt,
            resource.id,
            timeline.employeeId,
            // 人事発令は既存の雇用の開始日を変えない。開始日の訂正は公開履歴の訂正として扱う。
            props.recordedBy === undefined ? 0 : 1,
          ),
      )
    }
    statements.push(
      new AbortWhenPreviousStatementChangedNoRowsAdapter(
        this.c,
      ).abortWhenPreviousStatementChangedNoRows(),
    )
    // 人事発令は変わった期間だけを版として残す。値が同じ版を原記録へ重ねない。
    const employmentPeriodUnchanged =
      props.recordedBy !== undefined &&
      previous.data !== null &&
      previous.data.starts_on === startsOn &&
      previous.data.ends_on === endsOn &&
      previous.data.is_void === (isVoid ? 1 : 0)
    if (!employmentPeriodUnchanged) {
      statements.push(
        this.c
          .prepare(`INSERT INTO company_employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`)
          .bind(
            resource.id,
            (previous.data?.revision ?? 0) + 1,
            timeline.employeeId,
            startsOn,
            endsOn,
            isVoid ? 1 : 0,
            actionId,
            recordedAt,
          ),
      )
    }
    const statusStatements = await this.statusStatements({
      timeline,
      previous: statuses.data,
      actionId,
      recordedAt,
      skipUnchanged: props.recordedBy !== undefined,
    })
    if (statusStatements instanceof Error) return statusStatements
    statements.push(...statusStatements)
    // 人事発令は公開履歴を書いた後に同じbindingを自分で進める。版を参照するので先には書けない。
    if (props.recordedBy === undefined) {
      statements.push(
        this.c
          .prepare(`INSERT INTO company_workforce_resource_bindings
        (resource_type, resource_id, organization_id, employee_id, resource_revision, lifecycle_revision, last_action_id)
        VALUES ('employment', ?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT (resource_type, resource_id) DO UPDATE SET resource_revision = excluded.resource_revision,
          lifecycle_revision = excluded.lifecycle_revision, last_action_id = excluded.last_action_id
        WHERE company_workforce_resource_bindings.organization_id = excluded.organization_id
          AND company_workforce_resource_bindings.employee_id = excluded.employee_id`)
          .bind(
            resource.id,
            resource.organizationId,
            timeline.employeeId,
            resource.revision,
            expectedRevision + 1,
            actionId,
          ),
      )
    }
    return statements
  }

  private async statusStatements(
    props: Readonly<{
      timeline: CompanyEmploymentResourceTimelineValue
      previous: ReadonlyArray<StatusRow>
      actionId: string
      recordedAt: number
      skipUnchanged: boolean
    }>,
  ): Promise<ReadonlyArray<D1PreparedStatement> | Error> {
    const periods = new Map<string, CompanyEmploymentResourceTimelineValue["periods"][number]>()
    for (const period of props.timeline.periods) {
      const key = CanonicalSystemJsonValue.create([
        props.timeline.organizationId,
        props.timeline.employmentId,
        period.startsOn,
      ])
      if (key instanceof Error) return key
      const digest = await ProposalDigestValue.create(key)
      if (digest instanceof Error) return digest
      periods.set(deterministicCompanyId("resource-status", digest.toString()), period)
    }
    const previousById = new Map(props.previous.map((period) => [period.period_id, period]))
    const statements: D1PreparedStatement[] = []
    for (const periodId of new Set([...previousById.keys(), ...periods.keys()])) {
      const previous = previousById.get(periodId)
      const current = periods.get(periodId)
      if (current === undefined && (previous === undefined || previous.is_void === 1)) continue
      const startsOn = current?.startsOn ?? previous?.starts_on
      const status = current?.status ?? previous?.status
      if (startsOn === undefined || status === undefined)
        return new CompanyResourceValidationError("invalid_resource")
      const endsOn = current === undefined ? (previous?.ends_on ?? null) : current.endsOn
      if (
        props.skipUnchanged &&
        previous !== undefined &&
        current !== undefined &&
        previous.is_void === 0 &&
        previous.status === status &&
        previous.starts_on === startsOn &&
        previous.ends_on === endsOn
      )
        continue
      statements.push(
        this.c
          .prepare(`INSERT INTO company_employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`)
          .bind(
            periodId,
            (previous?.revision ?? 0) + 1,
            props.timeline.employmentId,
            props.timeline.employeeId,
            status,
            startsOn,
            endsOn,
            current === undefined ? 1 : 0,
            props.actionId,
            props.recordedAt,
          ),
      )
    }
    return statements
  }
}
