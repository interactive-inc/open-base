import { z } from "zod"

const namespacedVocabularyPattern =
  /^[a-z][a-z0-9_-]{0,62}:[a-z][a-z0-9_-]*(?:[.:][a-z][a-z0-9_-]*)*$/u

export const notificationMessageIdSchema = z.uuid().brand<"NotificationMessageId">()
export type NotificationMessageId = z.infer<typeof notificationMessageIdSchema>

export const notificationKindSchema = z.string().min(3).max(100).regex(namespacedVocabularyPattern)

export const notificationSourceReferenceSchema = z
  .object({
    type: notificationKindSchema,
    id: z.string().min(1).max(512),
  })
  .strict()
export type NotificationSourceReference = Readonly<
  z.output<typeof notificationSourceReferenceSchema>
>
