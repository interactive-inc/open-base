import type { SystemClockContext, SystemD1Context } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { zSessionFamilyId } from "@system/domain/schemas/auth/session-family-id.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { CreateSystemBrowserLoginCodeAdapter } from "@system/infrastructure/adapters/auth/create-system-browser-login-code.adapter"
import { systemBrowserLoginCodeHash } from "@system/lib/auth/system-browser-login-code-hash"
import { z } from "zod"

type Context = SystemClockContext & SystemD1Context

export type SystemBrowserLoginCodeRequest = Readonly<{
  /** 発行を求めた認証。codeはこの認証のtoken versionへ束縛し、交換時に現在値と一致しなければ拒否する。 */
  authentication: SystemReadAuthentication
  /** 発行を求めたaccess tokenのSession family。交換時に失効していれば拒否する。 */
  sessionFamilyId: unknown
}>

export type SystemBrowserLoginCode = Readonly<{
  code: string
  expiresInSeconds: number
}>

/**
 * 認証済みSystem Accountへ短命なbrowser login codeを発行する。
 * 入口で受け付けた認証の世代と発行元が保存の時点で失効していれば、コードを保存せず null を返す。
 * codeは発行元credentialのtoken versionとSession familyへ束縛し、password resetやlogoutの後に
 * 失効前のcredentialから得たcodeで新しいSessionを作れないようにする。
 * 人のSessionだけを発行元とし、機械資格や外部Identityの認証を独立したbrowser Sessionへ変換しない。
 * 交換後も同じfamilyと認証時刻を引き継ぐ。
 */
export class CreateSystemBrowserLoginCode {
  private readonly codeTtlMilliseconds = 60_000

  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    request: SystemBrowserLoginCodeRequest,
  ): Promise<SystemBrowserLoginCode | null | Error> {
    const now = this.c.var.now()
    const accountId = zAccountId.safeParse(request.authentication.accountId)
    const tokenVersion = z
      .number()
      .int()
      .nonnegative()
      .safeParse(request.authentication.tokenVersion)
    const sessionFamilyId = zSessionFamilyId.nullable().safeParse(request.sessionFamilyId)
    if (
      !Number.isSafeInteger(now.getTime()) ||
      !accountId.success ||
      !tokenVersion.success ||
      !sessionFamilyId.success
    ) {
      return new Error("browser login code is unavailable")
    }
    if (
      request.authentication.machineCredentialId !== null ||
      request.authentication.identityBindingId !== null ||
      sessionFamilyId.data === null ||
      sessionFamilyId.data !== request.authentication.sessionFamilyId
    )
      return null

    const rawCode = crypto.randomUUID()
    const codeHash = await systemBrowserLoginCodeHash(rawCode)
    if (codeHash instanceof Error) return codeHash

    const creation = await new CreateSystemBrowserLoginCodeAdapter(
      this.c,
    ).createSystemBrowserLoginCode({
      codeHash,
      origin: {
        accountId: accountId.data,
        tokenVersion: tokenVersion.data,
        sessionFamilyId: sessionFamilyId.data,
        machineCredentialId: request.authentication.machineCredentialId,
        identityBindingId: request.authentication.identityBindingId,
      },
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.codeTtlMilliseconds),
    })
    if (creation instanceof Error) return creation

    if (creation === "rejected") return null

    return {
      code: rawCode,
      expiresInSeconds: this.codeTtlMilliseconds / 1_000,
    }
  }
}
