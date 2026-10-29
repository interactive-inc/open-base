import type {
  SystemAuthorizationContext,
  SystemD1Context,
} from "@system/configuration/system-context"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"

/** 人のglobal資格を、その要求の現在のBearer発行元・期限・familyと同時に要求する。 */
export async function prepareSystemHumanBearerAuthorization(
  context: SystemD1Context & SystemAuthorizationContext,
  input: Readonly<{ now: Date; permissions: ReadonlyArray<string> }>,
): Promise<
  | Readonly<{ principalId: string; assertions: ReadonlyArray<D1PreparedStatement> }>
  | "forbidden"
  | Error
> {
  const authentication = context.var.bearerReadAuthentication
  if (
    authentication === undefined ||
    authentication.accountId !== context.var.userId ||
    authentication.tokenVersion !== context.var.accountTokenVersion
  )
    return "forbidden"
  const now = new Date(Math.max(input.now.getTime(), Date.now()))
  const bearer = await new PrepareSystemReadAuthorizationAdapter(context).prepare(
    authentication,
    now,
  )
  if (bearer === null || PrepareSystemReadAuthorizationAdapter.isRejected(bearer))
    return "forbidden"
  if (bearer instanceof Error) return bearer
  const human = await new SystemHumanOperationAuthorizationAdapter(context).prepare({
    accountId: authentication.accountId,
    tokenVersion: authentication.tokenVersion,
    permissions: input.permissions,
    now,
  })
  if (human instanceof Error || human === "forbidden") return human
  const assertions = bearer.assertions(now)
  if (assertions instanceof Error) return assertions
  return { principalId: human.principalId, assertions: [...assertions, ...human.assertions] }
}
