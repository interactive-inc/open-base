import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { InternalError, UnauthorizedError } from "@/lib/http/errors"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { resolveActiveSystemAccountId } from "@/api/http/accounts/resolve-active-system-account-id"
import { systemProposalQuery } from "@/api/http/application-requests/lib/system-application-operation"
import { readInboxBusinessCounts } from "@/api/http/inbox/read-inbox-business-counts"

// @authorization authenticated - ログインしていれば誰でも読める。各inboxの件数は権限ごとに0へ潰す
/**
 * GET /inbox/counts — 受信箱ごとの未処理件数を一括取得する。
 * ユーザーの権限に応じて各カウントを返す（権限がない inbox は 0）。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null || c.var.accountTokenVersion === null) {
    throw new UnauthorizedError()
  }

  // --- applications ---
  // 一覧と同じ案件候補者・委任・組織スコープ条件を使い、件数から非公開案件を推測させない。
  const actorAccountId = await resolveActiveSystemAccountId(c, session.accountId)
  if (actorAccountId instanceof Error) {
    throw new InternalError("failed to resolve canonical workflow actor")
  }
  const applicationInbox = await systemProposalQuery(c).list({
    creatorAccountIds: null,
    actorAccountId,
    statuses: ["pending"],
    procedureKey: null,
    createdFrom: null,
    createdTo: null,
    includeCancelled: false,
    sort: "created_at_desc",
    limit: 1,
    offset: 0,
    at: new Date(c.env.NOW ?? Date.now()),
  })
  if (applicationInbox instanceof Error) {
    throw new InternalError("failed to resolve application inbox scope")
  }

  const counts = await readInboxBusinessCounts(c, {
    session,
    tokenVersion: c.var.accountTokenVersion,
    canApproveLeaves: session.hasPermission("leave:approve"),
    canApproveShiftSwaps: session.hasPermission("shift_swap:approve"),
    canApproveThanksRedemptions: session.hasPermission("thanks_redemption:approve"),
  })

  if (counts instanceof ApplicationError) throw toHttpException(counts)

  return c.json(
    {
      applications: applicationInbox.total,
      expenses: counts.expenses,
      expenses_has_more: counts.expenses_has_more,
      leaves: counts.leaves,
      leaves_has_more: counts.leaves_has_more,
      shifts: counts.shifts,
      thanks: counts.thanks,
    },
    200,
  )
})
