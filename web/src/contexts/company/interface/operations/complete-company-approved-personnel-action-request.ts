import { CompleteApprovedPersonnelActionRequest } from "@/contexts/company/application/employee-lifecycle/procedure/complete-approved-personnel-action-request"

/** 承認済みの人事発令申請を会社の雇用事実として確定する公開境界。 */
export function completeCompanyApprovedPersonnelActionRequest(
  c: ConstructorParameters<typeof CompleteApprovedPersonnelActionRequest>[0],
  ...input: Parameters<CompleteApprovedPersonnelActionRequest["run"]>
): ReturnType<CompleteApprovedPersonnelActionRequest["run"]> {
  return new CompleteApprovedPersonnelActionRequest(c).run(...input)
}
