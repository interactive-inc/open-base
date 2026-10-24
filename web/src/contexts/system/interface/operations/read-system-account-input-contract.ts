import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { accountStatusSchema } from "@system/domain/schemas/iam/account-status.schema"

const contract = Object.freeze({ id: zAccountId, status: accountStatusSchema })

/** Accountへの入力を境界で検証するための公開contract。 */
export function readSystemAccountInputContract() {
  return contract
}
