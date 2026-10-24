/**
 * 組織と所属・責務の期間台帳の現在の版を返す。台帳が未作成の会社はnullを返す。
 * 人事変更の提案が確認した版と照合するために使い、会社の保存先を直接読ませない。
 */
export async function readCompanyOrganizationLifecycleRevision(
  input: Readonly<{ database: D1Database }>,
): Promise<number | null | Error> {
  try {
    const revision = await input.database
      .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
      .first<number>("revision")
    if (revision === null) return null
    return Number.isSafeInteger(revision) && revision >= 0
      ? revision
      : new Error("company organization lifecycle revision is unavailable")
  } catch (cause) {
    return new Error("company organization lifecycle revision is unavailable", { cause })
  }
}
