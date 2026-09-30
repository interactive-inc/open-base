import { systemJobs } from "@system/infrastructure/schema/system-delivery"

/** 業務のdrizzle schemaが外部キーで参照してよいSystem deliveryの列。参照整合性だけに使う。 */
export const systemDeliveryTableReferences = Object.freeze({
  jobId: () => systemJobs.id,
})
