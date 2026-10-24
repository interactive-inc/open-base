import { systemAttachmentSchema } from "@system/infrastructure/schema/system-attachment"
import { drizzle } from "drizzle-orm/d1"

/** 添付の保存口へ渡すdatabaseを、System添付のschemaで開く。 */
export function openSystemAttachmentDatabase(database: D1Database) {
  return drizzle(database, { schema: systemAttachmentSchema })
}
