import { SystemD1AuthorizedExecutionAdapter } from "@system/infrastructure/adapters/workflow/system-d1-authorized-execution.adapter"

/** 承認済みCaseの一回限りの実行許可を消費し、呼び出し側の変更と同じD1 batchで確定する。 */
export function executeSystemAuthorizedOperation(
  context: ConstructorParameters<typeof SystemD1AuthorizedExecutionAdapter>[0],
  ...input: Parameters<SystemD1AuthorizedExecutionAdapter["execute"]>
): ReturnType<SystemD1AuthorizedExecutionAdapter["execute"]> {
  return new SystemD1AuthorizedExecutionAdapter(context).execute(...input)
}
