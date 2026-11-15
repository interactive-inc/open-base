import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { factory } from "@/factory"
import { UsageError } from "@/lib/errors"
import { uploadAttachment } from "@/lib/http/upload-attachment"

export const help = `base attachments upload --file <path>

ファイルを暗号化して預け、業務の操作に渡す添付の id を表示します（pdf、jpg、jpeg、png、heic）。`

export default factory.createHandlers(
  zValidator(
    "json",
    z.strictObject({ help: z.string().optional(), file: z.string().min(1).optional() }),
  ),
  async (c) => {
    const flags = c.req.valid("json")
    if (flags.help !== undefined) return c.text(help)
    if (flags.file === undefined) throw new UsageError("--file に預けるファイルを指定してください")

    return c.json({ id: await uploadAttachment(flags.file) })
  },
)
