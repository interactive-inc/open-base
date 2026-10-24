import { parseAuditExportSearchParams } from "@/app/(app)/system/audit-events/_lib/parse-audit-export-search-params"
import { exportAuditEvents } from "@/lib/api/export-audit-events"

const noStoreHeaders = { "Cache-Control": "no-store" }
const forwardedHeaders = ["Content-Type", "Content-Disposition", "X-Request-ID"] as const

function safeError(status: number): Response {
  return Response.json(
    { error: status === 400 ? "出力条件が無効です。" : "監査ログを出力できませんでした。" },
    { status, headers: noStoreHeaders },
  )
}

export async function GET(request: Request): Promise<Response> {
  const parsed = parseAuditExportSearchParams(new URL(request.url).searchParams)
  if (!parsed.ok) return safeError(400)

  let upstream: Response
  try {
    upstream = await exportAuditEvents(parsed.request)
  } catch {
    return safeError(503)
  }

  const headers = new Headers(noStoreHeaders)
  for (const name of forwardedHeaders) {
    const value = upstream.headers.get(name)
    if (value !== null) headers.set(name, value)
  }

  return new Response(upstream.body, { status: upstream.status, headers })
}
