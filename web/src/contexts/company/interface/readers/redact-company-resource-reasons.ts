import type { CompanyChangeRecordEntity } from "@/contexts/company/domain/entities/company-change-record.entity"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"

const personnelTypes = [
  "person",
  "employee",
  "employment",
  "assignment",
  "reporting-relation",
  "grade-assignment",
  "office-assignment",
  "responsibility-assignment",
  "collective-body-membership",
  "organizational-authority",
  "account-employee-link",
  "personnel-action",
]

/** 資源の閲覧範囲は保ち、人事を含む操作の理由文を労務閲覧・編集資格または本人に限定する。 */
export async function redactCompanyResourceReasons(props: {
  database: D1Database
  organizationId: string
  actor: CompanyActorValue
  changes: ReadonlyArray<CompanyChangeRecordEntity["props"]>
}) {
  const { actor, changes } = props
  if (
    changes.length === 0 ||
    actor.hasPermission("employee:attributes:read") ||
    actor.hasPermission("employee:write")
  )
    return changes
  // ページ外も含む操作の全対象を調べ、人事資源の当該版がすべて本人のものかを照合する。ほかの職員が 1 人でも含まれれば伏せる。
  const rows = await props.database
    .prepare(`SELECT r.command_id, min(coalesce(?3 IS NOT NULL AND (
          (r.resource_type = 'employee' AND r.resource_id = ?3)
          OR json_extract(r.attributes_json, '$.employeeId') = ?3
          OR (r.resource_type = 'responsibility-assignment'
            AND json_extract(r.attributes_json, '$.holderType') = 'employee'
            AND json_extract(r.attributes_json, '$.holderId') = ?3)
          OR (r.resource_type = 'person' AND EXISTS (
            SELECT 1 FROM company_resource_revisions e
            WHERE e.organization_id = r.organization_id AND e.resource_type = 'employee'
              AND e.resource_id = ?3 AND json_extract(e.attributes_json, '$.personId') = r.resource_id
              AND e.revision = (SELECT max(prior.revision) FROM company_resource_revisions prior
                WHERE prior.organization_id = r.organization_id AND prior.resource_type = 'employee'
                  AND prior.resource_id = ?3 AND prior.organization_revision <= r.organization_revision)))
        ), 0)) AS is_own
        FROM json_each(?1) command
        JOIN company_resource_revisions r
          ON r.organization_id = ?2 AND r.command_id = command.value
        WHERE r.resource_type IN (SELECT value FROM json_each(?4))
        GROUP BY r.command_id`)
    .bind(
      JSON.stringify([...new Set(changes.map((change) => change.command_id))]),
      props.organizationId,
      actor.employeeId,
      JSON.stringify(personnelTypes),
    )
    .all<{ command_id: string; is_own: number }>()
  const restricted = new Set(
    rows.results.filter((row) => row.is_own !== 1).map((row) => row.command_id),
  )
  return changes.map((change) => ({
    ...change,
    reason: restricted.has(change.command_id) ? null : change.reason,
  }))
}
