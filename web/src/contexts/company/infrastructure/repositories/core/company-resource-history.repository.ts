import { z } from "zod"
import {
  CompanyResourceEntity,
  type CompanyJsonObject,
} from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyChangeRecordEntity } from "@/contexts/company/domain/entities/company-change-record.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanySnapshotRevisionError } from "@/contexts/company/domain/errors"
import type { CompanyResourceType } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"

type Query = Readonly<{
  organizationId: string
  type: CompanyResourceType
  id: string
  afterRevision: number
  throughRevision: number | null
  limit: number
}>

const resourceRowSchema = z.object({ attributes_json: z.string() })

type Context = D1Database

/** 一資源の全revisionを、指定した会社版を超えない位置で順に取得する。 */
export class CompanyResourceHistoryRepository {
  constructor(private readonly c: Context) {}

  async list(query: Query) {
    try {
      const pages = await this.c.batch([
        this.c
          .prepare("SELECT revision FROM company_organizations WHERE id = ?")
          .bind(query.organizationId),
        this.c
          .prepare(`SELECT organization_revision, resource_type, resource_id, revision,
            command_id, actor_account_id, reason, evidence_references_json, corrects_revision,
            state, effective_from, effective_to, recorded_at, attributes_json
          FROM company_resource_revisions
          WHERE organization_id = ?1 AND resource_type = ?2 AND resource_id = ?3
            AND revision > ?4
            AND organization_revision <= coalesce(?5, (SELECT revision FROM company_organizations WHERE id = ?1))
          ORDER BY revision LIMIT ?6`)
          .bind(
            query.organizationId,
            query.type,
            query.id,
            query.afterRevision,
            query.throughRevision,
            query.limit + 1,
          ),
      ])
      const organization = z
        .array(z.object({ revision: z.number().int().nonnegative() }))
        .parse(pages[0]?.results)
      const currentRevision = organization[0]?.revision
      if (currentRevision === undefined) return new Error("Company organization is unavailable")
      const throughRevision = query.throughRevision ?? currentRevision
      if (throughRevision > currentRevision) return new CompanySnapshotRevisionError()

      const records: Array<{
        change: CompanyChangeRecordEntity["props"]
        resource: ReturnType<CompanyResourceEntity["toProps"]>
      }> = []
      for (const row of z.array(z.unknown()).parse(pages[1]?.results)) {
        const change = CompanyChangeRecordEntity.restore(row)
        if (change instanceof Error) return change
        const resourceRow = resourceRowSchema.parse(row)
        const attributes: unknown = JSON.parse(resourceRow.attributes_json)
        if (attributes === null || typeof attributes !== "object" || Array.isArray(attributes))
          return new Error("Invalid Company resource attributes")
        const resource = CompanyResourceEntity.create({
          organizationId: query.organizationId,
          type: change.props.resource_type,
          id: change.props.resource_id,
          revision: change.props.revision,
          state: change.props.state,
          effectiveFrom: restoreCalendarDate(change.props.effective_from),
          effectiveTo:
            change.props.effective_to === null
              ? null
              : restoreCalendarDate(change.props.effective_to),
          attributes: attributes as CompanyJsonObject,
        })
        if (resource instanceof Error) return resource
        records.push({ change: change.props, resource: resource.toProps() })
      }
      const hasMore = records.length > query.limit
      const data = records.slice(0, query.limit)
      return {
        organizationId: query.organizationId,
        throughRevision,
        data,
        hasMore,
        nextAfterRevision: data.at(-1)?.resource.revision ?? query.afterRevision,
      }
    } catch (cause) {
      return new Error("Company resource history is unavailable", { cause })
    }
  }
}
