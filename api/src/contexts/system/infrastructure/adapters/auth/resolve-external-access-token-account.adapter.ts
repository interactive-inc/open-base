import { hasExternalAccessTokenHeader } from "@system/lib/auth/has-external-access-token-header"
import type {
  SystemD1Context,
  SystemExternalIdentityContext,
} from "@system/configuration/system-context"
import { ExternalAccessTokenVerificationKeyAdapter } from "@system/infrastructure/adapters/auth/external-access-token-verification-key.adapter"
import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"
import { SystemIdentityLoginAdapter } from "@system/infrastructure/adapters/auth/system-identity-login.adapter"
import { errors, jwtVerify, type JWTPayload } from "jose"
import { z } from "zod"

type Bindings = (SystemD1Context & SystemExternalIdentityContext)["env"]

/**
 * 外部access tokenを受け取る入口。HTTP APIの `api` と、同じaccountのWorkerから
 * Service Binding RPCで呼ばれる `service_binding` は、audと必須claimを分けて検証する。
 */
export type ExternalAccessTokenPurpose = "api" | "service_binding"

const serviceBindingClaimsSchema = z.object({
  sub: identitySubjectSchema,
  client_id: z.string().min(1).max(200),
  scope: z.string().min(1).max(2_000),
  iat: z.number().int(),
  exp: z.number().int(),
  jti: z.string().min(1).max(512),
})

const apiClaimsSchema = serviceBindingClaimsSchema.extend({
  email: z.string().email().max(254),
  email_verified: z.literal(true),
  name: z.string().min(1).max(200),
})

export type ExternalAccessTokenAccountResolution =
  | Readonly<{ kind: "not_external" }>
  | Readonly<{
      kind: "accepted"
      accountId: string
      tokenVersion: number
      identityBindingId: string
      issuedAtMs: number
      expiresAtMs: number
    }>
  | Readonly<{ kind: "rejected" }>
  | Readonly<{ kind: "unavailable" }>

type Acceptance = Readonly<{
  issuer: string
  audience: string
  /** もう一方の入口のaud。tokenのaudに含まれていれば拒否する。 */
  foreignAudience: string | null
  claimsSchema: z.ZodType<z.output<typeof serviceBindingClaimsSchema>>
  /** trueなら、audは単一値でなければならない。 */
  singleAudience: boolean
  /** trueなら、委任・交換を表す `act` claimを持つtokenを拒否する。 */
  rejectsActor: boolean
  /** trueなら、検証鍵の取得失敗をtokenの拒否ではなくunavailableとして返す。 */
  reportsKeyFetchFailure: boolean
}>

function configured(value: string | undefined): string | null {
  return value !== undefined && value.length > 0 ? value : null
}

function readAcceptance(env: Bindings, purpose: ExternalAccessTokenPurpose): Acceptance | null {
  const issuer = configured(env.IDENTITY_ACCESS_TOKEN_ISSUER ?? env.IDENTITY_ISSUER)
  const apiAudience = configured(env.IDENTITY_ACCESS_TOKEN_AUDIENCE)
  const serviceBindingAudience = configured(env.SERVICE_BINDING_ACCESS_TOKEN_AUDIENCE)
  if (issuer === null) return null
  // 二つの入口が同じaudを共有すると、片方向けのtokenがもう片方でも通る。設定誤りとして両方で拒否する。
  if (apiAudience !== null && apiAudience === serviceBindingAudience) return null

  if (purpose === "api") {
    if (apiAudience === null) return null
    return {
      issuer,
      audience: apiAudience,
      foreignAudience: serviceBindingAudience,
      claimsSchema: apiClaimsSchema,
      singleAudience: false,
      rejectsActor: false,
      reportsKeyFetchFailure: false,
    }
  }

  // 外部IdPのログイン用tokenと同じaudなら、ログイン用tokenをRPCへ流用できる。設定誤りとして拒否する。
  if (
    serviceBindingAudience === null ||
    serviceBindingAudience === configured(env.IDENTITY_AUDIENCE)
  ) {
    return null
  }
  return {
    issuer,
    audience: serviceBindingAudience,
    foreignAudience: apiAudience,
    claimsSchema: serviceBindingClaimsSchema,
    singleAudience: true,
    rejectsActor: true,
    reportsKeyFetchFailure: true,
  }
}

function hasAcceptableAudience(payload: JWTPayload, acceptance: Acceptance): boolean {
  const audiences = typeof payload.aud === "string" ? [payload.aud] : (payload.aud ?? [])
  if (acceptance.foreignAudience !== null && audiences.includes(acceptance.foreignAudience)) {
    return false
  }

  return !acceptance.singleAudience || audiences.length === 1
}

/** remote JWKSの取得失敗か。署名・claimの不正はjoseの個別errorになり、ここには含めない。 */
function isKeyFetchFailure(caught: unknown): boolean {
  return (
    !(caught instanceof errors.JOSEError) ||
    caught instanceof errors.JWKSTimeout ||
    caught instanceof errors.JWKSInvalid ||
    caught.code === "ERR_JOSE_GENERIC"
  )
}

/** 外部IdPのaccess tokenを、入口ごとのaudと必須claimで検証して既存のSystem Accountへ解決する。 */
type Context = Readonly<{ env: Bindings; purpose: ExternalAccessTokenPurpose }>
export class ResolveExternalAccessTokenAccountAdapter {
  constructor(private readonly c: Context) {}
  async resolve(input: {
    token: string
    now: Date
  }): Promise<ExternalAccessTokenAccountResolution> {
    const props = { ...input, env: this.c.env }
    if (!hasExternalAccessTokenHeader(props.token)) return { kind: "not_external" }

    const acceptance = readAcceptance(props.env, this.c.purpose)
    if (acceptance === null) return { kind: "rejected" }

    const verificationKey = await new ExternalAccessTokenVerificationKeyAdapter({
      issuer: acceptance.issuer,
      jwks: props.env.IDENTITY_JWKS,
    }).resolve()
    if (verificationKey instanceof Error) return { kind: "unavailable" }

    try {
      const verified = await jwtVerify(props.token, verificationKey, {
        algorithms: ["EdDSA"],
        issuer: acceptance.issuer,
        audience: acceptance.audience,
        typ: "at+jwt",
        requiredClaims: ["sub", "iat", "exp", "jti", "client_id", "scope"],
        currentDate: props.now,
        clockTolerance: 5,
      })
      if (!hasAcceptableAudience(verified.payload, acceptance)) return { kind: "rejected" }
      if (acceptance.rejectsActor && verified.payload.act !== undefined) {
        return { kind: "rejected" }
      }
      const claims = acceptance.claimsSchema.safeParse(verified.payload)
      if (!claims.success || claims.data.exp <= claims.data.iat) return { kind: "rejected" }

      const login = await new SystemIdentityLoginAdapter({ env: { DB: props.env.DB } }).find(
        "oidc",
        claims.data.sub,
      )
      if (login instanceof Error) return { kind: "unavailable" }
      if (login === null || login.account.status !== "active") return { kind: "rejected" }

      return {
        kind: "accepted",
        accountId: login.account.id,
        tokenVersion: login.account.tokenVersion,
        identityBindingId: login.identity.id,
        issuedAtMs: claims.data.iat * 1000,
        expiresAtMs: claims.data.exp * 1000,
      }
    } catch (caught) {
      if (acceptance.reportsKeyFetchFailure && isKeyFetchFailure(caught)) {
        return { kind: "unavailable" }
      }
      return { kind: "rejected" }
    }
  }
}
