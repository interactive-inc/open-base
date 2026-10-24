/**
 * System の運用 route（/system/principals、/system/connectors 等）が返す形。
 * api と疎結合に保つため z.infer を参照せず同形を手書きする。
 *
 * System の GET は応答の作り方が route ごとに違うので、key の綴りをここで揃えない。
 * Principal・machine credential・delivery は `*Response` mapper を通るので snake_case、
 * dead letter は mapper を通さず view をそのまま返すので camelCase、
 * connector と exchange は entity をそのまま返すので camelCase で時刻を持たない
 * （時刻は entity の private field と getter にあり JSON へ出ない）、
 * reconciliation は SQL の row をそのまま返すので snake_case で時刻が epoch の数値になる。
 */

export type SystemPrincipalKind = "human" | "agent" | "service" | "connector"

export type SystemPrincipal = {
  id: string
  account_id: string
  kind: SystemPrincipalKind
  name: string
  connector_id: string | null
  revision: number
  created_at: string
  updated_at: string
}

export type SystemMachineCredential = {
  id: string
  principal_id: string
  name: string
  status: string
  created_at: string
  updated_at: string
  expires_at: string | null
  last_used_at: string | null
  revoked_at: string | null
}

export type SystemDeliveryKind = "job" | "outbox"

export type SystemDeliveryStatus = "queued" | "leased" | "succeeded" | "dead_letter"

export type SystemDelivery = {
  id: string
  kind: SystemDeliveryKind
  operation_key: string
  payload_digest: string
  idempotency_key: string
  status: SystemDeliveryStatus
  attempt: number
  max_attempts: number
  available_at: string
  lease_account_id: string | null
  lease_expires_at: string | null
  last_error_code: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export type SystemDeadLetter = {
  id: string
  sourceType: string
  sourceId: string
  payloadDigest: string
  reasonCode: string
  attempt: number
  recordedAt: string
  requeuedJobId: string | null
  requeuedAt: string | null
}

export type SystemConnectorDirection = "inbound" | "outbound" | "bidirectional"

export type SystemConnector = {
  id: string
  key: string
  name: string
  direction: SystemConnectorDirection
  transport: "api" | "file" | "webhook"
  status: "active" | "disabled"
  revision: number
}

export type SystemIntegrationExchangeStatus = "pending" | "succeeded" | "failed" | "cancelled"

export type SystemIntegrationExchange = {
  id: string
  connectorId: string
  direction: "inbound" | "outbound"
  operationKey: string
  idempotencyKey: string
  payloadDigest: string
  status: SystemIntegrationExchangeStatus
  attempt: number
  externalReference: string | null
  lastErrorCode: string | null
}

/**
 * 照合の実行。item を INNER JOIN で数えるので、item が 1 件も無い run は出てこない。
 */
export type SystemReconciliationRun = {
  id: string
  exchange_id: string
  assertion_id: string
  local_version: string
  status: string
  created_at: number
  item_count: number
}

export type SystemPermissionDefinition = {
  key: string
  description: string
  category: string
}
