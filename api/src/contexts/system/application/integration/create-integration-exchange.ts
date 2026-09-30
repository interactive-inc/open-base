import { IntegrationExchangeEntity } from "@system/domain/entities/integration-exchange.entity"
import type {
  SystemIntegrationExchangeRepository,
  SystemIntegrationExchangeWriteResult,
} from "@system/infrastructure/repositories/integration/system-integration-exchange.repository"

type Context = Readonly<{
  write: SystemIntegrationExchangeRepository["write"]
}>

/** 外部交換をpayload digestとidempotency keyで開始する。 */
export class CreateIntegrationExchange {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown): Promise<SystemIntegrationExchangeWriteResult | Error> {
    const exchange = IntegrationExchangeEntity.create(input)
    if (exchange instanceof Error) return exchange
    if (exchange.status !== "pending" || exchange.attempt !== 1) {
      return new Error("new integration exchange must be pending")
    }
    return this.c.write(exchange, null)
  }
}
