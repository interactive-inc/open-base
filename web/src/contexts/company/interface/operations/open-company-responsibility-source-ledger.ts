import { ResponsibilitySourceLedgerAdapter } from "@/contexts/company/infrastructure/adapters/organization/responsibility-source-ledger.adapter"

export type CompanyResponsibilitySourceLedger = Pick<
  ResponsibilitySourceLedgerAdapter,
  "prepareAdoption" | "listAdoptedSources" | "findCutover" | "prepareCutover"
>

/** 業務が採用した責任の出所と切替を記録する公開境界。 */
export function openCompanyResponsibilitySourceLedger(
  c: ConstructorParameters<typeof ResponsibilitySourceLedgerAdapter>[0],
): CompanyResponsibilitySourceLedger {
  return new ResponsibilitySourceLedgerAdapter(c)
}
