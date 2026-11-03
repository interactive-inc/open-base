import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { HonoEnv } from "@/bindings"
import { verifyBearer } from "@/api/http/verify-bearer"
import {
  clientProjectCommandSchema,
  recordKinds,
} from "@/contexts/client-project/domain/client-project-command"
import { ClientProjectError } from "@/contexts/client-project/domain/errors"
import { prepareEmployedActor } from "@/api/http/prepare-employed-actor"
import { ClientProjectRepository } from "@/contexts/client-project/infrastructure/repositories/client-project.repository"

const factory = createFactory<HonoEnv>()
const querySchema = z
  .strictObject({
    kind: z.enum(recordKinds),
    id: z.uuid().optional(),
    project_id: z.uuid().optional(),
    customer_id: z.uuid().optional(),
    search: z.string().trim().min(1).max(200).optional(),
    history: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    offset: z.coerce.number().int().min(0).max(100000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((query) => !query.history || query.id !== undefined)
  .refine((query) => query.project_id === undefined || query.kind === "effort")
  .refine((query) => query.customer_id === undefined || query.kind === "project")
  .refine((query) => query.search === undefined || query.kind !== "effort")

// @authorization permission - 現在在籍しクライアント案件の全件参照権限を持つ本人に限る
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", querySchema),
  async (c) => {
    const repository = new ClientProjectRepository(
      await prepareEmployedActor(c, "client_project:read"),
    )
    const query = c.req.valid("query")
    const data = await repository.list(query)
    return c.json({
      data,
      next_offset: data.length === query.limit ? query.offset + query.limit : null,
    })
  },
)

// @authorization permission - 現在の在籍と操作権限を検査し、工数の変更は記録本人に限る
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", clientProjectCommandSchema),
  async (c) => {
    const command = c.req.valid("json")
    const key = z.uuid().safeParse(c.req.header("idempotency-key"))
    if (!key.success) throw new HTTPException(400, { message: "UUID Idempotency-Key required" })
    const permission = command.kind === "effort" ? "client_project:record" : "client_project:write"
    const repository = new ClientProjectRepository(await prepareEmployedActor(c, permission))
    try {
      return c.json(await repository.save(command, key.data))
    } catch (error) {
      if (error instanceof ClientProjectError)
        throw new HTTPException(error.status, { message: error.message })
      throw error
    }
  },
)
