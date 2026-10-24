import type { SystemClockContext, SystemD1Context } from "@system/configuration/system-context"
import { zSessionFamilyId } from "@system/domain/schemas/auth/session-family-id.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { CreateSystemBrowserLoginCodeAdapter } from "@system/infrastructure/adapters/auth/create-system-browser-login-code.adapter"
import { systemLoginCodeHash } from "@system/lib/auth/system-login-code-hash"
import { z } from "zod"

type Context = SystemClockContext & SystemD1Context

export type SystemBrowserLoginCode = Readonly<{
  code: string
  expiresInSeconds: number
}>

export type CreateSystemBrowserLoginCodeCommand = Readonly<{
  accountId: unknown
  /** 発行を求めたcredentialが検証済みのtoken version。交換時に現在値と一致しなければ拒否する。 */
  tokenVersion: unknown
  /** 発行を求めたaccess tokenのSession family。交換時に失効していれば拒否する。 */
  sessionFamilyId: unknown
}>

/**
 * 認証済みSystem Accountへ短命なbrowser login codeを発行する。
 * codeは発行元credentialのtoken versionとSession familyへ束縛し、password resetやlogoutの後に
 * 失効前のcredentialから得たcodeで新しいSessionを作れないようにする。
 */
export class CreateSystemBrowserLoginCode {
  private readonly codeTtlMilliseconds = 60_000

  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    command: CreateSystemBrowserLoginCodeCommand,
  ): Promise<SystemBrowserLoginCode | Error> {
    const now = this.c.var.now()
    const accountId = zAccountId.safeParse(command.accountId)
    const tokenVersion = z.number().int().nonnegative().safeParse(command.tokenVersion)
    const sessionFamilyId = zSessionFamilyId.nullable().safeParse(command.sessionFamilyId)
    if (
      !Number.isSafeInteger(now.getTime()) ||
      !accountId.success ||
      !tokenVersion.success ||
      !sessionFamilyId.success
    ) {
      return new Error("browser login code is unavailable")
    }

    const rawCode = crypto.randomUUID()
    const codeHash = await systemLoginCodeHash(rawCode)
    if (codeHash instanceof Error) return codeHash

    const creation = await new CreateSystemBrowserLoginCodeAdapter(
      this.c,
    ).createSystemBrowserLoginCode({
      codeHash,
      accountId: accountId.data,
      tokenVersion: tokenVersion.data,
      sessionFamilyId: sessionFamilyId.data,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.codeTtlMilliseconds),
    })
    if (creation instanceof Error) return creation

    return {
      code: rawCode,
      expiresInSeconds: this.codeTtlMilliseconds / 1_000,
    }
  }
}
