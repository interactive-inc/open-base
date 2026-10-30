import type {
  SystemAuthorizationContext,
  SystemD1Context,
} from "@system/configuration/system-context"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"

type Access = Readonly<{
  permissionKeys: ReadonlySet<string>
  scopedPermissionKeys: ReadonlyMap<string, ReadonlySet<string>>
  revalidate: () => Promise<"forbidden" | Error | null>
}>

/** 現在の資格を読取前後で固定する。未存在応答にも再照合を適用し、存在有無を漏らさない。 */
export async function prepareSystemBearerReadAccess(
  context: SystemD1Context & SystemAuthorizationContext,
  at: Date,
): Promise<Access | "forbidden" | Error> {
  const authentication = context.var.bearerReadAuthentication
  if (
    authentication === undefined ||
    authentication.accountId !== context.var.userId ||
    authentication.tokenVersion !== context.var.accountTokenVersion
  )
    return "forbidden"
  const now = new Date(Math.max(at.getTime(), Date.now()))
  const proof = await new PrepareSystemReadAuthorizationAdapter(context).prepare(
    authentication,
    now,
  )
  if (proof === null || PrepareSystemReadAuthorizationAdapter.isRejected(proof)) return "forbidden"
  if (proof instanceof Error) return proof
  const assertions = proof.assertions(now)
  if (assertions instanceof Error) return assertions
  return {
    permissionKeys: proof.permissionKeys,
    scopedPermissionKeys: proof.scopedPermissionKeys,
    revalidate: async () => {
      try {
        const checked = await context.env.DB.batch([...assertions])
        if (checked.length !== assertions.length || checked.some((entry) => !entry.success))
          return new Error("bearer read revalidation failed")
        return null
      } catch (cause) {
        if (PrepareSystemReadAuthorizationAdapter.isRejected(cause)) return "forbidden"
        return cause instanceof Error ? cause : new Error("bearer read revalidation failed")
      }
    },
  }
}
