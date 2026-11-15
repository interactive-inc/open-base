import { useCallback, useEffect, useState } from "react"

export type ApiJsonState<T> =
  | { kind: "loading" }
  | { kind: "ok"; data: T }
  | { kind: "forbidden" }
  | { kind: "error" }

/** 読み込みが終わった状態。loaderが先に読んだ結果もこの形で渡る。 */
export type LoadedApiJson<T> = Exclude<ApiJsonState<T>, { kind: "loading" }>

/** 書き込みの結果。失敗のときは、画面にそのまま出せる文を持つ。 */
export type SendResult<T> =
  | { kind: "ok"; data: T }
  /** `code` はサーバーが返した理由。無いときは空文字。画面で理由ごとに出し分けるときに使う。 */
  | { kind: "error"; message: string; code: string }

/**
 * サインイン済みのセッションで同じoriginの `/api` を読む。
 * 権限が無い応答は表示を出し分けるため、失敗と分けて返す。
 */
export async function fetchApiJson<T>(
  path: string,
  signal?: AbortSignal,
): Promise<LoadedApiJson<T>> {
  const response = await fetch(`/api${path}`, { credentials: "same-origin", signal })
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return { kind: "forbidden" }
  }
  if (!response.ok) return { kind: "error" }
  return { kind: "ok", data: (await response.json()) as T }
}

/**
 * `/api` を読む。loaderが先に読んだ結果を `initial` に渡すと、それを最初から表示し、取りに行かない。
 * `reload` は書き込みの後に読み直すために使う。
 */
export function useApiJson<T>(
  path: string,
  initial?: ApiJsonState<T>,
): ApiJsonState<T> & { reload: () => Promise<void> } {
  const [state, setState] = useState<ApiJsonState<T>>(initial ?? { kind: "loading" })
  const loaded = initial !== undefined

  useEffect(() => {
    if (loaded) return
    const controller = new AbortController()
    fetchApiJson<T>(path, controller.signal)
      .then(setState)
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: "error" })
      })
    return () => controller.abort()
  }, [path, loaded])

  const reload = useCallback(async () => {
    setState(await fetchApiJson<T>(path).catch((): LoadedApiJson<T> => ({ kind: "error" })))
  }, [path])

  return { ...state, reload }
}

/** よくある失敗を、次に何をすればよいかが分かる文にする。 */
const MESSAGES: Readonly<Record<string, string>> = {
  step_up_required: "サインインし直してから、もう一度操作してください。",
  conflict: "ほかの人が先に更新しました。読み込み直して確認してください。",
  forbidden: "この操作をする権限がありません。",
  not_found: "対象が見つかりません。読み込み直して確認してください。",
  rate_limited: "操作が続きました。少し待ってからやり直してください。",
  template_in_use: "このテンプレートを使った申請があるので、削除できません。",
  template_code_conflict: "同じコードのテンプレートがすでにあります。別のコードにしてください。",
  workflow_revision_conflict:
    "ほかの人が先にワークフローを更新しました。読み込み直して確認してください。",
  not_returned: "差し戻されていない申請は出し直せません。",
  not_pending: "この申請はもう判断が済んでいます。読み込み直して確認してください。",
  workflow_locked: "承認が進んでいる申請は変更できません。差し戻されたときに出し直せます。",
  last_active_identity: "最後のサインイン方法は失効できません。先に別の方法を追加してください。",
  last_root: "全権を持つ最後の管理者を無くす操作はできません。",
  role_in_use: "このロールは使われているので、削除できません。",
  managed_role: "標準のロールは変更できません。",
  self_assignment: "自分自身のロールは変更できません。",
  identity_conflict: "同じサインイン方法がすでに登録されています。",
  role_binding_conflict: "そのロールはすでに付いています。",
  invalid_credentials: "本人確認に失敗しました。入力を確認してください。",
  decision_requires_browser:
    "CLI から引き継いだサインインでは判断できません。サインアウトして、この画面でサインインし直してください。",
  unknown_approver_role: "承認者に指定したロールがありません。ロールを確かめてください。",
}

/** `/api` へ書き込む。失敗の理由はサーバーの `code` から文にし、分からないものは一般的な文にする。 */
export async function sendApiJson<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  headers?: Readonly<Record<string, string>>,
): Promise<SendResult<T>> {
  try {
    const response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (response.ok) {
      const data = response.status === 204 ? null : await response.json().catch(() => null)
      return { kind: "ok", data: data as T }
    }
    const failure = (await response.json().catch(() => null)) as {
      code?: unknown
      error?: unknown
    } | null
    // 理由は `code` に入る。`error` に理由のコードをそのまま入れて返すAPIもあるので、そちらも見る。
    const code =
      typeof failure?.code === "string"
        ? failure.code
        : typeof failure?.error === "string" && /^[a-z0-9_]+$/.test(failure.error)
          ? failure.error
          : ""
    const fallback =
      response.status === 403
        ? MESSAGES.forbidden
        : response.status === 404
          ? MESSAGES.not_found
          : response.status === 409
            ? MESSAGES.conflict
            : response.status === 429
              ? MESSAGES.rate_limited
              : response.status === 400 || response.status === 422
                ? "入力を確認してください。"
                : "処理できませんでした。少し待ってからやり直してください。"
    return { kind: "error", message: MESSAGES[code] ?? fallback ?? "", code }
  } catch {
    return {
      kind: "error",
      message: "通信できませんでした。接続を確認してやり直してください。",
      code: "",
    }
  }
}
