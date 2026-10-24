import { AdditionalEmploymentPersistenceAdapter } from "@/contexts/company/infrastructure/adapters/employee/additional-employment-persistence.adapter"

/** 既存の従業員へ追加する雇用の保存文を用意する公開境界。 */
export function prepareCompanyAdditionalEmployments(
  c: ConstructorParameters<typeof AdditionalEmploymentPersistenceAdapter>[0],
  ...input: Parameters<AdditionalEmploymentPersistenceAdapter["prepareMany"]>
): ReturnType<AdditionalEmploymentPersistenceAdapter["prepareMany"]> {
  return new AdditionalEmploymentPersistenceAdapter(c).prepareMany(...input)
}
