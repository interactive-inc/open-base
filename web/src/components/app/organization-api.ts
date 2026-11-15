import { useCallback, useEffect, useState } from "react"
import type { ApiJsonState, LoadedApiJson } from "@/components/app/use-api-json"

/**
 * 会社の公開資源のAPIは、どの会社を読むかを `x-company-organization-id` で受け取る。
 * 共通の `useApiJson` はヘッダーを付けられないので、この領域ではこちらを使う。
 * 応答の分け方（401・403・404は権限なし）は `useApiJson` と同じにする。
 */
async function fetchCompanyJson<T>(
  path: string,
  organizationId: string,
  signal?: AbortSignal,
): Promise<LoadedApiJson<T>> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    headers: { "x-company-organization-id": organizationId },
    signal,
  })
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return { kind: "forbidden" }
  }
  if (!response.ok) return { kind: "error" }
  return { kind: "ok", data: (await response.json()) as T }
}

/** `path` がnullのあいだは読まず、読み込み中のままにする。 */
export function useCompanyJson<T>(
  path: string | null,
  organizationId: string,
): ApiJsonState<T> & { reload: () => Promise<void> } {
  const [state, setState] = useState<{ path: string | null; value: ApiJsonState<T> }>({
    path,
    value: { kind: "loading" },
  })

  useEffect(() => {
    if (path === null) return
    const controller = new AbortController()
    fetchCompanyJson<T>(path, organizationId, controller.signal)
      .then((value) => setState({ path, value }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ path, value: { kind: "error" } })
      })
    return () => controller.abort()
  }, [path, organizationId])

  const reload = useCallback(async () => {
    if (path === null) return
    const value = await fetchCompanyJson<T>(path, organizationId).catch(
      (): LoadedApiJson<T> => ({ kind: "error" }),
    )
    setState({ path, value })
  }, [path, organizationId])

  // 経路が変わった直後は、前の経路の結果を見せない。
  const value: ApiJsonState<T> = state.path === path ? state.value : { kind: "loading" }
  return { ...value, reload }
}
