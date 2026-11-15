import { pageApiReader } from "@/api/http/void-api-route"
import * as companyAuditEventRoute from "@/api/routes/company.audit-events.$eventId"
import * as companyAuditEventsRoute from "@/api/routes/company.audit-events"
import * as featuresRoute from "@/api/routes/company.features"
import * as auditDisclosurePoliciesRoute from "@system/interface/routes/system.audit-disclosure-policies"
import * as systemAuditEventRoute from "@system/interface/routes/system.audit-events.$eventId"
import * as systemAuditEventsRoute from "@system/interface/routes/system.audit-events"
import * as batchJobsRoute from "@system/interface/routes/system.batch-jobs"
import * as connectorRoute from "@system/interface/routes/system.connectors"
import * as deadLettersRoute from "@system/interface/routes/system.dead-letters"
import * as deliveriesRoute from "@system/interface/routes/system.deliveries"
import * as healthRoute from "@system/interface/routes/system.health"
import * as exchangesRoute from "@system/interface/routes/system.integration-exchanges"
import * as workItemHistoryRoute from "@system/interface/routes/system.work-items.$id.history"
import * as workItemRoute from "@system/interface/routes/system.work-items.$id"
import * as workItemsRoute from "@system/interface/routes/system.work-items"

/**
 * 運用と監査の画面のloaderが、最初の表示のために読むAPI。
 * 型は画面の側が決める。ここは経路とhandlerの対応だけを持つ。
 */
export const readHealth = pageApiReader("/system/health", healthRoute.GET)

export const readFeatures = pageApiReader("/company/features", featuresRoute.GET)

export const readDeadLetters = pageApiReader("/system/dead-letters", deadLettersRoute.GET)

export const readDeliveries = pageApiReader("/system/deliveries", deliveriesRoute.GET)

export const readBatchJobs = pageApiReader("/system/batch-jobs", batchJobsRoute.GET)

export const readConnectors = pageApiReader("/system/connectors", connectorRoute.GET)

export const readExchanges = pageApiReader("/system/integration-exchanges", exchangesRoute.GET)

export const readCompanyAuditEvents = pageApiReader(
  "/company/audit-events",
  companyAuditEventsRoute.GET,
)

export const readCompanyAuditEvent = pageApiReader(
  "/company/audit-events/:eventId",
  companyAuditEventRoute.GET,
)

export const readSystemAuditEvents = pageApiReader(
  "/system/audit-events",
  systemAuditEventsRoute.GET,
)

export const readSystemAuditEvent = pageApiReader(
  "/system/audit-events/:eventId",
  systemAuditEventRoute.GET,
)

export const readAuditDisclosurePolicy = pageApiReader(
  "/system/audit-disclosure-policies",
  auditDisclosurePoliciesRoute.GET,
)

export const readWorkItems = pageApiReader("/system/work-items", workItemsRoute.GET)

export const readWorkItem = pageApiReader("/system/work-items/:id", workItemRoute.GET)

export const readWorkItemHistory = pageApiReader(
  "/system/work-items/:id/history",
  workItemHistoryRoute.GET,
)
