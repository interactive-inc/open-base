import { CompanyOrganizationResourceProjectionAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-organization-resource-projection.adapter"
import { validateCompanyOrganizationChange } from "@/contexts/company/domain/policies/company-organization.policy"
import type { CompanyJsonObject } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import type { CompanyResourceType } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"
import type { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import {
  CompanyResourceJournalAdapter,
  type PreparedCompanyResourceJournal,
} from "@/contexts/company/infrastructure/adapters/core/company-resource-journal.adapter"
import {
  CompanyResourceValidationError,
  CompanySnapshotRevisionError,
} from "@/contexts/company/domain/errors"
import { CompanyWorkforceResourceProjectionAdapter } from "@/contexts/company/infrastructure/adapters/employee/company-workforce-resource-projection.adapter"
import { drizzle } from "drizzle-orm/d1"

export type CompanyResourceQuery = Readonly<{
  organizationId: string
  types: ReadonlyArray<CompanyResourceType>
  ids?: ReadonlyArray<string>
  codes?: ReadonlyArray<string>
  /** 雇用の版を確定した後、その版の従業員で絞る。 */
  employmentEmployeeIds?: ReadonlyArray<string>
  /** Account 対応の版を確定した後、その版の従業員で絞る。 */
  accountLinkEmployeeIds?: ReadonlyArray<string>
  /** Account 対応の版を確定した後、その版の Account で絞る。 */
  accountLinkAccountIds?: ReadonlyArray<string>
  effectiveOn?: CalendarDate
  /** 時点までに開始した終了済み資源も、履歴上の参照先として返す。 */
  includeEnded?: boolean
  organizationRevision?: number
}>

export type CompanyResourceReadResult =
  | Readonly<{
      ok: true
      organizationRevision: number
      resources: ReadonlyArray<CompanyResourceEntity>
    }>
  | Readonly<{ ok: false; cause: unknown }>

export type CompanyResourceWriteResult =
  | Readonly<{ kind: "applied"; organizationRevision: number; replayed: boolean }>
  | Readonly<{ kind: "invalid"; error: CompanyResourceValidationError }>
  | Readonly<{ kind: "conflict"; actualRevision: number }>
  | Readonly<{ kind: "command_conflict" }>
  | Readonly<{
      kind: "resource_conflict"
      type: CompanyResourceType
      id: string
      actualRevision: number
    }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

export type CompanyResourceRepository = Readonly<{
  findMany: (query: CompanyResourceQuery) => Promise<CompanyResourceReadResult>
  write: (change: CompanyResourceChangeEntity) => Promise<CompanyResourceWriteResult>
}>

type CompanyResourceRow = Readonly<{
  organization_id: string
  resource_type: string
  resource_id: string
  revision: number
  state: string
  effective_from: string
  effective_to: string | null
  attributes_json: string
}>

type CompanyCommandReceiptRow = Readonly<{
  fingerprint: string
  organization_revision: number
}>

type CompanyResourceCandidateFilter = Readonly<{ condition: string; binds: ReadonlyArray<string> }>

function placeholders(values: ReadonlyArray<unknown>): string {
  return values.map(() => "?").join(", ")
}

/**
 * 属性で絞る照会は、版を選ぶ前にその値を一度でも持った resource へ候補を狭める。
 * 版の選択は resource ごとに閉じるので、選ばれた版が条件を満たす resource は必ず候補に残り、結果は変わらない。
 * 種別と JSON path を文字列のまま書くのは、部分式索引（company_resource_revisions_*_lookup_idx）に一致させるため。
 */
function toCandidateFilters(
  query: CompanyResourceQuery,
): ReadonlyArray<CompanyResourceCandidateFilter> {
  const lookups = [
    { type: "account-employee-link", path: "$.accountId", values: query.accountLinkAccountIds },
    { type: "account-employee-link", path: "$.employeeId", values: query.accountLinkEmployeeIds },
    { type: "employment", path: "$.employeeId", values: query.employmentEmployeeIds },
  ]
  const filters: CompanyResourceCandidateFilter[] = []
  for (const lookup of lookups) {
    if (lookup.values === undefined) continue
    filters.push({
      condition: `AND resource.resource_id IN (
        SELECT candidate.resource_id FROM company_resource_revisions AS candidate
         WHERE candidate.organization_id = ?
           AND candidate.resource_type = '${lookup.type}'
           AND json_extract(candidate.attributes_json, '${lookup.path}') IN (SELECT value FROM json_each(?))
      )`,
      binds: [query.organizationId, JSON.stringify(lookup.values)],
    })
  }
  return filters
}

function toCompanyResource(row: CompanyResourceRow): CompanyResourceEntity | Error {
  if (!CompanyResourceEntity.isType(row.resource_type)) {
    return new Error("Unknown Company resource type")
  }
  if (row.state !== "active" && row.state !== "void") return new Error("Invalid Company state")

  let attributes: unknown
  try {
    attributes = JSON.parse(row.attributes_json)
  } catch (cause) {
    return new Error("Invalid Company attributes", { cause })
  }
  if (attributes === null || typeof attributes !== "object" || Array.isArray(attributes)) {
    return new Error("Invalid Company attributes")
  }

  return CompanyResourceEntity.create({
    organizationId: row.organization_id,
    type: row.resource_type,
    id: row.resource_id,
    revision: row.revision,
    state: row.state,
    effectiveFrom: row.effective_from as CalendarDate,
    effectiveTo: row.effective_to as CalendarDate | null,
    attributes: attributes as CompanyJsonObject,
  })
}
type Context = Readonly<{
  database: D1Database
  atomicStatements?: ReadonlyArray<D1PreparedStatement>
  /** 同じcommandIdの再送で、Company外の同一batch書込も一致させる。 */
  atomicPayload?: unknown
}>

/** Company resource revisions の D1 永続化。 */
export class D1CompanyResourceRepository implements CompanyResourceRepository {
  constructor(private readonly c: Context) {}

  async findMany(query: CompanyResourceQuery): Promise<CompanyResourceReadResult> {
    if (
      query.types.length < 1 ||
      query.types.length > 100 ||
      (query.ids?.length ?? 0) > 100 ||
      (query.codes?.length ?? 0) > 100 ||
      (query.employmentEmployeeIds?.length ?? 0) > 100 ||
      (query.accountLinkEmployeeIds?.length ?? 0) > 100 ||
      (query.accountLinkAccountIds?.length ?? 0) > 100 ||
      (query.employmentEmployeeIds !== undefined &&
        (query.types.length !== 1 || query.types[0] !== "employment")) ||
      (query.accountLinkEmployeeIds !== undefined &&
        (query.types.length !== 1 || query.types[0] !== "account-employee-link")) ||
      (query.accountLinkAccountIds !== undefined &&
        (query.types.length !== 1 || query.types[0] !== "account-employee-link"))
    ) {
      return { ok: false, cause: new Error("Invalid Company resource query") }
    }

    if (
      query.organizationRevision !== undefined &&
      (!Number.isSafeInteger(query.organizationRevision) || query.organizationRevision < 0)
    ) {
      return { ok: false, cause: new CompanySnapshotRevisionError() }
    }
    if (query.includeEnded === true && query.effectiveOn === undefined) {
      return { ok: false, cause: new Error("includeEnded requires effectiveOn") }
    }

    try {
      const binds: unknown[] = []
      // ID と種別の上限をそれぞれ許容し、時点・会社の条件を足しても D1 の bind 上限を超えない。
      const conditions = ["resource_type IN (SELECT value FROM json_each(?))"]
      binds.push(JSON.stringify(query.types))
      if (query.ids !== undefined && query.ids.length > 0) {
        conditions.push("resource_id IN (SELECT value FROM json_each(?))")
        binds.push(JSON.stringify(query.ids))
      }

      // code は版を選んだ後で絞る。先に絞ると改名済みの旧版が復活する。
      const codeCondition =
        query.codes === undefined
          ? ""
          : "AND json_extract(attributes_json, '$.code') IN (SELECT value FROM json_each(?))"
      const codeBinds = query.codes === undefined ? [] : [JSON.stringify(query.codes)]
      const resourceEmployeeIds = query.employmentEmployeeIds ?? query.accountLinkEmployeeIds
      const resourceEmployeeCondition =
        resourceEmployeeIds === undefined
          ? ""
          : "AND json_extract(attributes_json, '$.employeeId') IN (SELECT value FROM json_each(?))"
      const resourceEmployeeBinds =
        resourceEmployeeIds === undefined ? [] : [JSON.stringify(resourceEmployeeIds)]
      const accountCondition =
        query.accountLinkAccountIds === undefined
          ? ""
          : "AND json_extract(attributes_json, '$.accountId') IN (SELECT value FROM json_each(?))"
      const accountBinds =
        query.accountLinkAccountIds === undefined
          ? []
          : [JSON.stringify(query.accountLinkAccountIds)]
      const effectiveEndCondition =
        query.includeEnded === true ? "" : "AND (effective_to IS NULL OR effective_to > ?)"
      const candidateFilters = toCandidateFilters(query)
      const candidateCondition = candidateFilters.map((filter) => filter.condition).join("\n")
      const candidateBinds = candidateFilters.flatMap((filter) => filter.binds)
      // 候補で絞るときは、単項 + で会社版の範囲条件を索引に使わせない。統計の無いDBでは、会社版の範囲で
      // 組織の全版を読む索引が、候補の resource を一意索引で引く計画より先に選ばれるため。
      const revisionColumn =
        candidateFilters.length === 0
          ? "resource.organization_revision"
          : "+resource.organization_revision"

      const resourceStatement =
        query.organizationRevision !== undefined
          ? this.c.database
              .prepare(
                `WITH date_ranked AS (
                 SELECT resource.*,
                        row_number() OVER (
                          PARTITION BY resource.resource_type, resource.resource_id,
                            CASE WHEN ? IS NULL OR resource.resource_type = 'organization-unit'
                              THEN NULL ELSE resource.effective_from END
                          ORDER BY resource.revision DESC
                        ) AS date_rank
                   FROM company_resource_revisions resource
                  WHERE resource.organization_id = ?
                    AND ${revisionColumn} <= ?
                    AND (? IS NULL OR resource.resource_type = 'organization-unit' OR resource.effective_from <= ?)
                    AND ${conditions.map((condition) => `resource.${condition}`).join(" AND ")}
                    ${candidateCondition}
               ), ranked_resources AS (
                 SELECT date_ranked.*,
                        row_number() OVER (
                          PARTITION BY resource_type, resource_id
                          ORDER BY CASE WHEN ? IS NULL OR resource_type = 'organization-unit'
                            THEN NULL ELSE effective_from END DESC, revision DESC
                        ) AS effective_rank
                   FROM date_ranked
                  WHERE date_rank = 1 AND NOT (state = 'void' AND corrects_revision IS NOT NULL)
                    AND NOT EXISTS (
                      SELECT 1 FROM company_resource_revisions correction
                       WHERE correction.organization_id = date_ranked.organization_id
                         AND correction.resource_type = date_ranked.resource_type
                         AND correction.resource_id = date_ranked.resource_id
                         AND correction.corrects_revision = date_ranked.revision
                         AND correction.organization_revision <= ?
                    )
               )
               SELECT organization_id, resource_type, resource_id, revision, state,
                      effective_from, effective_to, attributes_json
                 FROM ranked_resources
                WHERE effective_rank = 1 AND state = 'active'
                  AND (? IS NULL OR (effective_from <= ? ${effectiveEndCondition}))
                ${codeCondition}
                ${resourceEmployeeCondition}
                ${accountCondition}
                  ORDER BY resource_type, resource_id`,
              )
              .bind(
                query.effectiveOn ?? null,
                query.organizationId,
                query.organizationRevision,
                query.effectiveOn ?? null,
                query.effectiveOn ?? null,
                ...binds,
                ...candidateBinds,
                query.effectiveOn ?? null,
                query.organizationRevision,
                query.effectiveOn ?? null,
                query.effectiveOn ?? null,
                ...(query.includeEnded === true ? [] : [query.effectiveOn ?? null]),
                ...codeBinds,
                ...resourceEmployeeBinds,
                ...accountBinds,
              )
          : query.effectiveOn === undefined
            ? this.c.database
                .prepare(
                  `SELECT organization_id, resource_type, resource_id, revision, state,
                        effective_from, effective_to, attributes_json
                   FROM company_resource_heads
                  WHERE organization_id = ?
                    AND state = 'active'
                    AND ${conditions.join(" AND ")}
                  ${codeCondition}
                  ${resourceEmployeeCondition}
                  ${accountCondition}
                  ORDER BY resource_type, resource_id`,
                )
                .bind(
                  query.organizationId,
                  ...binds,
                  ...codeBinds,
                  ...resourceEmployeeBinds,
                  ...accountBinds,
                )
            : this.c.database
                .prepare(
                  `WITH snapshot AS (
                   SELECT revision
                     FROM company_organizations
                    WHERE id = ?
                 ),
                 date_ranked AS (
                   SELECT resource.organization_id,
                          resource.resource_type,
                          resource.resource_id,
                          resource.revision,
                          resource.state,
                          resource.effective_from,
                          resource.effective_to,
                          resource.attributes_json,
                          resource.corrects_revision,
                          row_number() OVER (
                            PARTITION BY resource.resource_type, resource.resource_id,
                              CASE WHEN resource.resource_type = 'organization-unit' THEN NULL ELSE resource.effective_from END
                            ORDER BY resource.revision DESC
                          ) AS date_rank
                     FROM company_resource_revisions AS resource
                     CROSS JOIN snapshot
                    WHERE resource.organization_id = ?
                      AND ${revisionColumn} <= snapshot.revision
                      AND (resource.resource_type = 'organization-unit' OR resource.effective_from <= ?)
                      AND ${conditions.map((condition) => `resource.${condition}`).join(" AND ")}
                    ${candidateCondition}
                 ), ranked_resources AS (
                   SELECT date_ranked.*,
                          row_number() OVER (
                            PARTITION BY resource_type, resource_id
                            ORDER BY CASE WHEN resource_type = 'organization-unit' THEN NULL ELSE effective_from END DESC, revision DESC
                          ) AS effective_rank
                     FROM date_ranked
                    WHERE date_rank = 1 AND NOT (state = 'void' AND corrects_revision IS NOT NULL)
                      AND NOT EXISTS (
                        SELECT 1 FROM company_resource_revisions correction
                         WHERE correction.organization_id = date_ranked.organization_id
                           AND correction.resource_type = date_ranked.resource_type
                           AND correction.resource_id = date_ranked.resource_id
                           AND correction.corrects_revision = date_ranked.revision
                           AND correction.organization_revision <= (SELECT revision FROM snapshot)
                      )
                 )
                 SELECT organization_id, resource_type, resource_id, revision, state,
                        effective_from, effective_to, attributes_json
                   FROM ranked_resources
                  WHERE effective_rank = 1
                    AND state = 'active'
                    AND effective_from <= ?
                    ${effectiveEndCondition}
                  ${codeCondition}
                  ${resourceEmployeeCondition}
                  ${accountCondition}
                  ORDER BY resource_type, resource_id`,
                )
                .bind(
                  query.organizationId,
                  query.organizationId,
                  query.effectiveOn,
                  ...binds,
                  ...candidateBinds,
                  query.effectiveOn,
                  ...(query.includeEnded === true ? [] : [query.effectiveOn]),
                  ...codeBinds,
                  ...resourceEmployeeBinds,
                  ...accountBinds,
                )

      const [revisionResult, resourceResult] = await this.c.database.batch([
        this.c.database
          .prepare("SELECT revision FROM company_organizations WHERE id = ?")
          .bind(query.organizationId),
        resourceStatement,
      ])
      const revisionRow = revisionResult?.results[0]
      const revision =
        revisionRow !== undefined &&
        revisionRow !== null &&
        typeof revisionRow === "object" &&
        "revision" in revisionRow
          ? revisionRow.revision
          : undefined
      if (
        revision !== undefined &&
        (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0)
      ) {
        return { ok: false, cause: new Error("Invalid Company organization revision") }
      }

      if (
        query.organizationRevision !== undefined &&
        (typeof revision !== "number" || query.organizationRevision > revision)
      ) {
        return { ok: false, cause: new CompanySnapshotRevisionError() }
      }

      const resources: CompanyResourceEntity[] = []
      for (const row of resourceResult?.results ?? []) {
        const resource = toCompanyResource(row as CompanyResourceRow)
        if (resource instanceof Error) return { ok: false, cause: resource }
        resources.push(resource)
      }
      return {
        ok: true,
        organizationRevision: query.organizationRevision ?? (revision === undefined ? 0 : revision),
        resources,
      }
    } catch (cause) {
      return { ok: false, cause }
    }
  }

  async write(change: CompanyResourceChangeEntity): Promise<CompanyResourceWriteResult> {
    return this.persist(change, false)
  }

  async writeOrganizationChange(
    change: CompanyResourceChangeEntity,
  ): Promise<CompanyResourceWriteResult> {
    return this.persist(change, true)
  }

  private async persist(
    change: CompanyResourceChangeEntity,
    isOrganizationChange: boolean,
  ): Promise<CompanyResourceWriteResult> {
    const organizationId = change.resources[0]?.organizationId
    if (organizationId === undefined) {
      return { kind: "unavailable", cause: new Error("Empty change") }
    }
    if ((this.c.atomicStatements?.length ?? 0) > 0 && this.c.atomicPayload === undefined) {
      return { kind: "unavailable", cause: new Error("Atomic statements require a payload") }
    }
    const journal = await new CompanyResourceJournalAdapter({
      database: drizzle(this.c.database),
      d1: this.c.database,
    }).prepare(change, this.c.atomicPayload)
    if (journal instanceof Error) return { kind: "unavailable", cause: journal }
    const commandFingerprint = journal.fingerprint

    const replay = await this.readCommandReceipt(organizationId, change.commandId)
    if (replay !== null) {
      return replay.fingerprint === commandFingerprint
        ? { kind: "applied", organizationRevision: replay.organization_revision, replayed: true }
        : { kind: "command_conflict" }
    }

    const written = await this.persistPrepared(change, journal, isOrganizationChange).catch(
      (cause: unknown): CompanyResourceWriteResult => ({ kind: "unavailable", cause }),
    )
    if (written.kind === "applied") return written
    const concurrentReplay = await this.readCommandReceipt(organizationId, change.commandId)
    if (concurrentReplay !== null) {
      return concurrentReplay.fingerprint === commandFingerprint
        ? {
            kind: "applied",
            organizationRevision: concurrentReplay.organization_revision,
            replayed: true,
          }
        : { kind: "command_conflict" }
    }
    return written
  }

  private async persistPrepared(
    change: CompanyResourceChangeEntity,
    journal: PreparedCompanyResourceJournal,
    isOrganizationChange: boolean,
  ): Promise<CompanyResourceWriteResult> {
    const organizationId = change.resources[0]?.organizationId
    if (organizationId === undefined)
      return { kind: "unavailable", cause: new Error("Empty change") }
    const commandFingerprint = journal.fingerprint
    const actualRevision = await this.readOrganizationRevision(organizationId)
    if (actualRevision !== change.expectedRevision) {
      return { kind: "conflict", actualRevision }
    }
    const resourceConflict = await this.findResourceConflict(change)
    if (resourceConflict !== null) return resourceConflict

    if (isOrganizationChange) {
      const invalid = await this.validateOrganization(change)
      if (invalid !== null) return invalid
    }

    const projection = await new CompanyWorkforceResourceProjectionAdapter(this.c.database)
      .prepare(change, commandFingerprint)
      .catch((cause: unknown) =>
        cause instanceof Error
          ? cause
          : new Error("failed to prepare Company workforce projection", { cause }),
      )
    if (projection instanceof Error) {
      const concurrentRevision = await this.readOrganizationRevision(organizationId)
      if (concurrentRevision !== change.expectedRevision)
        return { kind: "conflict", actualRevision: concurrentRevision }
    }
    if (projection instanceof CompanyResourceValidationError)
      return { kind: "invalid", error: projection }
    if (projection instanceof Error) return { kind: "unavailable", cause: projection }

    const organizationProjection = await new CompanyOrganizationResourceProjectionAdapter(
      this.c.database,
    )
      .prepare(change, commandFingerprint)
      .catch((cause: unknown) =>
        cause instanceof Error
          ? cause
          : new Error("failed to prepare Company organization projection", { cause }),
      )
    if (organizationProjection instanceof Error) {
      const concurrentRevision = await this.readOrganizationRevision(organizationId)
      if (concurrentRevision !== change.expectedRevision)
        return { kind: "conflict", actualRevision: concurrentRevision }
    }
    if (organizationProjection instanceof CompanyResourceValidationError)
      return { kind: "invalid", error: organizationProjection }
    if (organizationProjection instanceof Error)
      return { kind: "unavailable", cause: organizationProjection }
    const organizationRevision = change.expectedRevision + 1
    const statements = [
      ...journal.statements,
      ...organizationProjection.beforeWorkforce,
      ...projection,
      ...organizationProjection.statements,
      ...(this.c.atomicStatements ?? []),
      journal.commit,
    ]

    try {
      await this.c.database.batch(statements)
      return { kind: "applied", organizationRevision, replayed: false }
    } catch (cause) {
      const concurrentRevision = await this.readOrganizationRevision(organizationId)
      if (concurrentRevision !== change.expectedRevision) {
        return { kind: "conflict", actualRevision: concurrentRevision }
      }
      const concurrentResourceConflict = await this.findResourceConflict(change)
      if (concurrentResourceConflict !== null) return concurrentResourceConflict
      if (cause instanceof Error && cause.message.includes("organization revision conflict"))
        return { kind: "conflict", actualRevision: concurrentRevision }
      if (this.isWorkforceConstraintFailure(cause)) {
        return { kind: "invalid", error: new CompanyResourceValidationError("invalid_resource") }
      }
      return { kind: "unavailable", cause }
    }
  }

  private async validateOrganization(
    change: CompanyResourceChangeEntity,
  ): Promise<CompanyResourceWriteResult | null> {
    const organizationId = change.resources[0]?.organizationId
    if (organizationId === undefined)
      return { kind: "unavailable", cause: new Error("empty organization change") }
    const types: ReadonlyArray<CompanyResourceType> = [
      "legal-entity",
      "site",
      "workplace",
      "employee",
      "employment",
      "organization-unit",
      "assignment",
      "reporting-relation",
      "position",
      "grade",
      "grade-assignment",
      "organizational-office",
      "office-assignment",
      "responsibility",
      "authority-scope",
      "responsibility-assignment",
      "collective-body",
      "collective-body-membership",
      "organizational-authority",
    ]
    const snapshot = await this.findMany({ organizationId, types })
    if (!snapshot.ok) return { kind: "unavailable", cause: snapshot.cause }
    if (snapshot.organizationRevision !== change.expectedRevision)
      return { kind: "conflict", actualRevision: snapshot.organizationRevision }
    const reportingHistory = await this.findReportingRelationHistory(
      organizationId,
      snapshot.organizationRevision,
    )
    if (reportingHistory instanceof Error) return { kind: "unavailable", cause: reportingHistory }
    const error = validateCompanyOrganizationChange(snapshot.resources, change, reportingHistory)
    if (error !== null) return { kind: "invalid", error }
    return null
  }

  async findReportingRelationHistory(
    organizationId: string,
    revision: number,
  ): Promise<ReadonlyArray<CompanyResourceEntity> | Error> {
    return this.findResourceHistory(organizationId, ["reporting-relation"], revision)
  }

  async findEmploymentDependentHistory(
    organizationId: string,
    revision: number,
  ): Promise<ReadonlyArray<CompanyResourceEntity> | Error> {
    return this.findResourceHistory(
      organizationId,
      [
        "office-assignment",
        "grade-assignment",
        "organizational-authority",
        "responsibility-assignment",
        "collective-body-membership",
      ],
      revision,
    )
  }

  private async findResourceHistory(
    organizationId: string,
    types: ReadonlyArray<CompanyResourceType>,
    revision: number,
  ): Promise<ReadonlyArray<CompanyResourceEntity> | Error> {
    const history = await this.c.database
      .prepare(`SELECT organization_id, resource_type, resource_id, revision, state,
                      effective_from, effective_to, attributes_json
                 FROM company_resource_revisions
                WHERE organization_id = ? AND resource_type IN (${placeholders(types)})
                  AND organization_revision <= ?
                ORDER BY resource_type, resource_id, revision`)
      .bind(organizationId, ...types, revision)
      .all<CompanyResourceRow>()
    if (!history.success) return new Error("Company resource history is unavailable")
    const resources: CompanyResourceEntity[] = []
    for (const row of history.results) {
      const resource = toCompanyResource(row)
      if (resource instanceof Error) return resource
      resources.push(resource)
    }
    return resources
  }

  private isWorkforceConstraintFailure(cause: unknown): boolean {
    const visited = new Set<Error>()
    while (cause instanceof Error && !visited.has(cause)) {
      visited.add(cause)
      if (
        cause.message.includes("company_employment_employer_reference_invalid") ||
        cause.message.includes("company_grade_assignment_invalid") ||
        cause.message.includes("company_grade_assignment_owner_changed") ||
        // D1は制約名の後ろに": SQLITE_CONSTRAINT ..."を付けるため、末尾一致にしない。
        /UNIQUE constraint failed: company_resource_heads\.organization_id(?::|$)/.test(
          cause.message,
        ) ||
        /\borganization (?:unit|root|change|resource|assignment|responsibility)\b/.test(
          cause.message,
        ) ||
        /\bemployment change would (?:orphan an organization (?:assignment|responsibility)|leave an assigned employee without manager)\b/.test(
          cause.message,
        ) ||
        /\bcompany personnel reporting (?:owner|assignment)\b/.test(cause.message) ||
        /\bcompany reporting employment\b/.test(cause.message) ||
        /\bcompany account link\b/.test(cause.message) ||
        /\bcompany_governance_organization_reference_invalid\b/.test(cause.message) ||
        /\bcompany_governance_reference_period_not_covered\b/.test(cause.message) ||
        /\bcompany_place_reference_period_not_covered\b/.test(cause.message) ||
        /\bcompany_reporting_reference_period_not_covered\b/.test(cause.message) ||
        /\bcompany_(?:site_legal_entity|workplace_site)_not_found\b/.test(cause.message) ||
        /\bcompany_(?:position_job|organizational_office_reference|office_assignment_reference|authority_scope_reference|responsibility_assignment_reference|collective_body_membership_reference|organizational_authority_scope)_not_found\b/.test(
          cause.message,
        ) ||
        /\bcompany_employment_authority_period_not_covered\b/.test(cause.message) ||
        /\bcompany_workforce_(?:reference_not_found|owner_immutable|resource_is_in_use|period_conflict|reference_period_conflict)\b/.test(
          cause.message,
        ) ||
        /UNIQUE constraint failed: company_employees\.(?:id|employee_code)\b|UNIQUE constraint failed: company_employments\.(?:id|employee_id)\b/.test(
          cause.message,
        )
      )
        return true
      cause = cause.cause
    }
    return false
  }

  private readCommandReceipt(
    organizationId: string,
    commandId: string,
  ): Promise<CompanyCommandReceiptRow | null> {
    return this.c.database
      .prepare(
        "SELECT fingerprint, organization_revision FROM company_command_receipts WHERE organization_id = ? AND command_id = ?",
      )
      .bind(organizationId, commandId)
      .first<CompanyCommandReceiptRow>()
  }

  private async readOrganizationRevision(organizationId: string): Promise<number> {
    return (
      (
        await this.c.database
          .prepare("SELECT revision FROM company_organizations WHERE id = ?")
          .bind(organizationId)
          .first<{ revision: number }>()
      )?.revision ?? 0
    )
  }

  private async findResourceConflict(
    change: CompanyResourceChangeEntity,
  ): Promise<Extract<CompanyResourceWriteResult, { kind: "resource_conflict" }> | null> {
    const observed = new Map<string, number>()
    for (const resource of change.resources) {
      const key = `${resource.organizationId}\u0000${resource.type}\u0000${resource.id}`
      let actualRevision = observed.get(key)
      if (actualRevision === undefined) {
        actualRevision =
          (
            await this.c.database
              .prepare(
                `SELECT revision FROM company_resource_heads
               WHERE organization_id = ? AND resource_type = ? AND resource_id = ?`,
              )
              .bind(resource.organizationId, resource.type, resource.id)
              .first<{ revision: number }>()
          )?.revision ?? 0
      }
      if (resource.revision !== actualRevision + 1) {
        return { kind: "resource_conflict", type: resource.type, id: resource.id, actualRevision }
      }
      observed.set(key, resource.revision)
    }
    return null
  }
}
