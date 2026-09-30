import { z } from "zod"
import { CompanyChangeRecordEntity } from "@/contexts/company/domain/entities/company-change-record.entity"
import { CompanySnapshotRevisionError } from "@/contexts/company/domain/errors"
import {
  companyResourceTypes,
  type CompanyResourceType,
} from "@/contexts/company/domain/catalogs/company-resource-type.catalog"

type Context = D1Database

type Props = Readonly<{
  organizationId: string
  afterRevision: number
  afterType: string | null
  afterId: string | null
  afterResourceRevision: number | null
  throughRevision: number | null
  limit: number
  visibleTypes?: ReadonlyArray<CompanyResourceType>
}>

/** 同じ会社版の複数変更も、資源の順序を含む再開位置から取得する。 */
export class CompanyChangeFeedRepository {
  constructor(private readonly c: Context) {}

  async list(props: Props) {
    try {
      const pages = await this.c.batch([
        this.c
          .prepare("SELECT revision FROM company_organizations WHERE id = ?")
          .bind(props.organizationId),
        this.c
          .prepare(`SELECT organization_revision, resource_type, resource_id, revision,
            command_id, actor_account_id, reason, evidence_references_json, corrects_revision, state,
            effective_from, effective_to, recorded_at
          FROM company_resource_revisions
          WHERE organization_id = ?1
            AND organization_revision <= coalesce(?2, (SELECT revision FROM company_organizations WHERE id = ?1))
            AND (resource_type IN (SELECT value FROM json_each(?7))
              OR resource_type NOT IN (SELECT value FROM json_each(?8)))
            AND (organization_revision > ?3 OR (
              organization_revision = ?3 AND ?4 IS NOT NULL AND
              (resource_type > ?4 OR (resource_type = ?4 AND (resource_id > ?5 OR (resource_id = ?5 AND revision > ?6))))))
          ORDER BY organization_revision, resource_type, resource_id, revision LIMIT ?9`)
          .bind(
            props.organizationId,
            props.throughRevision,
            props.afterRevision,
            props.afterType,
            props.afterId,
            props.afterResourceRevision,
            JSON.stringify(props.visibleTypes ?? companyResourceTypes),
            JSON.stringify(companyResourceTypes),
            props.limit + 1,
          ),
      ])
      const organization = z
        .array(z.object({ revision: z.number().int().nonnegative() }))
        .parse(pages[0]?.results)
      const currentRevision = organization[0]?.revision
      if (currentRevision === undefined) return new Error("Company organization is unavailable")
      const throughRevision = props.throughRevision ?? currentRevision
      if (throughRevision > currentRevision || props.afterRevision > throughRevision)
        return new CompanySnapshotRevisionError()
      const changes: CompanyChangeRecordEntity["props"][] = []
      for (const row of z.array(z.unknown()).parse(pages[1]?.results)) {
        const change = CompanyChangeRecordEntity.restore(row)
        if (change instanceof Error) return change
        changes.push(change.props)
      }
      const hasMore = changes.length > props.limit
      const visible = changes.slice(0, props.limit)
      const last = visible.at(-1)
      return {
        changes: visible,
        throughRevision,
        hasMore,
        next: {
          organizationId: props.organizationId,
          revision: hasMore && last !== undefined ? last.organization_revision : throughRevision,
          type: hasMore && last !== undefined ? last.resource_type : null,
          id: hasMore && last !== undefined ? last.resource_id : null,
          resourceRevision: hasMore && last !== undefined ? last.revision : null,
        },
      }
    } catch (cause) {
      return new Error("Company changes are unavailable", { cause })
    }
  }
}
