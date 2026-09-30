import { createClient } from "@/lib/api/hc-client"

/**
 * GET /system/batch-jobs。バッチジョブの状況一覧を取得する。
 * 認証必須のため、未認証や権限不足の場合は api が 401/403 を返し戻りは Error になる。
 */
export async function getBatchJobList() {
  const client = await createClient()

  const response = await client.system["batch-jobs"].$get({ query: {} })

  if (response.status >= 400) {
    return new Error("failed to load batch jobs")
  }

  const body = await response.json()

  return body.data
}
