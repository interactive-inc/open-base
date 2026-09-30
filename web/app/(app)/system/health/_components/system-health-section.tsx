import { FetchError } from "@/components/fetch-error"
import { getSystemHealth } from "@/lib/api/get-system-health"

/**
 * api の health を読む。応答は status だけなので、出せるのも 1 項目だけ。
 */
export async function SystemHealthSection() {
  const status = await getSystemHealth()

  if (status instanceof Error) {
    return <FetchError message="health の取得に失敗しました" variant="network" />
  }

  return (
    <dl className="grid gap-4 rounded-2xl border bg-card p-4">
      <div className="flex flex-col gap-2">
        <dt className="text-xs text-muted-foreground">状態</dt>

        <dd className="text-sm">{status === "ok" ? "正常" : status}</dd>
      </div>
    </dl>
  )
}
