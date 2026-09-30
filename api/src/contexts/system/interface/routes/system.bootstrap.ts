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
import { hashPassword } from "@system/lib/auth/hash-password"
import { timingSafeStringEqual } from "@system/lib/auth/timing-safe-string-equal"
import { D1SystemRootBootstrapAdapter } from "@system/infrastructure/adapters/iam/d1-system-root-bootstrap.adapter"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization public - single-use secretと永続bootstrap stateで初期root作成だけを許す
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
        password: z.string().min(12).max(200),
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
    const pepper = context.env.PEPPER_SECRET
    if (pepper === undefined || pepper.length === 0) {
      throw new SystemBootstrapUnavailableError()
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemBootstrapUnavailableError()
    }
    const bootstrap = await new BootstrapSystemRoot({
      passwordHasher: {
        hash: (password) =>
          hashPassword(password, pepper).catch((caught: unknown) =>
            caught instanceof Error ? caught : new Error("failed to hash System password"),
          ),
      },
      repository: new D1SystemRootBootstrapAdapter({ env: { DB: context.env.DB } }),
    }).execute({ email: body.email, password: body.password, now })
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
      },
      201,
    )
  },
)
