import { CompanyOrganizationResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-organization-resource-journal.adapter"
import { OrganizationUnitChangeStatementAdapter } from "@/contexts/company/infrastructure/adapters/organization/organization-unit-change-statement.adapter"
import { OrganizationWorkforceChangeEntity } from "@/contexts/company/domain/entities/organization-workforce-change.entity"
import {
  CompanyConflictError,
  CompanyOperationError,
  CompanyUnavailableError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"

function writeError(cause: unknown): CompanyOperationError {
  const message = cause instanceof Error ? cause.message : String(cause)
  if (
    message.includes("organization revision conflict") ||
    message.includes("company_revision_conflict")
  ) {
    return new CompanyConflictError("組織情報が更新されています", "personnel_action_stale")
  }
  if (message.includes("UNIQUE constraint") || message.includes("request fingerprint")) {
    return new CompanyConflictError(
      "組織変更IDまたは組織コードが競合しています",
      "idempotency_conflict",
    )
  }
  if (message.includes("organization ")) {
    return new CompanyValidationError("組織変更後の状態が不正です", "invalid_change", {
      cause,
    })
  }
  return new CompanyUnavailableError(
    "組織変更を保存できません",
    "organization_change_unavailable",
    { cause },
  )
}

type Context = CompanyContext

type FindCompletedOrganizationUnitChangeProps = Readonly<{
  operationId: string
  requestFingerprint: string
}>

type CompletedOrganizationUnitChange = Readonly<{
  resultingRevision: number
  organizationUnitId: string
}>

export class OrganizationWorkforceChangeRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async readSnapshot(asOf: Parameters<OrganizationUnitReadAdapter["readSnapshot"]>[0]) {
    return new OrganizationUnitReadAdapter(this.c.var.database).readSnapshot(asOf)
  }

  async find(
    props: FindCompletedOrganizationUnitChangeProps,
  ): Promise<CompletedOrganizationUnitChange | null | CompanyOperationError> {
    try {
      const existing = await this.c.env.DB.prepare(
        `SELECT operation.resulting_revision, operation.status, operation.request_fingerprint,
                period.organization_unit_id
           FROM company_organization_change_operations AS operation
           LEFT JOIN company_organization_unit_period_versions AS period
             ON period.recorded_by_action_id = operation.id
          WHERE operation.id = ?1`,
      )
        .bind(props.operationId)
        .first<{
          resulting_revision: number
          status: "PENDING" | "COMPLETED"
          request_fingerprint: string
          organization_unit_id: string | null
        }>()
      if (existing === null) return null
      if (
        existing.status !== "COMPLETED" ||
        existing.request_fingerprint !== props.requestFingerprint ||
        existing.organization_unit_id === null
      ) {
        return new CompanyConflictError(
          "組織変更IDが別の操作に使われています",
          "idempotency_conflict",
        )
      }
      return {
        resultingRevision: existing.resulting_revision,
        organizationUnitId: existing.organization_unit_id,
      }
    } catch (cause) {
      return writeError(cause)
    }
  }

  async append(
    change: OrganizationWorkforceChangeEntity,
    requestFingerprint: string,
  ): Promise<
    | { resultingRevision: number; organizationUnitId: string; replayed: boolean }
    | CompanyOperationError
  > {
    try {
      const existing = await this.find({ operationId: change.operationId, requestFingerprint })
      if (existing instanceof CompanyOperationError) return existing
      if (existing !== null) return { ...existing, replayed: true }

      const journal = await new CompanyOrganizationResourceJournalAdapter(this.c.env.DB).prepare(
        change,
      )
      if (journal instanceof CompanyOperationError) return journal
      const statements = new OrganizationUnitChangeStatementAdapter(this.c.env.DB).prepare(
        change,
        requestFingerprint,
      )
      const completed = statements.at(-1)
      if (completed === undefined)
        return writeError(new Error("organization completion statement missing"))
      await this.c.env.DB.batch([...statements.slice(0, -1), ...journal, completed])
      return {
        resultingRevision: change.expectedRevision + change.periodCount,
        organizationUnitId: change.unitPeriods[0]?.organizationUnitId ?? "",
        replayed: false,
      }
    } catch (cause) {
      const raced = await this.find({ operationId: change.operationId, requestFingerprint })
      if (raced !== null && !(raced instanceof CompanyOperationError)) {
        return { ...raced, replayed: true }
      }
      if (raced instanceof CompanyConflictError) return raced
      return writeError(cause)
    }
  }
}
