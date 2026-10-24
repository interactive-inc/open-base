import {
  CompanyPersonnelEventEntity,
  type CompanyEmploymentEffect,
} from "@/contexts/company/domain/entities/company-personnel-event.entity"
import { CompanyUnavailableError } from "@/contexts/company/domain/errors"

type Context = Readonly<{ env: Readonly<{ DB: D1Database }> }>
type Row = Readonly<{
  sequence: number
  id: string
  employee_id: string
  kind: string
  event_on: string
  recorded_at: number
  payload_fingerprint: string
  corrects_action_id: string | null
  corrected_by_action_id: string | null
  summary_json: string
}>
type Period = Readonly<{
  period_id: string
  revision: number
  starts_on: string
  ends_on: string | null
  is_void: number
}>
export type CompanyEmploymentEffectSnapshot = Readonly<{
  event: CompanyPersonnelEventEntity
  effect: CompanyEmploymentEffect | null
  status: "ready" | "future" | "superseded" | "obsolete" | "unresolved" | "unrelated"
  employeeRevision: number
  period: Period | null
  observedOn: string
}>
const selectEvent = `SELECT action.rowid AS sequence, action.id, action.employee_id, action.kind,
 action.event_on, action.recorded_at, action.payload_fingerprint, action.corrects_action_id, action.summary_json,
 (SELECT correction.id FROM company_personnel_actions correction WHERE correction.corrects_action_id = action.id) AS corrected_by_action_id
 FROM company_personnel_actions action`

/** 追記済み人事発令を読み、雇用効果の保存直前に同じ履歴版を照合する。 */
export class CompanyPersonnelEventRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async list(
    input: Readonly<{ after: number; limit: number; recordedSince: number }>,
  ): Promise<ReadonlyArray<CompanyPersonnelEventEntity> | Error> {
    if (
      !Number.isSafeInteger(input.after) ||
      input.after < 0 ||
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100 ||
      !Number.isSafeInteger(input.recordedSince) ||
      input.recordedSince < 0
    )
      return this.unavailable()
    try {
      const rows = await this.c.env.DB.prepare(
        `${selectEvent} WHERE action.rowid > ?1 AND action.recorded_at >= ?2 ORDER BY action.rowid LIMIT ?3`,
      )
        .bind(input.after, input.recordedSince, input.limit)
        .all<Row>()
      if (!rows.success) return this.unavailable()
      const events: CompanyPersonnelEventEntity[] = []
      for (const row of rows.results) {
        const event = this.restore(row)
        if (event instanceof Error) return event
        events.push(event)
      }
      return events
    } catch (cause) {
      return this.unavailable(cause)
    }
  }

  async find(id: string): Promise<CompanyPersonnelEventEntity | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(`${selectEvent} WHERE action.id = ?1`)
        .bind(id)
        .first<Row>()
      return row === null ? null : this.restore(row)
    } catch (cause) {
      return this.unavailable(cause)
    }
  }

  async findEmploymentEffect(
    id: string,
    observedOn: string,
  ): Promise<CompanyEmploymentEffectSnapshot | null | Error> {
    const event = await this.find(id)
    if (event === null || event instanceof Error) return event
    try {
      const employeeRevision = await this.c.env.DB.prepare(
        "SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = ?1",
      )
        .bind(event.props.employeeId)
        .first<number>("revision")
      if (employeeRevision === null) return this.unavailable()
      const effect = event.employmentEffect()
      const base = { event, employeeRevision, observedOn }
      if (effect instanceof Error)
        return { ...base, effect: null, period: null, status: "unresolved" }
      if (effect === null) return { ...base, effect, period: null, status: "unrelated" }
      if (event.props.correctedByActionId !== null)
        return { ...base, effect, period: null, status: "superseded" }
      if (effect.effectiveOn > observedOn)
        return { ...base, effect, period: null, status: "future" }
      const source =
        await this.c.env.DB.prepare(`SELECT DISTINCT period_id FROM company_employment_period_versions
        WHERE employee_id = ?1 AND recorded_by_action_id = ?2 AND is_void = 0
          AND ((?3 = 'retired' AND ends_on = ?4) OR (?3 <> 'retired' AND starts_on = ?4))`)
          .bind(event.props.employeeId, event.props.id, effect.kind, effect.effectiveOn)
          .all<{ period_id: string }>()
      if (!source.success) return this.unavailable()
      if (source.results.length !== 1 || source.results[0] === undefined)
        return { ...base, effect, period: null, status: "unresolved" }
      const period =
        await this.c.env.DB.prepare(`SELECT period_id, revision, starts_on, ends_on, is_void
        FROM company_employment_period_versions WHERE period_id = ?1 ORDER BY revision DESC LIMIT 1`)
          .bind(source.results[0].period_id)
          .first<Period>()
      if (period === null) return this.unavailable()
      if (period.is_void !== 0) return { ...base, effect, period, status: "obsolete" }
      if (effect.kind !== "retired") {
        const active =
          period.starts_on === effect.effectiveOn &&
          period.starts_on <= observedOn &&
          (period.ends_on === null || observedOn < period.ends_on)
        return { ...base, effect, period, status: active ? "ready" : "obsolete" }
      }
      const active =
        await this.c.env.DB.prepare(`SELECT count(*) AS total FROM company_employment_period_versions period
        WHERE employee_id = ?1 AND is_void = 0 AND starts_on <= ?2 AND (ends_on IS NULL OR ?2 < ends_on)
          AND revision = (SELECT max(current.revision) FROM company_employment_period_versions current WHERE current.period_id = period.period_id)`)
          .bind(event.props.employeeId, observedOn)
          .first<number>("total")
      if (active === null) return this.unavailable()
      return {
        ...base,
        effect,
        period,
        status: period.ends_on === effect.effectiveOn && active === 0 ? "ready" : "obsolete",
      }
    } catch (cause) {
      return this.unavailable(cause)
    }
  }

  prepareGuard(snapshot: CompanyEmploymentEffectSnapshot): D1PreparedStatement {
    return this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
      SELECT 1 FROM company_personnel_actions action JOIN company_employee_lifecycle_revisions employee ON employee.employee_id = action.employee_id
      WHERE action.id = ?1 AND action.employee_id = ?2 AND action.payload_fingerprint = ?3 AND employee.revision = ?4
        AND (SELECT correction.id FROM company_personnel_actions correction WHERE correction.corrects_action_id = action.id) IS ?5
        AND (?6 IS NULL OR (SELECT max(revision) FROM company_employment_period_versions WHERE period_id = ?6) = ?7)
      ) THEN 1 ELSE json_extract('{}', 'company_personnel_event_changed') END AS ok`).bind(
      snapshot.event.props.id,
      snapshot.event.props.employeeId,
      snapshot.event.props.fingerprint,
      snapshot.employeeRevision,
      snapshot.event.props.correctedByActionId,
      snapshot.period?.period_id ?? null,
      snapshot.period?.revision ?? null,
    )
  }

  private restore(row: Row): CompanyPersonnelEventEntity | Error {
    try {
      return CompanyPersonnelEventEntity.create({
        sequence: row.sequence,
        id: row.id,
        employeeId: row.employee_id,
        kind: row.kind,
        eventOn: row.event_on,
        recordedAt: row.recorded_at,
        fingerprint: row.payload_fingerprint,
        correctsActionId: row.corrects_action_id,
        correctedByActionId: row.corrected_by_action_id,
        summary: JSON.parse(row.summary_json),
      })
    } catch (cause) {
      return this.unavailable(cause)
    }
  }

  private unavailable(cause?: unknown): CompanyUnavailableError {
    return new CompanyUnavailableError(
      "人事発令の配送元を確認できません",
      "company_personnel_event_unavailable",
      { cause },
    )
  }
}
