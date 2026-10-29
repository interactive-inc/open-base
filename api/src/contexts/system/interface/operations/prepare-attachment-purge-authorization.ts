import type {
  SystemAuthorizationContext,
  SystemClockContext,
  SystemD1Context,
} from "@system/configuration/system-context"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import {
  SystemAttachmentPurgeUnavailableError,
  SystemForbiddenError,
  SystemInvalidSessionError,
} from "@system/interface/errors"

/** HTTP掃除の鍵破棄を、現在のBearer発行元と管理資格が変わらないtransactionに限定する。 */
export async function prepareAttachmentPurgeAuthorization(
  context: SystemD1Context & SystemClockContext & SystemAuthorizationContext,
) {
  const authentication = context.var.bearerReadAuthentication
  if (
    authentication === undefined ||
    authentication.accountId !== context.var.userId ||
    authentication.tokenVersion !== context.var.accountTokenVersion
  )
    throw new SystemInvalidSessionError()
  const at = new Date(Math.max(context.var.now().getTime(), Date.now()))
  const proof = await new PrepareSystemReadAuthorizationAdapter(context).prepare(authentication, at)
  if (proof === null || PrepareSystemReadAuthorizationAdapter.isRejected(proof))
    throw new SystemInvalidSessionError()
  if (proof instanceof Error) throw new SystemAttachmentPurgeUnavailableError(proof)
  if (!proof.permissionKeys.has("system:admin")) throw new SystemForbiddenError()
  const assertions = proof.assertions(at)
  if (assertions instanceof Error) throw new SystemAttachmentPurgeUnavailableError(assertions)
  return assertions
}
