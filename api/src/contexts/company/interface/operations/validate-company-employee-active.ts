import { ValidateEmployeeActiveAdapter } from "@/contexts/company/infrastructure/adapters/organization/validate-employee-active.adapter"

/** 従業員が在籍中であることを検査する公開境界。 */
export function validateCompanyEmployeeActive(
  c: ConstructorParameters<typeof ValidateEmployeeActiveAdapter>[0],
  ...input: Parameters<ValidateEmployeeActiveAdapter["validateEmployeeActive"]>
): ReturnType<ValidateEmployeeActiveAdapter["validateEmployeeActive"]> {
  return new ValidateEmployeeActiveAdapter(c).validateEmployeeActive(...input)
}
