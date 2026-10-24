import { InvalidSystemIntegrationError } from "@system/domain/errors"
import { z } from "zod"

const connectorPropsSchema = z
  .object({
    id: z.string().regex(/^\S{1,255}$/),
    key: z.string().regex(/^[a-z][a-z0-9_-]{0,62}$/u),
    name: z.string().trim().min(1).max(200),
    direction: z.enum(["inbound", "outbound", "bidirectional"]),
    transport: z.enum(["api", "file", "webhook"]),
    status: z.enum(["active", "disabled"]),
    revision: z.number().int().min(1),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .strict()

type ConnectorProps = z.output<typeof connectorPropsSchema>

/** 外部境界の主体とtransportをsecretから分離して管理するSystem Connector。 */
export class SystemConnectorEntity {
  readonly id: string
  readonly key: string
  readonly name: string
  readonly direction: ConnectorProps["direction"]
  readonly transport: ConnectorProps["transport"]
  readonly status: ConnectorProps["status"]
  readonly revision: number
  readonly #createdAtEpochMilliseconds: number
  readonly #updatedAtEpochMilliseconds: number

  private constructor(props: ConnectorProps) {
    this.id = props.id
    this.key = props.key
    this.name = props.name
    this.direction = props.direction
    this.transport = props.transport
    this.status = props.status
    this.revision = props.revision
    this.#createdAtEpochMilliseconds = props.createdAt.getTime()
    this.#updatedAtEpochMilliseconds = props.updatedAt.getTime()
    Object.freeze(this)
  }

  static create(input: unknown): SystemConnectorEntity | InvalidSystemIntegrationError {
    const parsed = connectorPropsSchema.safeParse(input)
    if (!parsed.success) return new InvalidSystemIntegrationError("invalid_shape", parsed.error)
    if (parsed.data.updatedAt.getTime() < parsed.data.createdAt.getTime()) {
      return new InvalidSystemIntegrationError("update_before_creation")
    }
    return new SystemConnectorEntity(parsed.data)
  }

  get createdAt(): Date {
    return new Date(this.#createdAtEpochMilliseconds)
  }

  get updatedAt(): Date {
    return new Date(this.#updatedAtEpochMilliseconds)
  }

  revise(
    input: Readonly<{ name: string; status: ConnectorProps["status"]; at: Date }>,
  ): SystemConnectorEntity | InvalidSystemIntegrationError {
    if (input.at.getTime() < this.#updatedAtEpochMilliseconds) {
      return new InvalidSystemIntegrationError("update_before_last_update")
    }
    return SystemConnectorEntity.create({
      id: this.id,
      key: this.key,
      name: input.name,
      direction: this.direction,
      transport: this.transport,
      status: input.status,
      revision: this.revision + 1,
      createdAt: this.createdAt,
      updatedAt: input.at,
    })
  }
}
