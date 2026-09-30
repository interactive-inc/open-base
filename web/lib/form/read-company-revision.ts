/** 確認時に取得した会社版だけを受け取り、欠落や不正値を拒否する。 */
export function readCompanyRevision(form: FormData): number | Error {
  const value = form.get("company_revision")

  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) {
    return new Error("会社情報を再取得して内容を確認してください")
  }

  const revision = Number(value)

  if (!Number.isSafeInteger(revision)) {
    return new Error("会社情報を再取得して内容を確認してください")
  }

  return revision
}
