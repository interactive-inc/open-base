import { LoginRateLimitAdapter } from "@system/infrastructure/adapters/auth/login-rate-limit.adapter"
import { LoginRateLimitKeyValue } from "@system/domain/values/auth/login-rate-limit-key.value"
import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"

type Props = Readonly<{
  email: string
  clientIp: string | null
}>

type Context = SystemDatabaseContext & SystemClockContext

/** パスワード再設定要求を受け付ける。 */
export class AcceptPasswordResetRequest {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(props: Props): Promise<boolean> {
    const rateLimitKey = LoginRateLimitKeyValue.login(props.clientIp, props.email).toString()
    const rateLimit = new LoginRateLimitAdapter(this.c)

    if (await rateLimit.isLimited({ key: rateLimitKey })) {
      return false
    }

    await rateLimit.record({ key: rateLimitKey })

    return true
  }
}
