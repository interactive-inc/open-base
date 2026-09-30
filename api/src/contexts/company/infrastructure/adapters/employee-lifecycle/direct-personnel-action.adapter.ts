import { validatePersonnelPositionReference } from "@/contexts/company/domain/policies/validate-personnel-position-reference.policy"
import type {
  LifecycleSchedule,
  LifecycleVersionMutation,
} from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
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
  CompanyForbiddenError,
  CompanyUnavailableError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { z } from "zod"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { DirectPersonnelActionCommand } from "@/contexts/company/domain/definitions/direct-personnel-action-command.definition"
import { PersonnelActionPersistenceAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action-persistence.adapter"
import type { PersonnelActionPersistenceProps } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/lib/personnel-action-persistence-props"

type Context = CompanyContext

/** 人事発令を適用する。 */
export class DirectPersonnelActionAdapter {
  private static readonly idempotencyKeySchema = z.string().min(1).max(200)
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
    props: Parameters<typeof DirectPersonnelActionAdapter.canonicalOrganizationChange>[0] &
      Readonly<{
        employeeId: EmployeeId
        prospectiveEmployee?: Readonly<{ id: EmployeeId; code: string; name: string }>
      }>,
  ): Promise<CompanyOperationError | null> {
    const change = DirectPersonnelActionAdapter.canonicalOrganizationChange(props)
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

  async apply(
    command: DirectPersonnelActionCommand,
  ): Promise<{ action: PersonnelActionRecord; replayed: boolean } | CompanyOperationError> {
    const result = await this.applyObserved(command)
    if (
      !(result instanceof CompanyValidationError || result instanceof CompanyConflictError) ||
      DirectPersonnelActionAdapter.finalRejectionCodes.has(result.code)
    )
      return result
    // 呼出し側が確認した後に同じ従業員の人事情報が確定すると、発令の読取や投影は確認していない状態に
    // 対する検証になり、不正な遷移や投影の不一致として失敗する。確認した版が古い発令として返し、
    // 呼出し側に再確認させる。版が変わっていなければ、検証の結果をそのまま返す。
    const current = await new EmployeeLifecycleAdapter(this.c).loadRevisions(command.employeeId)
    if (current instanceof CompanyOperationError) return result
    return current.employeeRevision === command.expectedEmployeeRevision
      ? result
      : new CompanyConflictError("従業員の人事情報が更新されています", "personnel_action_stale", {
          cause: result,
        })
  }

  /** 古い版の判定を必要としない失敗。入力、権限、冪等キーの誤りは版の再確認で結果が変わらない。 */
  private static readonly finalRejectionCodes: ReadonlySet<string> = new Set([
    "personnel_action_stale",
    "idempotency_conflict",
  ])

  private async applyObserved(
    command: DirectPersonnelActionCommand,
  ): Promise<{ action: PersonnelActionRecord; replayed: boolean } | CompanyOperationError> {
    if (!command.session.hasPermission("employee:lifecycle:apply")) {
      return new CompanyForbiddenError("人事発令を確定する権限がありません", "forbidden")
    }

    const operationResult = DirectPersonnelActionAdapter.idempotencyKeySchema.safeParse(
      command.idempotencyKey,
    )
    const employeeRevisionResult = DirectPersonnelActionAdapter.revisionSchema.safeParse(
      command.expectedEmployeeRevision,
    )
    const organizationRevisionResult = z
      .union([DirectPersonnelActionAdapter.revisionSchema, z.null()])
      .safeParse(command.expectedOrganizationRevision)

    const companyRevisionResult = DirectPersonnelActionAdapter.revisionSchema
      .optional()
      .safeParse(command.expectedCompanyRevision)

    if (
      !companyRevisionResult.success ||
      !operationResult.success ||
      !employeeRevisionResult.success ||
      !organizationRevisionResult.success
    ) {
      return new CompanyValidationError(
        "人事発令の競合制御入力が不正です",
        "personnel_action_stale",
      )
    }

    const referenceError = validatePersonnelPositionReference(command)
    if (referenceError !== null) return referenceError
    const fingerprint = await fingerprintPersonnelAction(
      command.employeeId,
      command.input,
      command.expectedCompanyRevision,
    )
    const actionRepository = new PersonnelActionAdapter(this.c)
    const existing = await actionRepository.findByOperationId(command.idempotencyKey)

    if (existing instanceof CompanyOperationError) {
      return existing
    }

    if (existing !== null) {
      return this.classifyReplay(existing, command, fingerprint)
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

    const [schedule, organizationSchedules, references, revisions] = await Promise.all([
      lifecycleRepository.loadSchedule(command.employeeId),
      lifecycleRepository.loadOrganizationSchedules(),
      lifecycleRepository.loadReferences(businessDate),
      lifecycleRepository.loadRevisions(command.employeeId),
    ])

    for (const result of [schedule, organizationSchedules, references, revisions]) {
      if (result instanceof CompanyOperationError) {
        return result
      }
    }

    const loadedSchedule = schedule as LifecycleSchedule
    const loadedOrganizationSchedules = organizationSchedules as ReadonlyArray<LifecycleSchedule>
    const loadedReferences = references as Exclude<typeof references, CompanyOperationError>
    const loadedRevisions = revisions as Exclude<typeof revisions, CompanyOperationError>

    if (loadedRevisions.employeeRevision !== command.expectedEmployeeRevision) {
      return new CompanyConflictError(
        "従業員の人事情報が更新されています",
        "personnel_action_stale",
      )
    }

    const target = loadedReferences.employees.find((employee) => employee.id === command.employeeId)
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
      | {
          mutations: ReadonlyArray<LifecycleVersionMutation>
          alreadyCorrected: boolean
        }
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

      if (original === null || original.employeeId !== command.employeeId) {
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
      departments: loadedReferences.departments,
      employees: loadedReferences.employees,
      command: {
        actionId,
        employeeId: command.employeeId,
        recordedAt,
        input: command.input,
        correction,
      },
    })

    if (projected instanceof CompanyOperationError) {
      return projected
    }

    if (
      projected.affectsOrganization &&
      command.expectedOrganizationRevision !== loadedRevisions.organizationRevision
    ) {
      return new CompanyConflictError("組織情報が更新されています", "personnel_action_stale")
    }
    if (projected.affectsOrganization) {
      const validation = await this.validateCanonicalOrganizationChange({
        actionId,
        employeeId: command.employeeId,
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
      })
      if (validation !== null) return validation
    }

    const action: PersonnelActionRecord = {
      id: actionId,
      employeeId: command.employeeId,
      kind: command.input.kind,
      eventOn: DirectPersonnelActionAdapter.actionEventOn(command.input),
      recordedAt,
      recordedByAccountId: command.session.accountId,
      requestedByEmployeeId: command.session.employeeId,
      sourceType: "direct",
      sourceApplicationId: null,
      correctsActionId: command.input.kind === "corrected" ? command.input.correctsActionId : null,
      operationId: command.idempotencyKey,
      payloadFingerprint: fingerprint,
      summary: projected.summary,
    }

    return this.persist({
      command,
      action,
      projection: projected,
      scheduleBefore: loadedSchedule,
      businessDate,
      employeeCodes: new Map(
        loadedReferences.employees.map((employee) => [employee.id, employee.code]),
      ),
      revisions: loadedRevisions,
    })
  }

  private classifyReplay(
    existing: PersonnelActionRecord,
    command: DirectPersonnelActionCommand,
    fingerprint: string,
  ): { action: PersonnelActionRecord; replayed: true } | CompanyOperationError {
    if (
      existing.employeeId !== command.employeeId ||
      existing.recordedByAccountId !== command.session.accountId ||
      existing.requestedByEmployeeId !== command.session.employeeId ||
      existing.payloadFingerprint !== fingerprint ||
      existing.sourceType !== "direct"
    ) {
      return new CompanyConflictError(
        "冪等キーが別の人事発令に使われています",
        "idempotency_conflict",
      )
    }

    return { action: existing, replayed: true }
  }

  private async persist(
    props: PersonnelActionPersistenceProps,
  ): Promise<{ action: PersonnelActionRecord; replayed: boolean } | CompanyOperationError> {
    const writeResult = await new PersonnelActionPersistenceAdapter(this.c).write(props)

    if (!(writeResult instanceof CompanyOperationError)) {
      return { action: writeResult, replayed: false }
    }

    const raced = await new PersonnelActionAdapter(this.c).findByOperationId(
      props.action.operationId,
    )

    if (!(raced instanceof CompanyOperationError) && raced !== null) {
      return this.classifyReplay(raced, props.command, props.action.payloadFingerprint)
    }

    return writeResult
  }
}
