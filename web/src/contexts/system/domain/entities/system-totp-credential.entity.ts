import { InvalidSystemTotpCredentialError } from "@system/domain/errors"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { z } from "zod"

const MAX_RECOVERY_CODES = 10

const propsSchema = z
  .object({
    accountId: zAccountId,
    secretCiphertext: z.string().min(16).max(512),
    status: z.enum(["pending", "active"]),
    lastUsedStep: z.number().int().nonnegative().nullable(),
    recoveryCodeHashes: z
      .array(z.string().regex(/^[0-9a-f]{64}$/))
      .max(MAX_RECOVERY_CODES)
      .refine((hashes) => new Set(hashes).size === hashes.length, "duplicate recovery code"),
    createdAt: z.date(),
    updatedAt: z.date(),
    enabledAt: z.date().nullable(),
  })
  .strict()

type Props = z.output<typeof propsSchema>

/**
 * Accountに1つだけ持つ、認証アプリのワンタイムコードの登録。秘密鍵は暗号文のまま持ち、
 * 復旧コードはhashだけを持つ。登録を始めた直後は `pending` で、最初のコードを確かめて `active` になる。
 *
 * 更新はいつも `updatedAt` を前へ進め、保存側はその前の値で行を条件付き更新する。
 * 同じコードや同じ復旧コードを並行するrequestで二重に使えないようにするためである。
 */
export class SystemTotpCredentialEntity {
  readonly accountId: Props["accountId"]
  readonly secretCiphertext: string
  readonly status: Props["status"]
  readonly lastUsedStep: number | null
  readonly recoveryCodeHashes: ReadonlyArray<string>
  readonly #createdAt: number
  readonly #updatedAt: number
  readonly #enabledAt: number | null

  private constructor(props: Props) {
    this.accountId = props.accountId
    this.secretCiphertext = props.secretCiphertext
    this.status = props.status
    this.lastUsedStep = props.lastUsedStep
    this.recoveryCodeHashes = Object.freeze([...props.recoveryCodeHashes])
    this.#createdAt = props.createdAt.getTime()
    this.#updatedAt = props.updatedAt.getTime()
    this.#enabledAt = props.enabledAt?.getTime() ?? null
    Object.freeze(this)
  }

  static create(input: unknown): SystemTotpCredentialEntity | InvalidSystemTotpCredentialError {
    const parsed = propsSchema.safeParse(input)
    if (!parsed.success) return new InvalidSystemTotpCredentialError("invalid_shape", parsed.error)

    const props = parsed.data
    if (props.updatedAt.getTime() < props.createdAt.getTime()) {
      return new InvalidSystemTotpCredentialError("update_before_creation")
    }
    if ((props.status === "active") !== (props.enabledAt !== null)) {
      return new InvalidSystemTotpCredentialError("invalid_shape")
    }
    if (props.status === "pending" && props.recoveryCodeHashes.length > 0) {
      return new InvalidSystemTotpCredentialError("invalid_shape")
    }

    return new SystemTotpCredentialEntity(props)
  }

  /** 登録を始める。秘密鍵を作り直すたびに新しい `pending` の登録になる。 */
  static begin(
    input: Readonly<{ accountId: unknown; secretCiphertext: string; now: Date }>,
  ): SystemTotpCredentialEntity | InvalidSystemTotpCredentialError {
    return SystemTotpCredentialEntity.create({
      accountId: input.accountId,
      secretCiphertext: input.secretCiphertext,
      status: "pending",
      lastUsedStep: null,
      recoveryCodeHashes: [],
      createdAt: input.now,
      updatedAt: input.now,
      enabledAt: null,
    })
  }

  get isActive(): boolean {
    return this.status === "active"
  }

  get createdAt(): Date {
    return new Date(this.#createdAt)
  }

  get updatedAt(): Date {
    return new Date(this.#updatedAt)
  }

  get enabledAt(): Date | null {
    return this.#enabledAt === null ? null : new Date(this.#enabledAt)
  }

  /** 最初のコードを確かめた時点で有効にし、復旧コードを持たせる。 */
  enable(
    input: Readonly<{ step: number; recoveryCodeHashes: ReadonlyArray<string>; now: Date }>,
  ): SystemTotpCredentialEntity | InvalidSystemTotpCredentialError {
    if (this.status !== "pending") return new InvalidSystemTotpCredentialError("invalid_transition")

    const updatedAt = this.nextUpdatedAt(input.now)

    return this.with({
      status: "active",
      lastUsedStep: input.step,
      recoveryCodeHashes: [...input.recoveryCodeHashes],
      updatedAt,
      enabledAt: updatedAt,
    })
  }

  /** 使ったコードの区間を記録し、それ以前の区間のコードを使えなくする。 */
  useStep(step: number, now: Date): SystemTotpCredentialEntity | InvalidSystemTotpCredentialError {
    if (!this.isActive) return new InvalidSystemTotpCredentialError("invalid_transition")
    if (this.lastUsedStep !== null && step <= this.lastUsedStep) {
      return new InvalidSystemTotpCredentialError("invalid_transition")
    }

    return this.with({ lastUsedStep: step, updatedAt: this.nextUpdatedAt(now) })
  }

  /** 復旧コードを1つ使い、一覧から消す。 */
  consumeRecoveryCode(
    hash: string,
    now: Date,
  ): SystemTotpCredentialEntity | InvalidSystemTotpCredentialError {
    if (!this.isActive || !this.recoveryCodeHashes.includes(hash)) {
      return new InvalidSystemTotpCredentialError("invalid_transition")
    }

    return this.with({
      recoveryCodeHashes: this.recoveryCodeHashes.filter((candidate) => candidate !== hash),
      updatedAt: this.nextUpdatedAt(now),
    })
  }

  /** 復旧コードをすべて新しいものへ入れ替える。古いコードはどれも使えなくなる。 */
  replaceRecoveryCodes(
    hashes: ReadonlyArray<string>,
    now: Date,
  ): SystemTotpCredentialEntity | InvalidSystemTotpCredentialError {
    if (!this.isActive) return new InvalidSystemTotpCredentialError("invalid_transition")

    return this.with({ recoveryCodeHashes: [...hashes], updatedAt: this.nextUpdatedAt(now) })
  }

  private nextUpdatedAt(now: Date): Date {
    return new Date(Math.max(this.#updatedAt + 1, now.getTime()))
  }

  private with(
    changes: Partial<Props>,
  ): SystemTotpCredentialEntity | InvalidSystemTotpCredentialError {
    return SystemTotpCredentialEntity.create({
      accountId: this.accountId,
      secretCiphertext: this.secretCiphertext,
      status: this.status,
      lastUsedStep: this.lastUsedStep,
      recoveryCodeHashes: [...this.recoveryCodeHashes],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      enabledAt: this.enabledAt,
      ...changes,
    })
  }
}
