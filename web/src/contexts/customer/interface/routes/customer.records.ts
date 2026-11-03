import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { HonoEnv } from "@/bindings"
import { verifyBearer } from "@/api/http/verify-bearer"
import { prepareEmployedActor } from "@/api/http/prepare-employed-actor"
import { customerCommandSchema } from "@/contexts/customer/domain/customer-command"
import { CustomerRepository } from "@/contexts/customer/infrastructure/repositories/customer.repository"
import { catalogQuerySchema } from "@/api/http/catalog-query.schema"

const factory = createFactory<HonoEnv>()

// @authorization permission - 在籍と顧客台帳の参照権限を検査する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", catalogQuerySchema),
  async (c) => {
    const repository = new CustomerRepository(await prepareEmployedActor(c, "customer:read"))
    const query = c.req.valid("query")
    const data = await repository.list(query)
    return c.json({
      data,
      next_offset: data.length === query.limit ? query.offset + query.limit : null,
    })
  },
)

// @authorization permission - 在籍と顧客台帳の変更権限を検査する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", customerCommandSchema),
  async (c) => {
    const command = c.req.valid("json")
    const key = z.uuid().safeParse(c.req.header("idempotency-key"))
    if (!key.success) throw new HTTPException(400, { message: "UUID Idempotency-Key required" })
    const repository = new CustomerRepository(await prepareEmployedActor(c, "customer:write"))
    const result = await repository.save(command, key.data)
    if (typeof result === "string") throw new HTTPException(409, { message: result })
    return c.json(result)
  },
)
