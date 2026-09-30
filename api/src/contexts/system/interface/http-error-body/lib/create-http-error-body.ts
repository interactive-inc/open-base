import type { HTTPErrorBody, HTTPErrorBodyInput } from "@system/interface/errors"

function defaultHTTPErrorMessage(status: number): string {
  if (status === 400 || status === 422) {
    return "入力内容を確認してください。"
  }

  if (status === 401) {
    return "ログイン状態を確認して、もう一度お試しください。"
  }

  if (status === 403) {
    return "この操作を行う権限がありません。"
  }

  if (status === 404) {
    return "対象のデータが見つかりません。削除または更新された可能性があります。"
  }

  if (status === 409 || status === 423) {
    return "現在の状態ではこの操作を完了できません。画面を更新して、もう一度お試しください。"
  }

  if (status === 413) {
    return "送信するデータのサイズが上限を超えています。"
  }

  if (status === 415) {
    return "この形式のデータは受け付けられません。"
  }

  if (status === 429) {
    return "操作が集中しています。しばらく待ってからもう一度お試しください。"
  }

  return "処理中に問題が発生しました。時間をおいてもう一度お試しください。"
}

/** HTTP status に応じた既定文言を補い、公開用のエラー本文を組み立てる。 */
export function createHTTPErrorBody(
  status: number,
  input: string | HTTPErrorBodyInput,
): HTTPErrorBody {
  return typeof input === "string"
    ? { error: input, message: defaultHTTPErrorMessage(status) }
    : { ...input, message: input.message ?? defaultHTTPErrorMessage(status) }
}
