import { z } from "zod"
import type { WorkforceConnectionCompletionEntity } from "@/contexts/company/domain/entities/workforce-connection-completion.entity"
import {
  CompanyConflictError,
  CompanyUnavailableError,
  type CompanyOperationError,
} from "@/contexts/company/domain/errors"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Context = D1Database

export type WorkforceConnectionCompletion = Readonly<{
  commandId: string
  actorAccountId: string
  reason: string
  employeeCount: number
  employmentCount: number
  completedAt: number
}>

export type WorkforceConnectionStatus = Readonly<{
  completion: WorkforceConnectionCompletion | null
  unconnectedEmployeeCount: number
  unconnectedEmploymentCount: number
}>

const UNCONNECTED_EMPLOYEES = `SELECT count(*) FROM company_employees AS employee
  WHERE NOT EXISTS (SELECT 1 FROM company_workforce_resource_bindings AS binding
    WHERE binding.resource_type = 'employee' AND binding.employee_id = employee.id)`
const UNCONNECTED_EMPLOYMENTS = `SELECT count(*) FROM company_employments AS employment
  WHERE NOT EXISTS (SELECT 1 FROM company_workforce_resource_bindings AS binding
    WHERE binding.resource_type = 'employment' AND binding.resource_id = employment.id)`

const rowSchema = z.object({
  command_id: z.string().nullable(),
  actor_account_id: z.string().nullable(),
  reason: z.string().nullable(),
  employee_count: z.number().int().nullable(),
  employment_count: z.number().int().nullable(),
  completed_at: z.number().int().nullable(),
  unconnected_employees: z.number().int(),
  unconnected_employments: z.number().int(),
})

/** 接続完了の宣言を、全件の接続の再検査と同じ書き込みで一度だけ保存する。 */
export class WorkforceConnectionCompletionRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async status(): Promise<WorkforceConnectionStatus | CompanyUnavailableError> {
    const row = await this.read()
    if (row instanceof Error) return row
    return {
      completion: toCompletion(row),
      unconnectedEmployeeCount: row.unconnected_employees,
      unconnectedEmploymentCount: row.unconnected_employments,
    }
  }

  async complete(
    command: WorkforceConnectionCompletionEntity,
  ): Promise<(WorkforceConnectionCompletion & { replayed: boolean }) | CompanyOperationError> {
    const row = await this.read()
    if (row instanceof Error) return row
    const existing = toCompletion(row)
    if (existing !== null) return this.replay(existing, command)
    if (row.unconnected_employees > 0 || row.unconnected_employments > 0) return this.incomplete()
    const input = command.props
    try {
      // 件数と未接続の不在は、保存時にDBのtriggerが同じ条件で再検査する。
      await this.c
        .prepare(`INSERT INTO company_workforce_connection_completions
          (organization_id, command_id, actor_account_id, reason, employee_count, employment_count, completed_at)
          VALUES (?1, ?2, ?3, ?4, (SELECT count(*) FROM company_employees),
            (SELECT count(*) FROM company_employments), ?5)`)
        .bind(
          input.organizationId,
          input.commandId,
          input.actorAccountId,
          input.reason,
          input.recordedAt,
        )
        .run()
    } catch (cause) {
      if (String(cause).includes("company_workforce_connection_incomplete"))
        return this.incomplete()
      const raced = await this.read()
      const completion = raced instanceof Error ? null : toCompletion(raced)
      if (completion !== null) return this.replay(completion, command)
      return new CompanyUnavailableError(
        "接続の完了を記録できません",
        "workforce_connection_unavailable",
        { cause },
      )
    }
    const saved = await this.read()
    if (saved instanceof Error) return saved
    const completion = toCompletion(saved)
    if (completion === null)
      return new CompanyUnavailableError(
        "接続の完了を記録できません",
        "workforce_connection_unavailable",
      )
    return { ...completion, replayed: false }
  }

  private async read() {
    try {
      const row = await this.c
        .prepare(`SELECT completion.command_id, completion.actor_account_id, completion.reason,
            completion.employee_count, completion.employment_count, completion.completed_at,
            (${UNCONNECTED_EMPLOYEES}) AS unconnected_employees,
            (${UNCONNECTED_EMPLOYMENTS}) AS unconnected_employments
          FROM (SELECT 1) AS anchor
          LEFT JOIN company_workforce_connection_completions AS completion
            ON completion.organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`)
        .first()
      return rowSchema.parse(row)
    } catch (cause) {
      return new CompanyUnavailableError(
        "接続の状態を読めません",
        "workforce_connection_unavailable",
        { cause },
      )
    }
  }

  private replay(
    existing: WorkforceConnectionCompletion,
    command: WorkforceConnectionCompletionEntity,
  ) {
    if (existing.commandId !== command.props.commandId || existing.reason !== command.props.reason)
      return new CompanyConflictError(
        "接続の完了は既に記録されています",
        "workforce_connection_already_completed",
      )
    return { ...existing, replayed: true }
  }

  private incomplete() {
    return new CompanyConflictError(
      "公開履歴へ未接続の従業員または雇用が残っています",
      "workforce_connection_incomplete",
    )
  }
}

function toCompletion(row: z.infer<typeof rowSchema>): WorkforceConnectionCompletion | null {
  if (
    row.command_id === null ||
    row.actor_account_id === null ||
    row.reason === null ||
    row.employee_count === null ||
    row.employment_count === null ||
    row.completed_at === null
  )
    return null
  return {
    commandId: row.command_id,
    actorAccountId: row.actor_account_id,
    reason: row.reason,
    employeeCount: row.employee_count,
    employmentCount: row.employment_count,
    completedAt: row.completed_at,
  }
}
