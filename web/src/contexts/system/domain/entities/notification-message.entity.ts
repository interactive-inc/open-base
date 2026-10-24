import { InvalidNotificationMessageError } from "@system/domain/errors"
import {
  notificationKindSchema,
  notificationMessageIdSchema,
  notificationSourceReferenceSchema,
  type NotificationMessageId,
  type NotificationSourceReference,
} from "@system/domain/schemas/notifications/notification-reference.schema"
import { z } from "zod"

function hasTitleControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0)

    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)
  })
}

function hasBodyControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0)

    return (
      codePoint !== undefined &&
      (codePoint <= 0x08 ||
        codePoint === 0x0b ||
        codePoint === 0x0c ||
        (codePoint >= 0x0e && codePoint <= 0x1f) ||
        codePoint === 0x7f)
    )
  })
}

const titleSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((title) => title.trim().length > 0)
  .refine((title) => !hasTitleControlCharacter(title))

const bodySchema = z
  .string()
  .min(1)
  .max(10_000)
  .refine((body) => body.trim().length > 0)
  .refine((body) => !hasBodyControlCharacter(body))

const propsSchema = z
  .object({
    id: notificationMessageIdSchema,
    kind: notificationKindSchema,
    title: titleSchema,
    body: bodySchema.nullable(),
    source: notificationSourceReferenceSchema.nullable(),
    action: notificationSourceReferenceSchema.nullable().optional(),
    resourceScope: notificationSourceReferenceSchema.nullable().optional(),
    priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
    publicationKey: z.string().min(1).max(512).nullable().optional(),
    createdAt: z.date(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

/**
 * 受信者と既読状態を所有しないimmutableなSystem通知本文。
 * titleとbodyはpresentation層がmarkupとして解釈せずplain textとして表示する。
 */
export class NotificationMessageEntity {
  readonly id: NotificationMessageId
  readonly kind: string
  readonly title: string
  readonly body: string | null
  readonly source: NotificationSourceReference | null
  readonly action: NotificationSourceReference | null
  readonly resourceScope: NotificationSourceReference | null
  readonly priority: "low" | "normal" | "high" | "critical"
  readonly publicationKey: string | null
  readonly #createdAtEpochMilliseconds: number

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.kind = props.kind
    this.title = props.title
    this.body = props.body
    this.source =
      props.source === null ? null : Object.freeze({ type: props.source.type, id: props.source.id })
    this.action =
      props.action == null ? null : Object.freeze({ type: props.action.type, id: props.action.id })
    this.resourceScope =
      props.resourceScope == null
        ? null
        : Object.freeze({ type: props.resourceScope.type, id: props.resourceScope.id })
    this.priority = props.priority
    this.publicationKey = props.publicationKey ?? null
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    Object.freeze(this)
  }

  static create(input: unknown): NotificationMessageEntity | InvalidNotificationMessageError {
    const parsed = propsSchema.safeParse(input)

    return parsed.success
      ? new NotificationMessageEntity(parsed.data)
      : new InvalidNotificationMessageError("invalid_shape", parsed.error)
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }
}
