import { FindPersonnelActionRequestAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/find-personnel-action-request.adapter"

/** 人事発令の申請 1 件を認可済みの表示 record として読む公開境界。 */
export function findCompanyPersonnelActionRequest(
  c: ConstructorParameters<typeof FindPersonnelActionRequestAdapter>[0],
  ...input: Parameters<FindPersonnelActionRequestAdapter["findPersonnelActionRequest"]>
): ReturnType<FindPersonnelActionRequestAdapter["findPersonnelActionRequest"]> {
  return new FindPersonnelActionRequestAdapter(c).findPersonnelActionRequest(...input)
}
