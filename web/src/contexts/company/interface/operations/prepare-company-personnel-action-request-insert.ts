import { PersonnelActionRequestLedgerAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action-request-ledger.adapter"

/** 人事発令の申請を台帳へ記録する文を用意する公開境界。 */
export function prepareCompanyPersonnelActionRequestInsert(
  c: ConstructorParameters<typeof PersonnelActionRequestLedgerAdapter>[0],
  ...input: Parameters<PersonnelActionRequestLedgerAdapter["prepareInsert"]>
): ReturnType<PersonnelActionRequestLedgerAdapter["prepareInsert"]> {
  return new PersonnelActionRequestLedgerAdapter(c).prepareInsert(...input)
}
