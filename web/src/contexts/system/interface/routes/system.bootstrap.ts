import {
  SystemAlreadyInitializedError,
  SystemBootstrapCredentialInvalidError,
  SystemBootstrapInputInvalidError,
  SystemBootstrapUnavailableError,
  SystemNotFoundError,
} from "@system/interface/errors"
/** /system/bootstrap */
import { BootstrapSystemRoot } from "@system/application/iam/bootstrap-system-root"
import { SystemBootstrapTokenValue } from "@system/domain/values/auth/system-bootstrap-token.value"
import { timingSafeStringEqual } from "@system/lib/auth/timing-safe-string-equal"
import { D1SystemRootBootstrapAdapter } from "@system/infrastructure/adapters/iam/d1-system-root-bootstrap.adapter"
import { prepareSystemPasskeyEnrollment } from "@system/interface/operations/prepare-system-passkey-enrollment"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization public - single-use secretと永続bootstrap stateで初期root作成とパスキー招待だけを許す
export const POST = systemFactory.createHandlers(
  systemFactory.createMiddleware(async (context, next) => {
    if (SystemBootstrapTokenValue.create(context.env.BOOTSTRAP_TOKEN) === null) {
      throw new SystemNotFoundError()
    }

    await next()
  }),
  zValidator(
    "json",
    z
      .object({
        token: z.string().min(16).max(4096),
        email: z
          .string()
          .trim()
          .toLowerCase()
          .email()
          .min(3)
          .max(254)
          .regex(/^[\x20-\x7e]+$/),
      })
      .strict(),
  ),
  async (context) => {
    const expectedToken = context.env.BOOTSTRAP_TOKEN
    if (SystemBootstrapTokenValue.create(expectedToken) === null || expectedToken === undefined) {
      throw new SystemNotFoundError()
    }
    const body = context.req.valid("json")
    if (!(await timingSafeStringEqual(body.token, expectedToken))) {
      throw new SystemBootstrapCredentialInvalidError()
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemBootstrapUnavailableError()
    }
    const systemContext = { env: { DB: context.env.DB } }
    const bootstrap = await new BootstrapSystemRoot({
      enrollmentIssuer: {
        prepare: (input) =>
          prepareSystemPasskeyEnrollment(systemContext, {
            ...input,
            reason: "bootstrap",
            issuedByAccountId: null,
          }),
      },
      repository: new D1SystemRootBootstrapAdapter(systemContext),
    }).execute({ email: body.email, now })
    if (bootstrap instanceof Error) {
      throw new SystemBootstrapUnavailableError()
    }
    if (bootstrap.kind === "invalid_input") {
      throw new SystemBootstrapInputInvalidError(bootstrap.reason)
    }
    if (bootstrap.kind === "already_initialized") {
      throw new SystemAlreadyInitializedError()
    }

    return context.json(
      {
        account_id: bootstrap.accountId,
        identity_id: bootstrap.identityId,
        root_binding_id: bootstrap.rootBindingId,
        email: bootstrap.email,
        // 初期rootはこの招待でパスキーを登録する。tokenはこの応答でだけ返す。
        passkey_enrollment: {
          token: bootstrap.enrollment.token,
          expires_at: bootstrap.enrollment.expiresAt.toISOString(),
        },
      },
      201,
    )
  },
)
