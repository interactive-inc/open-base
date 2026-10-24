import { PersonnelActionRequestLedgerAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action-request-ledger.adapter"

/** 人事発令の申請台帳を読む公開境界。 */
export function listCompanyPersonnelActionRequests(
  c: ConstructorParameters<typeof PersonnelActionRequestLedgerAdapter>[0],
  ...input: Parameters<PersonnelActionRequestLedgerAdapter["list"]>
): ReturnType<PersonnelActionRequestLedgerAdapter["list"]> {
  return new PersonnelActionRequestLedgerAdapter(c).list(...input)
}
