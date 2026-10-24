import { InitialAccountProfileStatementAdapter } from "@/contexts/company/infrastructure/adapters/account-profile/initial-account-profile-statement.adapter"

/** Account の最初の表示名を書く文を返す公開境界。 */
export function prepareCompanyInitialAccountProfileStatement(
  c: ConstructorParameters<typeof InitialAccountProfileStatementAdapter>[0],
  ...input: Parameters<InitialAccountProfileStatementAdapter["prepare"]>
): ReturnType<InitialAccountProfileStatementAdapter["prepare"]> {
  return new InitialAccountProfileStatementAdapter(c).prepare(...input)
}
