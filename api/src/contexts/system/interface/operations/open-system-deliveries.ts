import { SystemDeliveryRepository } from "@system/infrastructure/repositories/events/system-delivery.repository"

/** 汎用job・outbox・inbox・dead letterを同じleaseと冪等性規則で扱う保存口を開く。 */
export function openSystemDeliveries(
  context: ConstructorParameters<typeof SystemDeliveryRepository>[0],
): SystemDeliveryRepository {
  return new SystemDeliveryRepository(context)
}
