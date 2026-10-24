import { PublishSystemAuditDisclosurePolicy } from "@system/application/audit/publish-system-audit-disclosure-policy"
import { auditDisclosureCommandSchema } from "@system/domain/schemas/audit/system-audit-disclosure-policy.schema"
import { SystemAuditDisclosurePolicyRepository } from "@system/infrastructure/repositories/audit/system-audit-disclosure-policy.repository"
import { prepareAuditDisclosureAuthorization } from "@system/interface/authorization/prepare-audit-disclosure-authorization"
import { toAuditDisclosureHttpFailure } from "@system/interface/audit/to-audit-disclosure-http-failure"
import {
  auditDisclosurePolicyResponseSchema,
  auditDisclosureCurrentPolicyResponseSchema,
} from "@system/interface/http/audit-disclosure-response-schemas"
import { SystemAuditDisclosureHttpError } from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission system:admin - 現在の人の管理資格で開示設定の最新版を読む
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("query", z.strictObject({ scope: auditDisclosureCommandSchema.shape.scope })),
  async (context) => {
    context.header("Cache-Control", "no-store")
    const proof = await prepareAuditDisclosureAuthorization(context, {
      now: context.var.now(),
      stepUpToken: null,
    })
    if (proof instanceof Error || proof === "forbidden")
      throw new SystemAuditDisclosureHttpError(toAuditDisclosureHttpFailure(proof))
    const result = await new SystemAuditDisclosurePolicyRepository({
      env: { DB: context.env.DB },
      assertions: proof,
    }).findCurrent(context.req.valid("query").scope)
    if (result instanceof Error)
      throw new SystemAuditDisclosureHttpError(toAuditDisclosureHttpFailure(result))
    return context.json(
      auditDisclosureCurrentPolicyResponseSchema.parse({ policy: result?.snapshot ?? null }),
      200,
    )
  },
)

// @authorization permission system:admin - 人の再認証と現在の管理資格で開示条件を版付きで公開する
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("json", auditDisclosureCommandSchema.omit({ actorAccountId: true })),
  async (context) => {
    context.header("Cache-Control", "no-store")
    const now = context.var.now()
    const proof = await prepareAuditDisclosureAuthorization(context, {
      now,
      stepUpToken: context.req.header("x-system-step-up") ?? "",
    })
    if (proof instanceof Error || proof === "forbidden")
      throw new SystemAuditDisclosureHttpError(toAuditDisclosureHttpFailure(proof))
    const result = await new PublishSystemAuditDisclosurePolicy({
      repository: new SystemAuditDisclosurePolicyRepository({
        env: { DB: context.env.DB },
        assertions: proof,
      }),
    }).execute({ ...context.req.valid("json"), actorAccountId: context.var.userId }, now)
    if (result instanceof Error)
      throw new SystemAuditDisclosureHttpError(toAuditDisclosureHttpFailure(result))
    return context.json(
      auditDisclosurePolicyResponseSchema.parse({
        policy: result.policy.snapshot,
        replayed: result.replayed,
      }),
      result.replayed ? 200 : 201,
    )
  },
)
