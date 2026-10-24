import { FindRegisteredEmployeeByOperationAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/find-registered-employee-by-operation.adapter"

/** 冪等 key で確定済みの入社と登録時の値を読む公開境界。 */
export function findCompanyRegisteredEmployeeByOperation(
  c: ConstructorParameters<typeof FindRegisteredEmployeeByOperationAdapter>[0],
  ...input: Parameters<FindRegisteredEmployeeByOperationAdapter["find"]>
): ReturnType<FindRegisteredEmployeeByOperationAdapter["find"]> {
  return new FindRegisteredEmployeeByOperationAdapter(c).find(...input)
}
