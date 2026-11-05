import { useEffect, useState } from "react"

export type ApiJsonState<T> =
  | { kind: "loading" }
  | { kind: "ok"; data: T }
  | { kind: "forbidden" }
  | { kind: "error" }

/**
 * サインイン済みのセッションで同じoriginの `/api` を読む。ブラウザで描いた後にだけ取りに行く。
 * 権限が無い応答は表示を出し分けるため、失敗と分けて返す。
 */
export function useApiJson<T>(path: string): ApiJsonState<T> {
  const [state, setState] = useState<ApiJsonState<T>>({ kind: "loading" })

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api${path}`, { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          setState({ kind: "forbidden" })
          return
        }
        if (!response.ok) {
          setState({ kind: "error" })
          return
        }
        setState({ kind: "ok", data: (await response.json()) as T })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: "error" })
      })
    return () => controller.abort()
  }, [path])

  return state
}
