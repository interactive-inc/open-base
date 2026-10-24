import { InitialEmploymentActionAdapter } from "@/contexts/company/infrastructure/adapters/employee/initial-employment-action.adapter"

/** 初回の雇用を記録する人事発令を用意する公開境界。 */
export function prepareCompanyInitialEmploymentAction(
  c: ConstructorParameters<typeof InitialEmploymentActionAdapter>[0],
  ...input: Parameters<InitialEmploymentActionAdapter["prepare"]>
): ReturnType<InitialEmploymentActionAdapter["prepare"]> {
  return new InitialEmploymentActionAdapter(c).prepare(...input)
}
