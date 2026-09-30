import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"

/** 案件の状態・判断候補・委任の変更と時間境界を、開示するtransactionでも検査する文を返す。 */
export function prepareSystemCaseReadGuard(
  context: ConstructorParameters<typeof PrepareSystemCaseReadGuardAdapter>[0],
  ...input: Parameters<PrepareSystemCaseReadGuardAdapter["prepare"]>
): ReturnType<PrepareSystemCaseReadGuardAdapter["prepare"]> {
  return new PrepareSystemCaseReadGuardAdapter(context).prepare(...input)
}
