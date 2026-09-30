import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyRevisionGuardAdapter } from "@/contexts/company/infrastructure/adapters/core/company-revision-guard.adapter"
import type { BatchItem } from "drizzle-orm/batch"

/**
 * 他 context の D1 batch に先頭で加え、読み取った会社版からの変更を原子的に拒否する。
 * 一致時は値を変えず、不一致・組織不在時は SQLite の JSON 検証エラーで batch 全体を戻す。
 */
export function prepareCompanyOrganizationRevisionGuard(
  input: Readonly<{
    database: D1Database
    organizationId: string
    expectedRevision: number
  }>,
): BatchItem<"sqlite"> | Error {
  if (
    !CompanyResourceEntity.isIdentifier(input.organizationId) ||
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0
  ) {
    return new Error("Invalid Company organization revision guard")
  }

  return new CompanyRevisionGuardAdapter(input).prepare()
}
