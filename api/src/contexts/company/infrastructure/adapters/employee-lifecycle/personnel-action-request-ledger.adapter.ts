import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

type Context = D1Database

export type PersonnelActionRequestRecord = Readonly<{
  id: string
  systemProposalSeriesId: string
  targetEmployeeId: string | null
  subjectSnapshotJson: string | null
  targetDepartmentCode: string | null
  kind: string
  payloadJson: string
  payloadFingerprint: string
  requestedByEmployeeId: string
  baseEmployeeRevision: number | null
  baseOrganizationRevision: number | null
  baseCompanyRevision: number | null
  createdAt: number
}>

export type PersonnelActionRequestRow = Readonly<{
  id: string
  application_id: number
  system_proposal_series_id: string | null
  target_employee_id: EmployeeId | null
  target_department_code: string | null
  target_employee_code: string | null
  target_employee_name: string | null
  kind: string
  payload_json: string
  payload_fingerprint: string | null
  requested_by_employee_id: EmployeeId
  base_employee_revision: number | null
  base_organization_revision: number | null
  base_company_revision: number | null
  created_at: number
  applied_action_id: string | null
  withdrawn_at: number | null
}>

/** 人事変更申請とSystemの提案の対応を保存し、申請の一覧を返す。 */
export class PersonnelActionRequestLedgerAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /**
   * Systemの提案の保存と同じbatchへ入れるstatementを返す。
   * 申請番号は同じbatchで採番された提案番号を読む。採番が無ければ行を作らない。
   */
  prepareInsert(record: PersonnelActionRequestRecord): D1PreparedStatement {
    return this.c
      .prepare(
        `INSERT INTO company_personnel_action_requests
             (id, application_id, system_proposal_series_id, target_employee_id,
              subject_snapshot_json, target_department_code, kind, payload_json,
              payload_fingerprint, requested_by_employee_id, base_employee_revision,
              base_organization_revision, base_company_revision, created_at, applied_action_id)
           VALUES (?1, (SELECT number FROM system_proposal_numbers WHERE series_id = ?2),
                   ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, NULL)`,
      )
      .bind(
        record.id,
        record.systemProposalSeriesId,
        record.targetEmployeeId,
        record.subjectSnapshotJson,
        record.targetDepartmentCode,
        record.kind,
        record.payloadJson,
        record.payloadFingerprint,
        record.requestedByEmployeeId,
        record.baseEmployeeRevision,
        record.baseOrganizationRevision,
        record.baseCompanyRevision,
        record.createdAt,
      )
  }

  /** 申請を新しい順に返す。対象者の番号と氏名は申請時のsnapshotから取り出す。 */
  async list(): Promise<ReadonlyArray<PersonnelActionRequestRow> | Error> {
    try {
      const rows = await this.c
        .prepare(
          `SELECT request.id, request.application_id, request.system_proposal_series_id,
                request.target_employee_id, request.target_department_code,
                json_extract(request.subject_snapshot_json, '$.employeeCode')
                  AS target_employee_code,
                json_extract(request.subject_snapshot_json, '$.employeeName')
                  AS target_employee_name,
                request.kind, request.payload_json, request.payload_fingerprint,
                request.requested_by_employee_id,
                request.base_employee_revision, request.base_organization_revision, request.base_company_revision,
                request.created_at, request.applied_action_id, request.withdrawn_at
         FROM company_personnel_action_requests AS request
         ORDER BY request.created_at DESC, request.id DESC`,
        )
        .all<PersonnelActionRequestRow>()
      return rows.success ? rows.results : new Error("personnel action requests are unavailable")
    } catch (cause) {
      return new Error("personnel action requests are unavailable", { cause })
    }
  }
}
