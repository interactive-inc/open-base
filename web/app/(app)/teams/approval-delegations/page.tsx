import { DelegationManager } from "@/app/(app)/teams/approval-delegations/_components/delegation-manager"
import { BackButton } from "@/components/back-button"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { getApprovalDelegations } from "@/lib/api/get-approval-delegations"

export const metadata = { title: "代理承認の設定" }

export default async function ApprovalDelegationsPage() {
  const result = await getApprovalDelegations()
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="代理承認の設定">
        <BackButton href="/my/applications" label="申請へ戻る" />
      </PageHeader>
      {result instanceof Error ? (
        <FetchError message="代理承認設定の取得に失敗しました" />
      ) : (
        <DelegationManager delegations={result.data} />
      )}
    </div>
  )
}
