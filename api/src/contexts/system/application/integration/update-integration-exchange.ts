import type { IntegrationExchangeEntity } from "@system/domain/entities/integration-exchange.entity"
import type {
  SystemIntegrationExchangeRepository,
  SystemIntegrationExchangeWriteResult,
} from "@system/infrastructure/repositories/integration/system-integration-exchange.repository"

type Context = Readonly<{
  find: SystemIntegrationExchangeRepository["find"]
  write: SystemIntegrationExchangeRepository["write"]
}>

type Command = Readonly<{
  id: string
  status: IntegrationExchangeEntity["status"]
  at: Date
  externalReference: string | null
  errorCode: string | null
}>

/** 外部交換を成功・失敗・取消・retryへ楽観的に更新する。 */
export class UpdateIntegrationExchange {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command): Promise<SystemIntegrationExchangeWriteResult | Error | null> {
    const current = await this.c.find(command.id)
    if (current === null || current instanceof Error) return current
    const updated = current.transition(command.status, command.at, {
      externalReference: command.externalReference,
      errorCode: command.errorCode,
    })
    if (updated instanceof Error) return updated
    return this.c.write(updated, current.updatedAt)
  }
}
