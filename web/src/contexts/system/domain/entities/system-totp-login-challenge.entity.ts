import { InvalidSystemTotpLoginChallengeError } from "@system/domain/errors"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { z } from "zod"

/** challenge の有効期間。パスワードを確かめてから、認証アプリを開いてコードを打つまでの時間を見込む。 */
const TTL_SECONDS = 5 * 60
/** 1 つの challenge で受け付ける誤りの回数。超えたらパスワードからやり直させる。 */
const MAX_FAILED_ATTEMPTS = 5

const propsSchema = z
  .object({
    challengeHash: z.string().regex(/^[0-9a-f]{64}$/),
    accountId: zAccountId,
    tokenVersion: z.number().int().nonnegative(),
    failedAttempts: z.number().int().nonnegative(),
    createdAt: z.date(),
    expiresAt: z.date(),
  })
  .strict()

type Props = z.output<typeof propsSchema>

/**
 * パスワードを確かめた Account が、ワンタイムコードを入力するまでの短命の challenge。
 * 生の値は持たず hash だけを持つ。発行時の失効世代（tokenVersion）へ結び付け、その間に
 * パスワードの再設定などで世代が進めば使えない。
 */
export class SystemTotpLoginChallengeEntity {
  static readonly TTL_SECONDS = TTL_SECONDS
  static readonly MAX_FAILED_ATTEMPTS = MAX_FAILED_ATTEMPTS

  readonly challengeHash: string
  readonly accountId: Props["accountId"]
  readonly tokenVersion: number
  readonly failedAttempts: number
  readonly #createdAt: number
  readonly #expiresAt: number

  private constructor(props: Props) {
    this.challengeHash = props.challengeHash
    this.accountId = props.accountId
    this.tokenVersion = props.tokenVersion
    this.failedAttempts = props.failedAttempts
    this.#createdAt = props.createdAt.getTime()
    this.#expiresAt = props.expiresAt.getTime()
    Object.freeze(this)
  }

  static create(
    input: unknown,
  ): SystemTotpLoginChallengeEntity | InvalidSystemTotpLoginChallengeError {
    const parsed = propsSchema.safeParse(input)
    if (!parsed.success) {
      return new InvalidSystemTotpLoginChallengeError("invalid_shape", parsed.error)
    }
    if (parsed.data.expiresAt.getTime() <= parsed.data.createdAt.getTime()) {
      return new InvalidSystemTotpLoginChallengeError("expiry_before_creation")
    }

    return new SystemTotpLoginChallengeEntity(parsed.data)
  }

  /** 新しい challenge を発行する。期限は発行から一定時間で、誤りの回数は 0 から数える。 */
  static issue(
    input: Readonly<{
      challengeHash: string
      accountId: unknown
      tokenVersion: number
      now: Date
    }>,
  ): SystemTotpLoginChallengeEntity | InvalidSystemTotpLoginChallengeError {
    return SystemTotpLoginChallengeEntity.create({
      challengeHash: input.challengeHash,
      accountId: input.accountId,
      tokenVersion: input.tokenVersion,
      failedAttempts: 0,
      createdAt: input.now,
      expiresAt: new Date(input.now.getTime() + TTL_SECONDS * 1_000),
    })
  }

  get createdAt(): Date {
    return new Date(this.#createdAt)
  }

  get expiresAt(): Date {
    return new Date(this.#expiresAt)
  }

  /** 期限内で、誤りの回数が上限に達していなければコードを受け付ける。 */
  acceptsCodeAt(now: Date): boolean {
    return now.getTime() < this.#expiresAt && this.failedAttempts < MAX_FAILED_ATTEMPTS
  }
}
