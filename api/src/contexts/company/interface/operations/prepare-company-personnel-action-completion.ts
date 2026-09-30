import { PersonnelActionCompletionPreparationAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action-completion-preparation.adapter"

/** 承認済みの人事発令の確定を準備する公開境界。 */
export function prepareCompanyPersonnelActionCompletion(
  c: ConstructorParameters<typeof PersonnelActionCompletionPreparationAdapter>[0],
  ...input: Parameters<PersonnelActionCompletionPreparationAdapter["prepare"]>
): ReturnType<PersonnelActionCompletionPreparationAdapter["prepare"]> {
  return new PersonnelActionCompletionPreparationAdapter(c).prepare(...input)
}
