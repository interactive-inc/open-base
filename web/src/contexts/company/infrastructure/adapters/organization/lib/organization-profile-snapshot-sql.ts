/** 会社版、公開profileの有効な訂正、移行前の会社情報を一つのsnapshotに固定する。 */
export function organizationProfileSnapshotSql(): string {
  return `SELECT json_object(
    'organizationId', organization.id, 'organizationRevision', organization.revision,
    'legacyName', organization.name, 'legacyRepresentativeName', organization.representative_name,
    'legacyUpdatedAt', organization.updated_at,
    'profileCount', (SELECT count(*) FROM company_resource_heads WHERE organization_id = organization.id AND resource_type = 'company-profile'),
    'resourceId', head.resource_id, 'resourceRevision', head.revision,
    'state', effective.state, 'effectiveTo', effective.effective_to, 'attributesJson', effective.attributes_json
  ) AS source_json
  FROM company_organizations organization
  LEFT JOIN company_resource_heads head ON head.organization_id = organization.id AND head.resource_type = 'company-profile'
  LEFT JOIN company_resource_revisions effective ON effective.organization_id = organization.id
    AND effective.resource_type = 'company-profile' AND effective.resource_id = head.resource_id
    AND effective.revision = (SELECT resource.revision FROM company_resource_revisions resource
      WHERE resource.organization_id = organization.id AND resource.resource_type = 'company-profile'
        AND resource.resource_id = head.resource_id AND resource.organization_revision <= organization.revision
        AND resource.effective_from <= ?2
        AND NOT EXISTS (SELECT 1 FROM company_resource_revisions newer
          WHERE newer.organization_id = resource.organization_id
            AND newer.resource_type = resource.resource_type AND newer.resource_id = resource.resource_id
            AND newer.effective_from = resource.effective_from AND newer.revision > resource.revision
            AND newer.organization_revision <= organization.revision)
        AND NOT (resource.state = 'void' AND resource.corrects_revision IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM company_resource_revisions correction
          WHERE correction.organization_id = resource.organization_id
            AND correction.resource_type = resource.resource_type AND correction.resource_id = resource.resource_id
            AND correction.corrects_revision = resource.revision
            AND correction.organization_revision <= organization.revision)
      ORDER BY resource.effective_from DESC, resource.revision DESC LIMIT 1)
  WHERE organization.id = ?1`
}
