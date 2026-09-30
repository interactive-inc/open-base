import { isEmploymentEmployerReferenceInvalid } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/lib/is-employment-employer-reference-invalid"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { validatePersonnelPositionReference } from "@/contexts/company/domain/policies/validate-personnel-position-reference.policy"
import { toWorkforceResponsibilityType } from "@/contexts/company/domain/definitions/to-workforce-responsibility-type.definition"
import type { PersonnelActionPersistenceProps } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/lib/personnel-action-persistence-props"
import { createCompanySystemAuditEvent } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/lib/create-company-system-audit-event"
import { containsDate } from "@/contexts/company/domain/definitions/contains-date.definition"
import type {
  LifecycleSchedule,
  LifecycleVersionMutation,
} from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import type { PersonnelActionProjection } from "@/contexts/company/domain/policies/project-personnel-action.policy"
import { stableLifecycleJson } from "@/contexts/company/domain/definitions/stable-lifecycle-json.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import type { PersonnelActionRecord } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action.adapter"
import { AbortWhenPreviousStatementChangedNoRowsAdapter } from "@/contexts/company/infrastructure/adapters/database/abort-when-previous-statement-changed-no-rows.adapter"
import { isAbortedByGuard } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/lib/is-aborted-by-guard"
import {
  CompanyValidationError,
  CompanyConflictError,
  CompanyOperationError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import type { ProposalDigest } from "@system/domain/schemas/workflow/system-case-reference.schema"
import { SystemD1AuthorizedExecutionAdapter } from "@system/infrastructure/adapters/workflow/system-d1-authorized-execution.adapter"
import { CompanyPersonnelResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/company-personnel-resource-journal.adapter"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type CurrentLifecycleProjection = {
  status: "active" | "leave" | "retired"
  departmentCode: string | null
  assignmentType: "primary" | null
  positionTitle: string | null
  managerEmployeeId: EmployeeId | null
  managerEmployeeCode: string | null
}

function currentProjection(
  schedule: LifecycleSchedule,
  date: string,
  employeeCodes: ReadonlyMap<EmployeeId, string>,
): CurrentLifecycleProjection {
  const employment = schedule.employments.find((period) => containsDate(period, date))

  if (employment === undefined) {
    return {
      status: "retired",
      departmentCode: null,
      assignmentType: null,
      positionTitle: null,
      managerEmployeeId: null,
      managerEmployeeCode: null,
    }
  }

  const status = schedule.statuses.find(
    (period) => period.employmentPeriodId === employment.employmentId && containsDate(period, date),
  )
  const primary = schedule.assignments.find(
    (period) =>
      period.employmentPeriodId === employment.employmentId &&
      period.assignmentType === "primary" &&
      containsDate(period, date),
  )

  return {
    status: status?.status ?? "active",
    departmentCode: primary?.departmentCode ?? null,
    assignmentType: primary === undefined ? null : "primary",
    positionTitle: primary?.positionTitle ?? null,
    managerEmployeeId: primary?.managerEmployeeId ?? null,
    managerEmployeeCode:
      primary?.managerEmployeeId === null || primary?.managerEmployeeId === undefined
        ? null
        : (employeeCodes.get(primary.managerEmployeeId) ?? null),
  }
}

function mutationStatements(
  db: D1Database,
  mutation: LifecycleVersionMutation,
  context: {
    businessDate: string
    newEmploymentType: PersonnelActionProjection["newEmploymentType"]
    publicAssignmentPeriodIds: ReadonlySet<string>
    projectedEmploymentIds: ReadonlySet<string>
    /** 訂正で元の発令を戻している段階か。 */
    restoring: boolean
  },
): ReadonlyArray<D1PreparedStatement> {
  switch (mutation.periodType) {
    case "employment": {
      const period = mutation.after
      // 公開した雇用は投影が期間と雇用の表を書く。公開履歴へ未接続の雇用だけをここで書く。
      if (context.projectedEmploymentIds.has(period.employmentId)) {
        // 訂正は元の発令を戻してから置き換える。戻す段階で子の期間を開き直せるよう、雇用の表だけを
        // 一時的に戻す。期間の版と最終の値は、batch の最後に投影が書く。
        if (!context.restoring || mutation.before === null) return []
        return [
          db
            .prepare(
              `UPDATE company_employments
               SET termination_date = CASE WHEN ?2 IS NULL THEN NULL ELSE date(?2, '-1 day') END,
                   status = CASE WHEN ?2 IS NULL AND ?3 = 0 THEN status ELSE 'TERMINATED' END,
                   updated_at = max(updated_at, ?4)
               WHERE id = ?1`,
            )
            .bind(
              period.employmentId,
              period.endsOn,
              period.isVoid ? 1 : 0,
              period.recordedAt * 1_000,
            ),
        ]
      }
      return [
        db
          .prepare(
            `INSERT INTO company_employment_period_versions
             (period_id, revision, employee_id, starts_on, ends_on, is_void,
              recorded_by_action_id, recorded_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
          )
          .bind(
            period.periodId,
            period.revision,
            period.employeeId,
            period.startsOn,
            period.endsOn,
            period.isVoid ? 1 : 0,
            period.recordedByActionId,
            period.recordedAt,
          ),
        ...(mutation.before === null
          ? [
              db
                .prepare(
                  `INSERT INTO company_employments
               (id, employee_id, contract_name, employment_type, hire_date, status,
                termination_date, created_at, updated_at)
             SELECT ?1, ?2, employee.official_name, ?7, ?3,
                    CASE WHEN ?4 IS NULL AND ?5 = 0 THEN 'ACTIVE' ELSE 'TERMINATED' END,
                    CASE WHEN ?4 IS NULL THEN NULL ELSE date(?4, '-1 day') END,
                    ?6, ?6
             FROM company_employees AS employee
             WHERE employee.id = ?2`,
                )
                .bind(
                  period.employmentId,
                  period.employeeId,
                  period.startsOn,
                  period.endsOn,
                  period.isVoid ? 1 : 0,
                  period.recordedAt * 1_000,
                  context.newEmploymentType,
                ),
            ]
          : []),
        db
          .prepare(
            `UPDATE company_employments
             SET termination_date = CASE WHEN ?2 IS NULL THEN NULL ELSE date(?2, '-1 day') END,
                 status = CASE WHEN ?2 IS NULL AND ?3 = 0 THEN status ELSE 'TERMINATED' END,
                 updated_at = max(updated_at, ?4)
             WHERE id = ?1`,
          )
          .bind(
            period.employmentId,
            period.endsOn,
            period.isVoid ? 1 : 0,
            period.recordedAt * 1_000,
          ),
      ]
    }
    case "status": {
      const period = mutation.after
      if (context.projectedEmploymentIds.has(period.employmentPeriodId)) return []
      return [
        db
          .prepare(
            `INSERT INTO company_employee_status_period_versions
             (period_id, revision, employment_period_id, employee_id, status,
              starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
          )
          .bind(
            period.periodId,
            period.revision,
            period.employmentPeriodId,
            period.employeeId,
            period.status,
            period.startsOn,
            period.endsOn,
            period.isVoid ? 1 : 0,
            period.recordedByActionId,
            period.recordedAt,
          ),
        db
          .prepare(
            `UPDATE company_employments
             SET status = ?2, updated_at = max(updated_at, ?3)
             WHERE id = ?1
               AND ?4 = 0
               AND ?5 <= ?6
               AND (?7 IS NULL OR ?6 < ?7)`,
          )
          .bind(
            period.employmentPeriodId,
            period.status === "active" ? "ACTIVE" : "ON_LEAVE",
            period.recordedAt * 1_000,
            period.isVoid ? 1 : 0,
            period.startsOn,
            context.businessDate,
            period.endsOn,
          ),
      ]
    }
    case "assignment": {
      const period = mutation.after
      return [
        db
          .prepare(
            `INSERT INTO company_organization_assignment_period_versions
             (period_id, revision, employment_id, employee_id, organization_unit_id,
              assignment_type, position_title, manager_employee_id, starts_on, ends_on,
              is_void, recorded_by_action_id, recorded_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
          )
          .bind(
            period.periodId,
            period.revision,
            period.employmentPeriodId,
            period.employeeId,
            period.organizationUnitId,
            period.assignmentType === "primary" ? "PRIMARY" : "CONCURRENT",
            period.positionTitle,
            context.publicAssignmentPeriodIds.has(period.periodId)
              ? null
              : period.managerEmployeeId,
            period.startsOn,
            period.endsOn,
            period.isVoid ? 1 : 0,
            period.recordedByActionId,
            period.recordedAt * 1_000,
          ),
      ]
    }
    case "responsibility": {
      const period = mutation.after
      return [
        db
          .prepare(
            `INSERT INTO company_organization_responsibility_period_versions
             (period_id, revision, employment_id, employee_id, organization_unit_id,
              responsibility_type,
              starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?11, ?6, ?7, ?8, ?9, ?10)`,
          )
          .bind(
            period.periodId,
            period.revision,
            period.employmentId,
            period.employeeId,
            period.organizationUnitId,
            period.startsOn,
            period.endsOn,
            period.isVoid ? 1 : 0,
            period.recordedByActionId,
            period.recordedAt * 1_000,
            toWorkforceResponsibilityType(period.responsibilityType),
          ),
      ]
    }
  }
}

function organizationMutations(
  mutations: ReadonlyArray<LifecycleVersionMutation>,
): ReadonlyArray<LifecycleVersionMutation> {
  return mutations.filter(
    (mutation) => mutation.periodType === "assignment" || mutation.periodType === "responsibility",
  )
}

function orderedMutations(
  mutations: ReadonlyArray<LifecycleVersionMutation>,
): ReadonlyArray<LifecycleVersionMutation> {
  const closingOrder = { responsibility: 0, assignment: 1, status: 2, employment: 3 } as const
  const openingOrder = { employment: 4, status: 5, assignment: 6, responsibility: 7 } as const
  const orderOf = (mutation: LifecycleVersionMutation): number => {
    const previous = mutation.before
    const next = mutation.after
    const closesPeriod =
      next.isVoid ||
      (previous !== null &&
        !previous.isVoid &&
        next.startsOn >= previous.startsOn &&
        next.endsOn !== null &&
        (previous.endsOn === null || next.endsOn <= previous.endsOn))
    return closesPeriod ? closingOrder[mutation.periodType] : openingOrder[mutation.periodType]
  }

  const compare = (left: LifecycleVersionMutation, right: LifecycleVersionMutation): number => {
    const typeOrder = orderOf(left) - orderOf(right)
    if (typeOrder !== 0) return typeOrder

    // 訂正では競合する新旧期間を一つのoperation内で差し替える。
    // DBの各statementでも不変条件を保てるよう、無効化、既存期間更新、新規期間の順にする。
    // 退職時は配属・責務を先に閉じてから雇用を閉じ、採用時は雇用を先に開く。
    const phase = (mutation: LifecycleVersionMutation): number => {
      if (mutation.after.isVoid) return 0
      if (mutation.before !== null) return 1
      return 2
    }
    const phaseOrder = phase(left) - phase(right)
    if (phaseOrder !== 0) return phaseOrder

    return 0
  }
  // 同じ期間の次版を候補に出す前に前版を保存する。訂正による再開と再終了でも順序を逆転させない。
  const groups = new Map<string, LifecycleVersionMutation[]>()
  for (const mutation of mutations) {
    const key = `${mutation.periodType}:${mutation.after.periodId}`
    const versions = groups.get(key) ?? []
    versions.push(mutation)
    groups.set(key, versions)
  }
  for (const versions of groups.values())
    versions.sort((left, right) => left.after.revision - right.after.revision)
  const ordered: LifecycleVersionMutation[] = []
  while (groups.size > 0) {
    const next = [...groups.entries()].toSorted((left, right) => {
      const a = left[1][0]
      const b = right[1][0]
      return a === undefined || b === undefined ? 0 : compare(a, b)
    })[0]
    if (next === undefined) break
    const mutation = next[1].shift()
    if (mutation !== undefined) ordered.push(mutation)
    if (next[1].length === 0) groups.delete(next[0])
  }
  return ordered
}

function toSafeAuditState(
  state: CurrentLifecycleProjection,
  employeeRevision: number,
  organizationRevision: number,
  includeEmbeddedManager: boolean,
) {
  return {
    status: state.status,
    departmentCode: state.departmentCode,
    assignmentType: state.assignmentType,
    positionTitle: state.positionTitle,
    ...(includeEmbeddedManager ? { managerEmployeeCode: state.managerEmployeeCode } : {}),
    employeeRevision,
    organizationRevision,
  }
}

function unexpected(cause: unknown): CompanyOperationError {
  if (cause instanceof CompanyOperationError) {
    return cause
  }

  return new CompanyUnexpectedError("人事発令の確定に失敗しました", { cause })
}

function preparePersistenceStatements(
  c: CompanyContext,
  props: PersonnelActionPersistenceProps,
  journalStatements: ReadonlyArray<D1PreparedStatement>,
  publicAssignmentPeriodIds: ReadonlySet<string>,
  projectedEmploymentIds: ReadonlySet<string>,
  openingEmploymentStatements: ReadonlyArray<D1PreparedStatement>,
  identityStatements: ReadonlyArray<D1PreparedStatement>,
): D1PreparedStatement[] | CompanyOperationError {
  const db = c.env.DB
  const nextEmployeeRevision = props.revisions.employeeRevision + 1
  const canonicalMutations = organizationMutations(props.projection.mutations)
  // 訂正元を戻す途中で置換後の雇用を再び閉じない。各段階で親を開いてから子を開き、子を閉じてから親を閉じる。
  const restored = props.projection.restorationMutationCount
  const persistenceMutations = [
    ...orderedMutations(props.projection.mutations.slice(0, restored)),
    ...orderedMutations(props.projection.mutations.slice(restored)),
  ]
  const nextOrganizationRevision = props.revisions.organizationRevision + canonicalMutations.length
  const before = currentProjection(props.scheduleBefore, props.businessDate, props.employeeCodes)
  const after = currentProjection(
    props.projection.schedule,
    props.businessDate,
    props.employeeCodes,
  )
  const sourceAction =
    props.command.input.kind === "corrected"
      ? props.command.input.replacementAction
      : props.command.input
  const audit = createCompanySystemAuditEvent({
    actorAccountId: props.command.session.accountId,
    actorEmployeeId: props.command.session.employeeId,
    action:
      props.action.kind === "corrected"
        ? "employee.lifecycle.corrected"
        : "employee.lifecycle.applied",
    targetType: "employee",
    targetId: String(props.action.employeeId),
    outcome: "succeeded",
    reasonCode: null,
    authorization:
      props.action.sourceType === "application"
        ? { workflowTask: true, applicationId: props.action.sourceApplicationId }
        : { permission: "employee:lifecycle:apply" },
    before: toSafeAuditState(
      before,
      props.revisions.employeeRevision,
      props.revisions.organizationRevision,
      publicAssignmentPeriodIds.size === 0,
    ),
    after: toSafeAuditState(
      after,
      nextEmployeeRevision,
      nextOrganizationRevision,
      publicAssignmentPeriodIds.size === 0,
    ),
    metadata: {
      ...("positionReference" in sourceAction && sourceAction.positionReference !== undefined
        ? { positionReference: sourceAction.positionReference }
        : {}),
      actionKind: props.action.kind,
      effectiveOn: props.action.eventOn,
      ...(props.command.expectedCompanyRevision === undefined
        ? {}
        : { expectedCompanyRevision: props.command.expectedCompanyRevision }),
    },
    occurredAt: new Date(props.action.recordedAt * 1_000),
    requestAudit: c.var.auditContext,
  })
  if (audit instanceof Error) {
    return new CompanyUnexpectedError("人事発令の監査イベントを作成できません", { cause: audit })
  }
  const statements: Array<D1PreparedStatement> = []

  // 新しい従業員は、公開した人と従業員からの投影として作る。発令の行が参照するので先に置く。
  if (props.prospectiveEmployee !== undefined) {
    if (identityStatements.length === 0)
      return new CompanyUnexpectedError("新しい従業員の公開記録がありません")
    statements.push(...identityStatements)
  }

  if (props.projection.affectsOrganization) {
    statements.push(
      db
        .prepare(
          `INSERT INTO company_organization_change_operations
             (id, expected_revision, change_count, applied_count,
              resulting_revision, status, recorded_at, actor_account_id,
              reason, evidence_references_json)
           VALUES (?1, ?2, ?3, 0, ?2 + ?3, 'PENDING', ?4, ?5, ?6, ?7)`,
        )
        .bind(
          props.action.id,
          props.revisions.organizationRevision,
          canonicalMutations.length,
          props.action.recordedAt * 1_000,
          String(props.command.session.accountId),
          `personnel_action:${props.action.kind}`,
          stableLifecycleJson([
            {
              context: "company",
              kind: "personnel_action",
              id: props.action.id,
              version: String(nextEmployeeRevision),
            },
          ]),
        ),
    )
  }

  statements.push(
    db
      .prepare(
        `INSERT OR IGNORE INTO company_employee_lifecycle_revisions
           (employee_id, revision, updated_at) VALUES (?1, 0, ?2)`,
      )
      .bind(props.action.employeeId, props.action.recordedAt),
    db
      .prepare(
        `UPDATE company_employee_lifecycle_revisions
         SET revision = revision + 1, updated_at = ?1
         WHERE employee_id = ?2 AND revision = ?3`,
      )
      .bind(props.action.recordedAt, props.action.employeeId, props.revisions.employeeRevision),
    new AbortWhenPreviousStatementChangedNoRowsAdapter(
      db,
    ).abortWhenPreviousStatementChangedNoRows(),
  )

  statements.push(
    db
      .prepare(
        `INSERT INTO company_personnel_actions
           (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
            requested_by_employee_id, source_type, source_application_id,
            corrects_action_id, operation_id, payload_fingerprint, summary_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
      )
      .bind(
        props.action.id,
        props.action.employeeId,
        props.action.kind,
        props.action.eventOn,
        props.action.recordedAt,
        props.action.recordedByAccountId,
        props.action.requestedByEmployeeId,
        props.action.sourceType,
        props.action.sourceApplicationId,
        props.action.correctsActionId,
        props.action.operationId,
        props.action.payloadFingerprint,
        stableLifecycleJson(props.action.summary),
      ),
    new AbortWhenPreviousStatementChangedNoRowsAdapter(
      db,
    ).abortWhenPreviousStatementChangedNoRows(),
    // 訂正では元の発令を戻し終えてから新しい雇用を開く。同じ従業員の有効な雇用を並べない。
    ...persistenceMutations.flatMap((mutation, index) => [
      ...(index === restored ? openingEmploymentStatements : []),
      ...mutationStatements(db, mutation, {
        restoring: index < restored,
        businessDate: props.businessDate,
        newEmploymentType: props.projection.newEmploymentType,
        publicAssignmentPeriodIds,
        projectedEmploymentIds,
      }),
    ]),
    ...(persistenceMutations.length <= restored ? openingEmploymentStatements : []),
    ...journalStatements,
  )

  if (props.projection.affectsOrganization) {
    statements.push(
      db
        .prepare(
          `UPDATE company_organization_change_operations
           SET status = 'COMPLETED'
           WHERE id = ?1 AND status = 'PENDING'`,
        )
        .bind(props.action.id),
      new AbortWhenPreviousStatementChangedNoRowsAdapter(
        db,
      ).abortWhenPreviousStatementChangedNoRows(),
    )
  }

  if (props.action.kind === "hire" || props.action.kind === "retired") {
    statements.push(
      db
        .prepare(
          `INSERT INTO company_lifecycle_outbox_entries
             (personnel_action_id, effect_type, payload_json, attempt_count,
              next_attempt_at, processed_at, last_error_code, created_at)
           VALUES (?1, ?2, ?3, 0, ?4, NULL, NULL, ?4)`,
        )
        .bind(
          props.action.id,
          props.action.kind,
          stableLifecycleJson({ actionId: props.action.id, employeeId: props.action.employeeId }),
          props.action.recordedAt,
        ),
    )
  }

  statements.push(...new SystemAuditEventRepository({ env: { DB: c.env.DB } }).prepareAppend(audit))
  return statements
}
type Context = CompanyContext

export class PersonnelActionPersistenceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    props: PersonnelActionPersistenceProps,
  ): Promise<D1PreparedStatement[] | CompanyOperationError> {
    const prepared = await this.prepareResult(props)
    return prepared instanceof CompanyOperationError ? prepared : prepared.statements
  }

  private async prepareResult(
    props: PersonnelActionPersistenceProps,
  ): Promise<
    | Readonly<{ statements: D1PreparedStatement[]; action: PersonnelActionRecord }>
    | CompanyOperationError
  > {
    if (
      props.projection.newEmploymentType === null &&
      props.projection.mutations.some(
        (mutation) => mutation.periodType === "employment" && mutation.before === null,
      )
    )
      return new CompanyUnexpectedError("新しい雇用の区分が指定されていません")
    const referenceError = await this.validatePositionReference(props)
    if (referenceError !== null) return referenceError
    const journal = await new CompanyPersonnelResourceJournalAdapter(this.c.env.DB).prepare(props)
    if (journal instanceof CompanyOperationError) return journal
    const action = { ...props.action, summary: journal.summary }
    const statements = preparePersistenceStatements(
      this.c,
      { ...props, action },
      journal.statements,
      journal.assignmentPeriodIds,
      journal.projectedEmploymentIds,
      journal.openingEmploymentStatements,
      journal.identityStatements,
    )
    if (statements instanceof CompanyOperationError) return statements
    if (props.command.expectedCompanyRevision !== undefined) {
      statements.unshift(
        this.c.env.DB.prepare(
          `SELECT CASE WHEN EXISTS (
          SELECT 1 FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND revision = ?
        ) THEN 1 ELSE json_extract('', '$') END`,
        ).bind(props.command.expectedCompanyRevision),
      )
    }
    return { statements, action }
  }

  private async validatePositionReference(
    props: PersonnelActionPersistenceProps,
  ): Promise<CompanyOperationError | null> {
    const invalid = validatePersonnelPositionReference(props.command)
    if (invalid !== null) return invalid
    const action =
      props.command.input.kind === "corrected"
        ? props.command.input.replacementAction
        : props.command.input
    if (!("positionReference" in action) || action.positionReference === undefined) return null
    const reference = action.positionReference
    const snapshot = await new D1CompanyResourceRepository({ database: this.c.env.DB }).findMany({
      organizationId: reference.organizationId,
      organizationRevision: reference.organizationRevision,
      effectiveOn: restoreCalendarDate(reference.effectiveOn),
      types: ["position"],
      ids: [reference.resourceId],
    })
    if (!snapshot.ok)
      return new CompanyUnexpectedError("役職の参照根拠を検証できません", { cause: snapshot.cause })
    const position = snapshot.resources[0]
    if (
      snapshot.resources.length !== 1 ||
      position?.revision !== reference.resourceRevision ||
      position.readText("code") !== reference.code ||
      position.readText("officialName") !== action.positionTitle
    )
      return new CompanyValidationError("役職の参照根拠が公開履歴と一致しません", "invalid_change")
    return null
  }

  async write(
    props: PersonnelActionPersistenceProps,
  ): Promise<PersonnelActionRecord | CompanyOperationError> {
    const prepared = await this.prepareResult(props)
    if (prepared instanceof CompanyOperationError) return prepared
    const { statements, action } = prepared

    try {
      const results = await this.c.env.DB.batch(statements)

      if (results.length !== statements.length || results.some((result) => !result.success)) {
        throw new Error("employee lifecycle batch did not succeed")
      }

      return action
    } catch (cause) {
      if (isEmploymentEmployerReferenceInvalid(cause))
        return new CompanyValidationError(
          "雇用期間を覆う雇用主法人を確認できません",
          "invalid_employment_employer",
        )
      if (isAbortedByGuard(cause)) {
        return new CompanyConflictError("人事情報が同時に更新されました", "personnel_action_stale")
      }

      return unexpected(cause)
    }
  }

  async executeAuthorized(
    props: Readonly<{
      authorization: ExecutionAuthorizationEntity
      proposalDigest: ProposalDigest
      executedAt: Date
      executionGuards: ReadonlyArray<D1PreparedStatement>
      persistence: PersonnelActionPersistenceProps
      request: Readonly<{ id: string; applicationId: number }>
    }>,
  ): Promise<true | CompanyOperationError | Error> {
    const statements = await this.prepare(props.persistence)
    if (statements instanceof CompanyOperationError) return statements

    const executed = await new SystemD1AuthorizedExecutionAdapter({
      env: { DB: this.c.env.DB },
    }).execute({
      authorization: props.authorization,
      proposalDigest: props.proposalDigest,
      executedAt: props.executedAt,
      operationStatements: [
        ...props.executionGuards,
        ...statements,
        this.c.env.DB.prepare(
          `UPDATE company_personnel_action_requests
             SET applied_action_id = ?2, target_employee_id = ?4
             WHERE id = ?1 AND application_id = ?3
               AND applied_action_id IS NULL AND withdrawn_at IS NULL`,
        ).bind(
          props.request.id,
          props.persistence.action.id,
          props.request.applicationId,
          props.persistence.action.employeeId,
        ),
        new AbortWhenPreviousStatementChangedNoRowsAdapter(
          this.c.env.DB,
        ).abortWhenPreviousStatementChangedNoRows(),
      ],
    })
    if (isEmploymentEmployerReferenceInvalid(executed))
      return new CompanyValidationError(
        "雇用期間を覆う雇用主法人を確認できません",
        "invalid_employment_employer",
      )
    if (executed instanceof Error && isAbortedByGuard(executed)) {
      return new CompanyConflictError(
        "発令内容または承認資格が同時に更新されました",
        "personnel_action_stale",
      )
    }
    return executed
  }
}
