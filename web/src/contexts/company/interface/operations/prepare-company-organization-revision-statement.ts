import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"

/**
 * D1のprepared statementで組む他contextのbatchに加え、読み取った会社版からの変更を原子的に拒否する。
 * 一致時は1行を返し、不一致・組織不在時はSQLiteの malformed JSON エラーでbatch全体を戻す。
 * 利用側の汎用のbatch中断判定はこの文言を意図的な中断として扱う。
 */
export function prepareCompanyOrganizationRevisionStatement(
  input: Readonly<{
    database: D1Database
    organizationId: string
    expectedRevision: number
  }>,
): D1PreparedStatement | Error {
  if (
    !CompanyResourceEntity.isIdentifier(input.organizationId) ||
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0
  ) {
    return new Error("Invalid Company organization revision guard")
  }
  return input.database
    .prepare(
      `SELECT CASE WHEN EXISTS (
         SELECT 1 FROM company_organizations WHERE id = ?1 AND revision = ?2
       ) THEN 1 ELSE json_extract('', '$') END AS revision_guard`,
    )
    .bind(input.organizationId, input.expectedRevision)
}
