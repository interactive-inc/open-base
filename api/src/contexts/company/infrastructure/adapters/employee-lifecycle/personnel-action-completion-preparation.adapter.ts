import { validatePersonnelPositionReference } from "@/contexts/company/domain/policies/validate-personnel-position-reference.policy"
import type {
  LifecycleSchedule,
  LifecycleVersionMutation,
} from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import {
  projectPersonnelAction,
  type PersonnelActionProjection,
} from "@/contexts/company/domain/policies/project-personnel-action.policy"
import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import { fingerprintPersonnelAction } from "@/contexts/company/domain/definitions/fingerprint-personnel-action.definition"
import type {
  OrganizationChangeSet,
  WorkforceSnapshotReadPort,
} from "@/contexts/company/domain/definitions/organization-change.definition"
import { ValidateOrganizationChange } from "@/contexts/company/lib/workforce/validate-organization-change"
import { toWorkforceLifecycleSchedules } from "@/contexts/company/domain/policies/to-workforce-lifecycle-schedules.policy"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { toWorkforceResponsibilityType } from "@/contexts/company/domain/definitions/to-workforce-responsibility-type.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { EmployeeLifecycleAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/employee-lifecycle.adapter"
import {
  PersonnelActionAdapter,
  type PersonnelActionRecord,
} from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action.adapter"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import { OrganizationWorkforceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-workforce-snapshot.adapter"
import {
  CompanyOperationError,
  CompanyConflictError,
  CompanyUnavailableError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { z } from "zod"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { DirectPersonnelActionCommand } from "@/contexts/company/domain/definitions/direct-personnel-action-command.definition"
import type { PersonnelActionPersistenceProps } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/lib/personnel-action-persistence-props"

export type PreparedPersonnelActionCompletion = {
  action: PersonnelActionRecord
  persistence: PersonnelActionPersistenceProps
}
type Context = CompanyContext

/** 承認済み人事変更を反映するための入力を準備する。 */
export class PersonnelActionCompletionPreparationAdapter {
  private static readonly revisionSchema = z.number().int().nonnegative()

  private static actionEventOn(input: PersonnelActionInput): string {
    return input.kind === "retired" ? input.retirementOn : input.eventOn
  }

  private static canonicalOrganizationChange(props: {
    actionId: string
    expectedRevision: number
    businessDate: string
    recordedAt: number
    actorAccountId: string
    reason: string
    evidenceReferences: OrganizationChangeSet["evidenceReferences"]
    projection: PersonnelActionProjection
  }): OrganizationChangeSet | CompanyOperationError {
    try {
      const operationId = restoreWorkforceId("personnel_action", props.actionId)
      const recordedAt = props.recordedAt * 1_000
      const assignments: OrganizationChangeSet["assignments"][number][] = []
      const responsibilities: OrganizationChangeSet["responsibilities"][number][] = []

      for (const mutation of props.projection.mutations) {
        if (mutation.periodType === "assignment") {
          const period = mutation.after
          assignments.push({
            periodId: restoreWorkforceId("period", period.periodId),
            revision: period.revision,
            employmentId: period.employmentPeriodId,
            employeeId: period.employeeId,
            organizationUnitId: period.organizationUnitId,
            assignmentType: period.assignmentType === "primary" ? "PRIMARY" : "CONCURRENT",
            positionTitle: period.positionTitle,
            managerEmployeeId: period.managerEmployeeId,
            startsOn: restoreCalendarDate(period.startsOn),
            endsOn: period.endsOn === null ? null : restoreCalendarDate(period.endsOn),
            isVoid: period.isVoid,
            recordedByActionId: operationId,
            recordedAt,
          })
          continue
        }
        if (mutation.periodType !== "responsibility") continue

        const period = mutation.after
        responsibilities.push({
          periodId: restoreWorkforceId("period", period.periodId),
          revision: period.revision,
          employmentId: period.employmentId,
          employeeId: period.employeeId,
          organizationUnitId: period.organizationUnitId,
          responsibilityType: toWorkforceResponsibilityType(period.responsibilityType),
          startsOn: restoreCalendarDate(period.startsOn),
          endsOn: period.endsOn === null ? null : restoreCalendarDate(period.endsOn),
          isVoid: period.isVoid,
          recordedByActionId: operationId,
          recordedAt,
        })
      }

      return {
        operationId,
        expectedRevision: props.expectedRevision,
        asOf: restoreCalendarDate(props.businessDate),
        recordedAt,
        actorAccountId: props.actorAccountId,
        reason: props.reason,
        evidenceReferences: props.evidenceReferences,
        organizationUnits: [],
        unitPeriods: [],
        assignments,
        responsibilities,
      }
    } catch (cause) {
      return new CompanyValidationError(
        "組織変更を共通形式へ変換できません",
        "personnel_action_invalid_transition",
        { cause },
      )
    }
  }

  private async validateCanonicalOrganizationChange(
    props: Parameters<
      typeof PersonnelActionCompletionPreparationAdapter.canonicalOrganizationChange
    >[0] &
      Readonly<{
        employeeId: EmployeeId
        prospectiveEmployee?: Readonly<{ id: EmployeeId; code: string; name: string }>
      }>,
  ): Promise<CompanyOperationError | null> {
    const change = PersonnelActionCompletionPreparationAdapter.canonicalOrganizationChange(props)
    if (change instanceof CompanyOperationError) return change

    const currentWorkforce = new OrganizationWorkforceSnapshotAdapter(this.c)
    const prospectiveEmployee = props.prospectiveEmployee
    const workforce: WorkforceSnapshotReadPort = {
      async readAllSnapshot(asOf) {
        const current = await currentWorkforce.readAllSnapshot(asOf)
        if (!current.ok) return current

        const employeeId = props.employeeId
        const lifecycle = toWorkforceLifecycleSchedules([props.projection.schedule]).find(
          (schedule) => schedule.employeeId === employeeId,
        )
        if (lifecycle === undefined) {
          return {
            ok: false as const,
            cause: new Error("prospective employee lifecycle was not projected"),
          }
        }

        if (prospectiveEmployee === undefined) {
          if (!current.schedules.some((schedule) => schedule.employee.id === employeeId))
            return { ok: false, cause: new Error("employee workforce snapshot is missing") }
          return {
            ok: true,
            schedules: current.schedules.map((schedule) =>
              schedule.employee.id === employeeId
                ? { ...schedule, employments: lifecycle.employments, statuses: lifecycle.statuses }
                : schedule,
            ),
          }
        }

        // 採用確定前のEmployeeはDB snapshotにまだ存在しない。
        // 同一transactionで追加するprofile・雇用・状態だけを検証前snapshotへ補い、
        // 所属と責務はOrganizationChangeSetを一度だけ適用して検証する。
        return {
          ok: true as const,
          schedules: [
            ...current.schedules,
            {
              employee: {
                id: employeeId,
                officialName: prospectiveEmployee.name,
                employeeCode: prospectiveEmployee.code,
                email: null,
                phone: null,
              },
              employments: lifecycle.employments,
              statuses: lifecycle.statuses,
              assignments: [],
              responsibilities: [],
              accountLink: null,
            },
          ],
        }
      },
    }

    const result = await new ValidateOrganizationChange({
      organization: OrganizationUnitReadAdapter.fromContext(this.c),
      workforce,
    }).execute(change)
    if (result.kind === "valid") return null
    if (result.kind === "conflict") {
      return new CompanyConflictError("組織情報が更新されています", "personnel_action_stale")
    }
    if (result.kind === "operation_conflict") {
      return new CompanyConflictError("組織変更IDが再利用されています", "personnel_action_stale")
    }
    if (result.kind === "invalid") {
      return new CompanyValidationError(
        "人事発令後の組織状態が不正です",
        "personnel_action_invalid_transition",
        { cause: result.error },
      )
    }
    return new CompanyUnavailableError(
      "組織変更を安全に検証できません",
      "organization_change_unavailable",
      {
        cause: result.cause,
      },
    )
  }

  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(command: {
    session: CompanyPersonnelSession
    employeeId: EmployeeId | null
    input: PersonnelActionInput
    sourceApplicationId: number | null
    idempotencyKey?: string
    requestedByEmployeeId: EmployeeId
    expectedCompanyRevision?: number
    expectedEmployeeRevision: number
    expectedOrganizationRevision: number | null
    expectedPayloadFingerprint: string
  }): Promise<PreparedPersonnelActionCompletion | CompanyOperationError> {
    const employeeRevisionResult =
      PersonnelActionCompletionPreparationAdapter.revisionSchema.safeParse(
        command.expectedEmployeeRevision,
      )
    const organizationRevisionResult = z
      .union([PersonnelActionCompletionPreparationAdapter.revisionSchema, z.null()])
      .safeParse(command.expectedOrganizationRevision)
    const companyRevisionResult = PersonnelActionCompletionPreparationAdapter.revisionSchema
      .optional()
      .safeParse(command.expectedCompanyRevision)
    if (
      !companyRevisionResult.success ||
      !employeeRevisionResult.success ||
      !organizationRevisionResult.success
    ) {
      return new CompanyValidationError(
        "人事発令の競合制御入力が不正です",
        "personnel_action_stale",
      )
    }
    if (command.employeeId === null && command.input.kind !== "hire") {
      return new CompanyValidationError(
        "対象従業員が一致しません",
        "personnel_action_invalid_transition",
      )
    }
    const prospectiveKey =
      command.input.kind === "hire" ? (`prospective:${command.input.employeeCode}` as const) : null
    const fingerprintSubject = command.employeeId ?? prospectiveKey
    if (fingerprintSubject === null) {
      return new CompanyValidationError(
        "対象従業員が一致しません",
        "personnel_action_invalid_transition",
      )
    }
    const referenceError = validatePersonnelPositionReference(command)
    if (referenceError !== null) return referenceError
    const fingerprint = await fingerprintPersonnelAction(
      fingerprintSubject,
      command.input,
      command.expectedCompanyRevision,
    )
    if (fingerprint !== command.expectedPayloadFingerprint) {
      return new CompanyConflictError("申請内容の整合性を確認できません", "idempotency_conflict")
    }
    const operationId =
      command.sourceApplicationId === null
        ? command.idempotencyKey
        : `application:${command.sourceApplicationId}`
    if (operationId === undefined) {
      return new CompanyValidationError("冪等キーが必要です", "idempotency_conflict")
    }
    const actionRepository = new PersonnelActionAdapter(this.c)
    const existing = await actionRepository.findByOperationId(operationId)
    if (existing instanceof CompanyOperationError) return existing
    if (existing !== null) {
      return new CompanyConflictError("申請はすでに人事発令へ反映されています", "already_decided")
    }

    const lifecycleRepository = new EmployeeLifecycleAdapter(this.c)
    const now = this.c.env.NOW ?? new Date().toISOString()
    const businessDate = resolveCompanyBusinessDate({
      now,
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (typeof businessDate !== "string") {
      return new CompanyUnavailableError(
        "会社営業日を解決できません",
        "company_timezone_unavailable",
        {
          cause: businessDate,
        },
      )
    }
    const allocatedEmployeeId =
      command.employeeId ?? restoreWorkforceId("employee", crypto.randomUUID())
    const [schedule, organizationSchedules, references, revisions] = await Promise.all([
      lifecycleRepository.loadSchedule(allocatedEmployeeId),
      lifecycleRepository.loadOrganizationSchedules(),
      lifecycleRepository.loadReferences(businessDate),
      lifecycleRepository.loadRevisions(allocatedEmployeeId),
    ])
    for (const result of [schedule, organizationSchedules, references, revisions]) {
      if (result instanceof CompanyOperationError) return result
    }
    const loadedSchedule = schedule as LifecycleSchedule
    const loadedOrganizationSchedules = organizationSchedules as ReadonlyArray<LifecycleSchedule>
    const loadedReferences = references as Exclude<typeof references, CompanyOperationError>
    const effectiveReferences =
      command.employeeId === null && command.input.kind === "hire"
        ? {
            ...loadedReferences,
            employees: [
              ...loadedReferences.employees,
              { id: allocatedEmployeeId, code: command.input.employeeCode },
            ],
          }
        : loadedReferences
    const loadedRevisions = revisions as Exclude<typeof revisions, CompanyOperationError>
    if (loadedRevisions.employeeRevision !== command.expectedEmployeeRevision) {
      return new CompanyConflictError(
        "従業員の人事情報が更新されています",
        "personnel_action_stale",
      )
    }
    const target = effectiveReferences.employees.find(
      (employee) => employee.id === allocatedEmployeeId,
    )
    const commandEmployeeCode =
      command.input.kind === "corrected"
        ? command.input.replacementAction.employeeCode
        : command.input.employeeCode
    if (target === undefined || target.code !== commandEmployeeCode) {
      return new CompanyValidationError(
        "対象従業員が一致しません",
        "personnel_action_invalid_transition",
      )
    }
    let correction:
      | { mutations: ReadonlyArray<LifecycleVersionMutation>; alreadyCorrected: boolean }
      | undefined
    if (command.input.kind === "corrected") {
      const [mutations, alreadyCorrected, original] = await Promise.all([
        actionRepository.loadMutationsForAction(command.input.correctsActionId),
        actionRepository.hasCorrection(command.input.correctsActionId),
        actionRepository.findById(command.input.correctsActionId),
      ])
      if (
        mutations instanceof CompanyOperationError ||
        alreadyCorrected instanceof CompanyOperationError ||
        original instanceof CompanyOperationError
      ) {
        return [mutations, alreadyCorrected, original].find(
          (result): result is CompanyOperationError => result instanceof CompanyOperationError,
        ) as CompanyOperationError
      }
      if (original === null || original.employeeId !== allocatedEmployeeId) {
        return new CompanyValidationError(
          "訂正対象の人事発令が見つかりません",
          "personnel_action_invalid_transition",
        )
      }
      correction = { mutations, alreadyCorrected }
    }
    const actionId = crypto.randomUUID()
    const recordedAt = Math.floor(Date.parse(now) / 1_000)
    const projected = projectPersonnelAction({
      schedule: loadedSchedule,
      organizationSchedules: loadedOrganizationSchedules,
      departments: effectiveReferences.departments,
      employees: effectiveReferences.employees,
      command: {
        actionId,
        employeeId: allocatedEmployeeId,
        recordedAt,
        input: command.input,
        correction,
      },
    })
    if (projected instanceof CompanyOperationError) return projected
    if (
      projected.affectsOrganization &&
      command.expectedOrganizationRevision !== loadedRevisions.organizationRevision
    ) {
      return new CompanyConflictError("組織情報が更新されています", "personnel_action_stale")
    }
    if (projected.affectsOrganization) {
      const validation = await this.validateCanonicalOrganizationChange({
        actionId,
        employeeId: allocatedEmployeeId,
        expectedRevision: loadedRevisions.organizationRevision,
        businessDate,
        recordedAt,
        actorAccountId: String(command.session.accountId),
        reason: `personnel_action:${command.input.kind}`,
        evidenceReferences: [
          {
            context: "company",
            kind: "personnel_action",
            id: actionId,
            version: String(loadedRevisions.employeeRevision + 1),
          },
        ],
        projection: projected,
        prospectiveEmployee:
          command.employeeId === null && command.input.kind === "hire"
            ? {
                id: allocatedEmployeeId,
                code: command.input.employeeCode,
                name: command.input.employeeName,
              }
            : undefined,
      })
      if (validation !== null) return validation
    }
    const action: PersonnelActionRecord = {
      id: actionId,
      employeeId: allocatedEmployeeId,
      kind: command.input.kind,
      eventOn: PersonnelActionCompletionPreparationAdapter.actionEventOn(command.input),
      recordedAt,
      recordedByAccountId: command.session.accountId,
      requestedByEmployeeId: command.requestedByEmployeeId,
      sourceType: command.sourceApplicationId === null ? "direct" : "application",
      sourceApplicationId: command.sourceApplicationId,
      correctsActionId: command.input.kind === "corrected" ? command.input.correctsActionId : null,
      operationId,
      payloadFingerprint: fingerprint,
      summary: projected.summary,
    }
    const persistenceCommand: DirectPersonnelActionCommand = {
      session: command.session,
      employeeId: allocatedEmployeeId,
      input: command.input,
      idempotencyKey: operationId,
      expectedEmployeeRevision: command.expectedEmployeeRevision,
      expectedCompanyRevision: command.expectedCompanyRevision,
      expectedOrganizationRevision: command.expectedOrganizationRevision,
    }
    const persistence: PersonnelActionPersistenceProps = {
      command: persistenceCommand,
      action,
      projection: projected,
      scheduleBefore: loadedSchedule,
      businessDate,
      employeeCodes: new Map(
        effectiveReferences.employees.map((employee) => [employee.id, employee.code]),
      ),
      revisions: loadedRevisions,
      prospectiveEmployee:
        command.employeeId === null && command.input.kind === "hire"
          ? { code: command.input.employeeCode, name: command.input.employeeName }
          : undefined,
    }

    return { action, persistence }
  }
}
