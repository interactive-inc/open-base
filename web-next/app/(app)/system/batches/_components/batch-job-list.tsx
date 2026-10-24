import { BatchJobTable } from "@/app/(app)/system/batches/_components/batch-job-table"
import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { getBatchJobList } from "@/lib/api/get-batch-job-list"

/**
 * バッチジョブ状況一覧をサーバ側 fetch してテーブル描画する非同期 RSC。
 * 権限不足や未認証は api が 401/403 を返すため、その場合はエラーメッセージにフォールバックする。
 */
export async function BatchJobList() {
  const jobs = await getBatchJobList()

  if (jobs instanceof Error) {
    return <FetchError message="バッチの一覧を読み込めませんでした。" />
  }

  if (jobs.length === 0) {
    return <EmptyState title="バッチがありません" />
  }

  return <BatchJobTable jobs={jobs} />
}
