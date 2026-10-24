import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"

/**
 * 組織の変更操作の ID。trigger は ID を組み立て直せないため、操作は旧来の鍵（`org-resource:<fingerprint>` など）を
 * operation_key に持ち、ID はその鍵から決まる UUID にする。
 */
export function companyOperationId(key: string): string {
  return deterministicCompanyId("organization-operation", key)
}
