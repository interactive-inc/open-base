import { createClient } from "@/lib/api/hc-client"
import type { InboxCounts } from "@/lib/api/types/inbox-types"

/** GET /inbox/counts。受信箱ごとの未処理件数を取得する。 */
export async function getInboxCounts(): Promise<InboxCounts | Error> {
  const client = await createClient()

  const response = await client["company"]["inbox"].counts.$get()

  if (response.status >= 400) {
    return new Error("failed to load inbox counts")
  }

  return response.json()
}
