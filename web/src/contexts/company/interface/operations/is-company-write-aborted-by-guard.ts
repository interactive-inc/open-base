import { isAbortedByGuard } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/lib/is-aborted-by-guard"

/** 会社の書き込みが実行直前の保護で中止されたかを判定する公開境界。 */
export function isCompanyWriteAbortedByGuard(error: unknown): boolean {
  return isAbortedByGuard(error)
}
