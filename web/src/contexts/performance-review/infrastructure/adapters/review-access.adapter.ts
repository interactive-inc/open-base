import type { ReviewContext } from "@/contexts/performance-review/configuration/review-context"
import type { ReviewSheetEntity } from "@/contexts/performance-review/domain/entities/review-sheet.entity"
import { ReviewError } from "@/contexts/performance-review/domain/errors"
import { prepareSystemReadAuthorization } from "@system/interface/operations/prepare-system-read-authorization"
import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { prepareCompanyAuthoritySnapshotGuard } from "@/contexts/company/interface/operations/prepare-company-authority-snapshot-guard"
import { prepareSystemCaseReadGuard } from "@system/interface/operations/prepare-system-case-read-guard"
import { ReviewReadAuthorityAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-read-authority.adapter"
import { prepareSystemHumanOperationAuthorization } from "@system/interface/operations/prepare-system-human-operation-authorization"

export const REVIEW_COMPLETION_KEYS = [
  "performance-review.goals.approve",
  "performance-review.evaluation.approve",
] as const

/** 操作能力と現在の在籍を固定する。管理権限で判断資格を補完しない。 */
export class ReviewAccessAdapter {
  constructor(private readonly c: ReviewContext) {}
  async prepare(permission: string) {
    const actor = this.c.actor,
      now = this.c.now()
    if (
      actor.authentication.machineCredentialId !== null ||
      actor.authentication.accountId !== actor.accountId
    )
      throw new ReviewError(403, "human_session_required")
    const proof = await prepareSystemReadAuthorization({
      database: this.c.env.DB,
      authentication: actor.authentication,
      at: now,
    })
    if (proof instanceof Error) throw new ReviewError(503, "authorization_unavailable")
    if (
      proof === null ||
      (!proof.permissionKeys.has(permission) && !proof.permissionKeys.has("system:admin"))
    )
      throw new ReviewError(403, "permission_required")
    const human = await prepareSystemHumanOperationAuthorization({
      database: this.c.env.DB,
      accountId: actor.accountId,
      tokenVersion: actor.authentication.tokenVersion,
      sessionFamilyId: actor.authentication.sessionFamilyId,
      permissions: [permission],
      now,
    })
    if (human instanceof Error) throw new ReviewError(503, "authorization_unavailable")
    if (human === "forbidden") throw new ReviewError(403, "human_session_required")
    const before = await prepareCompanyAuthoritySnapshotGuard(
      { database: this.c.env.DB },
      { accountIds: [actor.accountId], employeeCodes: [] },
    )
    if (before instanceof Error) throw new ReviewError(503, "company_authority_unavailable")
    const people = await openCompanyEmployeeDirectory(this.c).findForAccountIds([actor.accountId])
    if (people instanceof Error) throw new ReviewError(503, "employment_unavailable")
    const employee = people.find((person) => person.accountId === actor.accountId)?.employee
    if (employee?.id !== actor.employeeId || employee.employment?.status !== "ACTIVE")
      throw new ReviewError(403, "active_employment_required")
    const assertions = proof.assertions(this.c.now())
    if (assertions instanceof Error) throw new ReviewError(403, "authorization_changed")
    return {
      permissions: proof.permissionKeys,
      guards: [...assertions, ...human.assertions, before],
    }
  }
  async read(sheet: ReviewSheetEntity) {
    const access = await this.prepare("performance_review:read")
    const guards = [...access.guards]
    if (sheet.data.approval !== null) {
      const guard = await prepareSystemCaseReadGuard(this.c, {
        caseId: sheet.data.approval.case_id,
        accountId: this.c.actor.accountId,
        at: this.c.now(),
      })
      if (guard instanceof Error) throw new ReviewError(503, "review_authority_unavailable")
      guards.push(guard(this.c.now()))
    }
    if (
      sheet.data.owner_account_id === this.c.actor.accountId ||
      access.permissions.has("performance_review:read:all") ||
      access.permissions.has("system:admin")
    )
      return { ...access, guards }
    const authority = await new ReviewReadAuthorityAdapter(this.c).prepare(sheet)
    return { ...access, guards: [...guards, ...authority] }
  }
}
