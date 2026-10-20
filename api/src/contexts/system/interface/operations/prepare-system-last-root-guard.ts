import { SystemLastRootGuardAdapter } from "@system/infrastructure/adapters/iam/system-last-root-guard.adapter"

/** IAM変更と同じbatchで、最後のログイン可能なrootを保護する文を公開する。 */
export function prepareSystemLastRootGuard(
  input: Readonly<{ database: D1Database; targetAccountId?: string }>,
): D1PreparedStatement {
  return new SystemLastRootGuardAdapter(input).prepare()
}
