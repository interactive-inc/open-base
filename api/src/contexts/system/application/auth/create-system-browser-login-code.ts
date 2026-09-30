import type { SystemClockContext, SystemD1Context } from "@system/configuration/system-context"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { CreateSystemBrowserLoginCodeAdapter } from "@system/infrastructure/adapters/auth/create-system-browser-login-code.adapter"
import { systemLoginCodeHash } from "@system/lib/auth/system-login-code-hash"

type Context = SystemClockContext & SystemD1Context

export type SystemBrowserLoginCode = Readonly<{
  code: string
  expiresInSeconds: number
}>

/** 認証済みSystem Accountへ短命なbrowser login codeを発行する。 */
export class CreateSystemBrowserLoginCode {
  private readonly codeTtlMilliseconds = 60_000

  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(rawAccountId: unknown): Promise<SystemBrowserLoginCode | Error> {
    const now = this.c.var.now()
    const accountId = zAccountId.safeParse(rawAccountId)
    if (!Number.isSafeInteger(now.getTime()) || !accountId.success) {
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
