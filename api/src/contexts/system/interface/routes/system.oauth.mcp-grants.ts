import { JwtSecretMissingApplicationError } from "@/contexts/system/application/errors"
import { systemFactory } from "@/contexts/system/interface/request-environment/system-factory"
import { SystemApplicationError } from "@system/interface/errors"
import { createMcpGrantToken } from "@system/lib/auth/create-mcp-grant-token"
import { requireSystemAuthentication } from "@system/interface/middlewares/require-system-authentication"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { zAppMcpGrantResponse } from "@/contexts/system/interface/models/auth"

/**
 * MCP コネクタ接続の同意で grant を発行する 。
 *
 * 製品の同意画面が「接続を許可」で呼ぶ。認証済みSystem主体だけを受け付けるため、
 * 発行対象は常にセッション本人 (c.var.userId) で、body からは受け取らない。permission キーは
 * 要求しない。「自分のアカウントを自分の AI クライアントに繋ぐ」操作であり、付与されるのは
 * 本人が既に持っている権限そのものだから。
 *
 * DB には何も残さない。grant は署名付きの短命 JWT (120 秒) 自体が状態で、交換 API が署名と
 * PKCE verifier で検証する。
 */
// @authorization authenticated - 検証済みSystem Account本人のgrantだけを発行する
export const POST = systemFactory.createHandlers(
  requireSystemAuthentication,
  zValidator("json", z.object({ challenge: z.string().min(1) })),
  async (c) => {
    const body = c.req.valid("json")
    if (c.env.JWT_SECRET === undefined || c.env.JWT_SECRET.length === 0) {
      throw new SystemApplicationError(new JwtSecretMissingApplicationError())
    }
    const grant = await createMcpGrantToken(
      c.var.userId,
      c.var.accountTokenVersion,
      body.challenge,
      c.env.JWT_SECRET,
    )

    return c.json(zAppMcpGrantResponse.parse({ item: { grant } }))
  },
)
