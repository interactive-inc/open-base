type Context = D1Database

/** 確認済みの初期期間の補正を、人事発令と新しい期間版として接続と同時に保存する。 */
export class EmployeeResourceAdoptionTerminationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(payload: string): ReadonlyArray<D1PreparedStatement> {
    return [
      this.c
        .prepare(`SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM json_each(?1) AS employee
        WHERE json_type(employee.value, '$.termination') = 'object' AND NOT EXISTS (
          SELECT 1 FROM company_personnel_actions AS original
          WHERE original.id = json_extract(employee.value, '$.termination.previousActionId')
            AND original.employee_id = json_extract(employee.value, '$.employeeId')
            AND original.kind = 'initial_state'
        )
      ) THEN 1 ELSE json_extract('', '$') END`)
        .bind(payload),
      this.c
        .prepare(`INSERT INTO company_personnel_actions
        (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
         requested_by_employee_id, source_type, source_application_id, corrects_action_id,
         operation_id, payload_fingerprint, summary_json)
        SELECT json_extract(value, '$.termination.actionId'), json_extract(value, '$.employeeId'),
          'employment_revised', json_extract(value, '$.observedOn'), CAST(json_extract(value, '$.recordedAt') / 1000 AS INTEGER),
          json_extract(value, '$.actorAccountId'), NULL, 'direct', NULL,
          json_extract(value, '$.termination.previousActionId'), json_extract(value, '$.commandId'),
          json_extract(value, '$.fingerprint'),
          json_object('kind', 'employment_revised', 'eventOn', json_extract(value, '$.observedOn'),
            'employeeId', json_extract(value, '$.employeeId'), 'status', 'retired',
            'resourceId', json_extract(value, '$.termination.resource.id'),
            'resourceRevision', json_extract(value, '$.termination.resource.revision'),
            'resource', json_extract(value, '$.termination.resource.attributes'),
            'reason', json_extract(value, '$.reason'))
        FROM json_each(?1) WHERE json_type(value, '$.termination') = 'object'`)
        .bind(payload),
      this.c
        .prepare(`INSERT INTO company_employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
        SELECT json_extract(value, '$.termination.employment.periodId'), 2, json_extract(value, '$.employeeId'),
          json_extract(value, '$.termination.employment.startsOn'), json_extract(value, '$.termination.employment.endsOn'),
          0, json_extract(value, '$.termination.actionId'), CAST(json_extract(value, '$.recordedAt') / 1000 AS INTEGER)
        FROM json_each(?1) WHERE json_type(value, '$.termination') = 'object'`)
        .bind(payload),
      this.c
        .prepare(`INSERT INTO company_employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at)
        SELECT json_extract(value, '$.termination.status.periodId'), 2,
          json_extract(value, '$.termination.status.employmentPeriodId'), json_extract(value, '$.employeeId'),
          json_extract(value, '$.termination.status.status'), json_extract(value, '$.termination.status.startsOn'),
          json_extract(value, '$.termination.status.endsOn'), 0, json_extract(value, '$.termination.actionId'),
          CAST(json_extract(value, '$.recordedAt') / 1000 AS INTEGER)
        FROM json_each(?1) WHERE json_type(value, '$.termination') = 'object'`)
        .bind(payload),
      this.c
        .prepare(`UPDATE company_employee_lifecycle_revisions SET revision = revision + 1,
        updated_at = (SELECT CAST(json_extract(value, '$.recordedAt') / 1000 AS INTEGER)
          FROM json_each(?1) WHERE json_extract(value, '$.employeeId') = employee_id)
        WHERE EXISTS (
          SELECT 1 FROM json_each(?1)
          WHERE json_type(value, '$.termination') = 'object'
            AND json_extract(value, '$.employeeId') = employee_id
            AND json_extract(value, '$.lifecycleRevision') = revision + 1
        )`)
        .bind(payload),
      this.c
        .prepare(`SELECT CASE WHEN changes() = (
        SELECT count(*) FROM json_each(?1) WHERE json_type(value, '$.termination') = 'object'
      ) THEN 1 ELSE json_extract('', '$') END`)
        .bind(payload),
    ]
  }
}
