import { z } from "zod"

export const zAppValidationIssue = z
  .object({
    code: z.string(),
    path: z.array(z.union([z.string(), z.number()])),
    message: z.string(),
    reason: z.string().optional(),
    expected: z.unknown().optional(),
    values: z.unknown().optional(),
    minimum: z.unknown().optional(),
    maximum: z.unknown().optional(),
    format: z.unknown().optional(),
    origin: z.unknown().optional(),
    keys: z.unknown().optional(),
  })
  .loose()

export const zAppStructuredValidationError = z.object({
  error: z.enum(["invalid_body", "invalid_query", "invalid_fields", "invalid_input"]),
  issues: z.array(zAppValidationIssue).optional(),
})

export const zAppDefaultZodValidationError = z.object({
  success: z.literal(false),
  error: z
    .object({
      name: z.literal("ZodError"),
      message: z.string(),
      issues: z.array(zAppValidationIssue).optional(),
    })
    .loose(),
})

export const zAppErrorPayload = z.object({
  error: z.string(),
  message: z.string().optional(),
})

export type AppValidationIssue = z.infer<typeof zAppValidationIssue>

export type AppValidationErrorBody = {
  error: "invalid_input"
  message: string
  issues: ReadonlyArray<AppValidationIssue>
}
