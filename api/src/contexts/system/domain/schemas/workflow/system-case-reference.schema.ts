import { z } from "zod"

const namespacedNameSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/)

export const systemCaseReferenceSchema = z
  .object({
    context: namespacedNameSchema,
    kind: namespacedNameSchema,
    id: z.string().min(1).max(512),
    version: z.string().min(1).max(255),
  })
  .strict()

export type SystemCaseReference = Readonly<z.output<typeof systemCaseReferenceSchema>>

export const proposalDigestSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .brand<"ProposalDigest">()

export type ProposalDigest = z.infer<typeof proposalDigestSchema>
