import { SystemConnectorEntity } from "@system/domain/entities/system-connector.entity"
import type {
  SystemConnectorRepository,
  SystemConnectorWriteResult,
} from "@system/infrastructure/repositories/integration/system-connector.repository"

type Context = Readonly<{
  write: SystemConnectorRepository["write"]
}>

/** 検証済みConnector定義をidempotentに作成する。 */
export class CreateSystemConnector {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown): Promise<SystemConnectorWriteResult | Error> {
    const connector = SystemConnectorEntity.create(input)
    if (connector instanceof Error) return connector
    return this.c.write(connector)
  }
}
