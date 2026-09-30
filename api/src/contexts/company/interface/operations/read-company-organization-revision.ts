/**
 * 会社の現在の版を返す。初期化前の会社は0を返す。
 * 業務側が変更commandの期待する版を画面へ渡すために使い、会社の保存先を直接読ませない。
 */
export async function readCompanyOrganizationRevision(
  input: Readonly<{ database: D1Database; organizationId: string }>,
): Promise<number | Error> {
  try {
    const revision = await input.database
      .prepare("SELECT revision FROM company_organizations WHERE id = ?1")
      .bind(input.organizationId)
      .first<number>("revision")
    if (revision === null) return 0
    return Number.isSafeInteger(revision) && revision >= 0
      ? revision
      : new Error("company organization revision is unavailable")
  } catch (cause) {
    return new Error("company organization revision is unavailable", { cause })
  }
}
