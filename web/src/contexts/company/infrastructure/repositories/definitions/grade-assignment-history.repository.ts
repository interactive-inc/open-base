import { z } from "zod"
import { CompanySnapshotRevisionError } from "@/contexts/company/domain/errors"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"

type Context = D1Database

const revisionSchema = z.object({
  id: z.string(),
  revision: z.number().int().positive(),
  organizationRevision: z.number().int().positive(),
  state: z.enum(["active", "void"]),
  effectiveFrom: z.string().date(),
  effectiveTo: z.string().date().nullable(),
  employeeId: z.string(),
  employmentId: z.string(),
  gradeId: z.string(),
  commandId: z.string(),
  actorAccountId: z.string(),
  reason: z.string(),
  recordedAt: z.number().int().nonnegative(),
})

type Props = Readonly<{
  organizationId: string
  employeeId: string
  organizationRevision: number
  offset: number
  limit: number
}>

/** 指定会社版までの等級割当の全改訂を、判断根拠とともにページ単位で取得する。 */
export class GradeAssignmentHistoryRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(props: Props) {
    try {
      const row = await this.c
        .prepare(`
        SELECT o.revision AS current_revision,
          (SELECT json_group_array(json(entry)) FROM (
            SELECT json_object(
              'id', resource_id, 'revision', revision,
              'organizationRevision', organization_revision, 'state', state,
              'effectiveFrom', effective_from, 'effectiveTo', effective_to,
              'employeeId', json_extract(attributes_json, '$.employeeId'),
              'employmentId', json_extract(attributes_json, '$.employmentId'),
              'gradeId', json_extract(attributes_json, '$.gradeId'),
              'commandId', command_id, 'actorAccountId', actor_account_id,
              'reason', reason, 'recordedAt', recorded_at
            ) AS entry
            FROM company_resource_revisions
            WHERE organization_id = ?1 AND resource_type = 'grade-assignment'
              AND json_extract(attributes_json, '$.employeeId') = ?2
              AND organization_revision <= ?3
            ORDER BY organization_revision, resource_id, revision
            LIMIT ?4 OFFSET ?5
          )) AS history_json
        FROM company_organizations o WHERE o.id = ?1
      `)
        .bind(
          props.organizationId,
          props.employeeId,
          props.organizationRevision,
          props.limit + 1,
          props.offset,
        )
        .first<{ current_revision: number; history_json: string }>()
      if (row === null || props.organizationRevision > row.current_revision)
        return new CompanySnapshotRevisionError()
      const parsed = z.array(revisionSchema).safeParse(JSON.parse(row.history_json))
      if (!parsed.success) return parsed.error
      for (const revision of parsed.data) {
        const resource = CompanyResourceEntity.create({
          organizationId: props.organizationId,
          type: "grade-assignment",
          id: revision.id,
          revision: revision.revision,
          state: revision.state,
          effectiveFrom: restoreCalendarDate(revision.effectiveFrom),
          effectiveTo:
            revision.effectiveTo === null ? null : restoreCalendarDate(revision.effectiveTo),
          attributes: {
            employeeId: revision.employeeId,
            employmentId: revision.employmentId,
            gradeId: revision.gradeId,
          },
        })
        if (resource instanceof Error) return resource
      }
      return {
        organizationId: props.organizationId,
        organizationRevision: props.organizationRevision,
        employeeId: props.employeeId,
        revisions: parsed.data.slice(0, props.limit),
        nextOffset: parsed.data.length > props.limit ? props.offset + props.limit : null,
      }
    } catch (cause) {
      return new Error("Grade assignment history is unavailable", { cause })
    }
  }
}
