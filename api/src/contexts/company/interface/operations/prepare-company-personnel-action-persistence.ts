import { PersonnelActionPersistenceAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action-persistence.adapter"

/** 人事発令の保存の文を準備する公開境界。 */
export function prepareCompanyPersonnelActionPersistence(
  c: ConstructorParameters<typeof PersonnelActionPersistenceAdapter>[0],
  ...input: Parameters<PersonnelActionPersistenceAdapter["prepare"]>
): ReturnType<PersonnelActionPersistenceAdapter["prepare"]> {
  return new PersonnelActionPersistenceAdapter(c).prepare(...input)
}
