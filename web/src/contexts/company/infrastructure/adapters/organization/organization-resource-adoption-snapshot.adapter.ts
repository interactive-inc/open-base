import { OrganizationResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/organization-resource-adoption-snapshot.value"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
type Context = D1Database

/** 台帳の履歴と版を同じSQLで読み、保存直前にも同じsnapshotを検査する。 */
export class OrganizationResourceAdoptionSnapshotAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async find(
    organizationUnitId: string,
  ): Promise<OrganizationResourceAdoptionSnapshotValue | null | Error> {
    try {
      const row = await this.c
        .prepare(this.query())
        .bind(organizationUnitId)
        .first<{ snapshot_json: string }>()
      return row === null
        ? null
        : OrganizationResourceAdoptionSnapshotValue.create(row.snapshot_json)
    } catch (cause) {
      return new Error("failed to read organization adoption snapshot", { cause })
    }
  }
  prepareGuard(snapshot: OrganizationResourceAdoptionSnapshotValue): D1PreparedStatement {
    return this.c
      .prepare(
        `SELECT CASE WHEN coalesce((${this.query()}), '') = ?2 THEN 1 ELSE json_extract('', '$') END`,
      )
      .bind(snapshot.props.value.organizationUnit.id, snapshot.props.sourceJson)
  }
  private query(): string {
    return `SELECT json_object(
      'organizationRevision', (SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'),
      'lifecycleRevision', (SELECT revision FROM company_organization_lifecycle_states WHERE id = 1),
      'pendingOperations', (SELECT count(*) FROM company_organization_change_operations WHERE status = 'PENDING'),
      'organizationUnit', json_object('id', unit.id, 'createdAt', unit.created_at),
      'bindingOrganizationId', (SELECT organization_id FROM company_organization_resource_bindings WHERE organization_unit_id = unit.id),
      'periods', json((SELECT json_group_array(json(period_json)) FROM (
        SELECT json_object('periodId', period.period_id, 'revision', period.revision,
          'organizationUnitId', period.organization_unit_id, 'code', period.code, 'officialName', period.official_name,
          'kind', period.kind, 'parentOrganizationUnitId', period.parent_organization_unit_id,
          'startsOn', period.starts_on, 'endsOn', period.ends_on, 'isVoid', period.is_void,
          'recordedByActionId', period.recorded_by_action_id, 'recordedAt', period.recorded_at,
          'actorAccountId', operation.actor_account_id, 'reason', operation.reason,
          'evidenceReferencesJson', operation.evidence_references_json, 'requestFingerprint', operation.request_fingerprint) AS period_json
        FROM company_organization_unit_period_versions AS period
        LEFT JOIN company_organization_change_operations AS operation ON operation.id = period.recorded_by_action_id
        WHERE period.organization_unit_id = unit.id ORDER BY period.period_id, period.revision
      )))
    ) AS snapshot_json FROM company_organization_units AS unit WHERE unit.id = ?1`
  }
}
