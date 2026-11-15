import { pageApiReader } from "@/api/http/void-api-route"
import * as applicationRequestRoute from "@/api/routes/company.application-requests.$id"
import * as applicationAdminRoute from "@/api/routes/company.application-requests.admin"
import * as applicationListRoute from "@/api/routes/company.application-requests"
import * as applicationRepairsRoute from "@/api/routes/company.application-requests.workflow-repairs"
import * as applicationTemplateWorkflowRoute from "@/api/routes/company.application-templates.$code.workflow"
import * as approvalDelegationsRoute from "@/api/routes/company.approval-delegations"
import * as applicationInboxRoute from "@/api/routes/company.application-requests.inbox"
import * as applicationMineRoute from "@/api/routes/company.application-requests.me"
import * as applicationTemplateRoute from "@/api/routes/company.application-templates.$code"
import * as applicationTemplatesRoute from "@/api/routes/company.application-templates"
import * as currentProfileRoute from "@/api/routes/company.current-profile"

/**
 * 画面のloaderが最初の表示のために読むAPI。
 * 型は画面の側が決める。ここは経路とhandlerの対応だけを持つ。
 */
export const readCurrentProfile = pageApiReader("/company/current-profile", currentProfileRoute.GET)

export const readApplicationInbox = pageApiReader(
  "/company/application-requests/inbox",
  applicationInboxRoute.GET,
)

export const readMyApplications = pageApiReader(
  "/company/application-requests/me",
  applicationMineRoute.GET,
)

export const readApplication = pageApiReader(
  "/company/application-requests/:id",
  applicationRequestRoute.GET,
)

export const readApplicationTemplates = pageApiReader(
  "/company/application-templates",
  applicationTemplatesRoute.GET,
)

export const readApplicationTemplate = pageApiReader(
  "/company/application-templates/:code",
  applicationTemplateRoute.GET,
)

export const readApplicationTemplateWorkflow = pageApiReader(
  "/company/application-templates/:code/workflow",
  applicationTemplateWorkflowRoute.GET,
)

export const readAdminApplications = pageApiReader(
  "/company/application-requests/admin",
  applicationAdminRoute.GET,
)

export const readApplicationList = pageApiReader(
  "/company/application-requests",
  applicationListRoute.GET,
)

export const readWorkflowRepairs = pageApiReader(
  "/company/application-requests/workflow-repairs",
  applicationRepairsRoute.GET,
)

export const readApprovalDelegations = pageApiReader(
  "/company/approval-delegations",
  approvalDelegationsRoute.GET,
)
