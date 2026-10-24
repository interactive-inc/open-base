import { z } from "zod"

export const notificationDeliveryIdSchema = z.uuid().brand<"NotificationDeliveryId">()
export type NotificationDeliveryId = z.infer<typeof notificationDeliveryIdSchema>
