import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { InvalidNotificationDeliveryError } from "@system/domain/errors"
import {
  notificationDeliveryIdSchema,
  type NotificationDeliveryId,
} from "@system/domain/schemas/notifications/notification-delivery-id.schema"
import {
  notificationMessageIdSchema,
  type NotificationMessageId,
} from "@system/domain/schemas/notifications/notification-reference.schema"
import { z } from "zod"

const propsSchema = z
  .object({
    id: notificationDeliveryIdSchema,
    messageId: notificationMessageIdSchema,
    recipientAccountId: zAccountId,
    deliveredAt: z.date(),
    readAt: z.date().nullable(),
    dismissedAt: z.date().nullable(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

/** concreteなAccount宛ての配信と単調な既読・非表示状態だけを所有するSystem receipt。 */
export class NotificationDeliveryEntity {
  readonly id: NotificationDeliveryId
  readonly messageId: NotificationMessageId
  readonly recipientAccountId: AccountId
  readonly #deliveredAtEpochMilliseconds: number
  readonly #readAtEpochMilliseconds: number | null
  readonly #dismissedAtEpochMilliseconds: number | null

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.messageId = props.messageId
    this.recipientAccountId = props.recipientAccountId
    this.#deliveredAtEpochMilliseconds = props.deliveredAt.getTime()
    this.#readAtEpochMilliseconds = props.readAt?.getTime() ?? null
    this.#dismissedAtEpochMilliseconds = props.dismissedAt?.getTime() ?? null
    Object.freeze(this)
  }

  static create(input: unknown): NotificationDeliveryEntity | InvalidNotificationDeliveryError {
    const parsed = propsSchema.safeParse(input)

    if (!parsed.success) {
      return new InvalidNotificationDeliveryError("invalid_shape", parsed.error)
    }
    if (
      parsed.data.readAt !== null &&
      parsed.data.readAt.getTime() < parsed.data.deliveredAt.getTime()
    ) {
      return new InvalidNotificationDeliveryError("read_before_delivery")
    }
    if (
      parsed.data.dismissedAt !== null &&
      parsed.data.dismissedAt.getTime() < parsed.data.deliveredAt.getTime()
    ) {
      return new InvalidNotificationDeliveryError("dismiss_before_delivery")
    }

    return new NotificationDeliveryEntity(parsed.data)
  }

  get deliveredAt(): Date {
    return new Date(this.#deliveredAtEpochMilliseconds)
  }

  get readAt(): Date | null {
    return this.#readAtEpochMilliseconds === null ? null : new Date(this.#readAtEpochMilliseconds)
  }

  get isRead(): boolean {
    return this.#readAtEpochMilliseconds !== null
  }

  get dismissedAt(): Date | null {
    return this.#dismissedAtEpochMilliseconds === null
      ? null
      : new Date(this.#dismissedAtEpochMilliseconds)
  }

  get isDismissed(): boolean {
    return this.#dismissedAtEpochMilliseconds !== null
  }

  markRead(at: unknown): NotificationDeliveryEntity | InvalidNotificationDeliveryError {
    const parsedAt = z.date().safeParse(at)

    if (!parsedAt.success) {
      return new InvalidNotificationDeliveryError("invalid_shape", parsedAt.error)
    }

    const atEpochMilliseconds = parsedAt.data.getTime()

    if (this.isDismissed) return new InvalidNotificationDeliveryError("dismissed")

    if (
      this.#readAtEpochMilliseconds !== null &&
      atEpochMilliseconds < this.#readAtEpochMilliseconds
    ) {
      return new InvalidNotificationDeliveryError("transition_before_last_update")
    }
    if (this.#readAtEpochMilliseconds !== null) return this

    return NotificationDeliveryEntity.create({ ...this.toProps(), readAt: parsedAt.data })
  }

  dismiss(at: unknown): NotificationDeliveryEntity | InvalidNotificationDeliveryError {
    const parsedAt = z.date().safeParse(at)
    if (!parsedAt.success)
      return new InvalidNotificationDeliveryError("invalid_shape", parsedAt.error)
    if (this.isDismissed) return this
    if (parsedAt.data.getTime() < this.#deliveredAtEpochMilliseconds) {
      return new InvalidNotificationDeliveryError("dismiss_before_delivery")
    }
    return NotificationDeliveryEntity.create({ ...this.toProps(), dismissedAt: parsedAt.data })
  }

  private toProps(): ParsedProps {
    return {
      id: this.id,
      messageId: this.messageId,
      recipientAccountId: this.recipientAccountId,
      deliveredAt: this.deliveredAt,
      readAt: this.readAt,
      dismissedAt: this.dismissedAt,
    }
  }
}
