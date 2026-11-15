import { useCallback, useRef, useState } from "react"
import type { ReviewSheet } from "@/components/app/reviews-types"
import { sendApiJson } from "@/components/app/use-api-json"

/**
 * 同じ内容の送信には同じ冪等キーを使う。通信が切れてやり直しても、二重に記録されない。
 * 内容が変われば別のキーにする。サーバーは同じキーで違う内容を受け付けない。
 */
function useIdempotencyKeys(): (body: unknown) => string {
  const keys = useRef(new Map<string, string>())
  return useCallback((body: unknown) => {
    const text = JSON.stringify(body)
    const known = keys.current.get(text)
    if (known !== undefined) return known
    const key = crypto.randomUUID()
    keys.current.set(text, key)
    return key
  }, [])
}

/** 評価シートへの操作。`expected_revision` は見ている版を付け、その間の変更はサーバーが拒む。 */
export type ReviewCommandBody = { operation: string; reason: string } & Record<string, unknown>

/**
 * 一つのシートへ操作を送る。送信中と失敗の文を持ち、成功したら更新後のシートを返す。
 * 失敗の文は画面に `Alert`（`role="alert"`）で出す。
 */
export function useReviewCommand(sheet: Pick<ReviewSheet, "id" | "revision">) {
  const keyFor = useIdempotencyKeys()
  const [sending, setSending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (label: string, command: ReviewCommandBody) => {
      const body = { ...command, expected_revision: sheet.revision }
      setSending(label)
      setError(null)
      const result = await sendApiJson<ReviewSheet>(
        "POST",
        `/performance-review/sheets/${sheet.id}/commands`,
        body,
        { "Idempotency-Key": keyFor(body) },
      )
      setSending(null)
      if (result.kind === "error") {
        setError(result.message)
        return null
      }
      return result.data
    },
    [keyFor, sheet.id, sheet.revision],
  )

  return { sending, error, run }
}
