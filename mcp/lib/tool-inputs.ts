import { isAbsolute } from "node:path"
import { z } from "zod"

/**
 * 高リスク操作の直前の本人確認。MCPは発行せず、人がCLIで取ったトークンだけを受け取る。
 * パスワードやIdPのトークンをMCPへ渡させない。
 */
export const stepUpToken = z
  .string()
  .regex(/^[0-9a-f]{64}$/)
  .describe(
    "Step-up token a person obtained with `base step-up` in the CLI (64 lowercase hex characters, valid for 5 minutes). This server never issues it.",
  )

/** 説明の末尾に付ける、step-up が要るツールの注意。 */
export const stepUpNote =
  "Requires step_up_token: a person runs `base step-up` in the CLI and passes the printed token."

/** 書き込みの説明の末尾に付ける注意。 */
export const intentNote = "Requires explicit user intent."

/** Company正本の会社ID。`x-company-organization-id` で送る。 */
export const organizationId = z
  .string()
  .regex(/^\S{1,255}$/)
  .describe("Company organization ID (x-company-organization-id)")

/** Companyの書き込みが前提にする会社版。`if-match` で送る。 */
export const expectedRevision = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER - 1)
  .describe("Company organization revision you read before writing (sent as if-match)")

/** 同じ依頼の再送に使う鍵。 */
export const idempotencyKey = z
  .string()
  .regex(/^\S{1,255}$/)
  .describe("Reuse the same key when retrying the same request")

/** `/` や `.` だけの値で別の経路へ届かないpath segment。 */
export const pathId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:~-]{0,254}$/)

/** 本体をMCP hostのマシンへ書き出す先。既存のファイルは上書きしない。 */
export const outputPath = z
  .string()
  .min(1)
  .refine(isAbsolute, "output_path must be absolute")
  .describe(
    "Absolute path on the machine running this MCP server to write the content to. Existing files are not overwritten.",
  )

/** API側で正当性を確かめる、出典の参照。 */
export const evidenceReference = z.strictObject({
  context: z.string().trim().min(1).max(100),
  kind: z.string().trim().min(1).max(100),
  id: z.string().trim().min(1).max(512),
  version: z.string().trim().min(1).max(255),
})

/** 数字だけの問い合わせ値（APIは文字列で受ける）。 */
export const numericText = z.union([
  z.number().int().nonnegative(),
  z.string().regex(/^(0|[1-9]\d*)$/),
])
