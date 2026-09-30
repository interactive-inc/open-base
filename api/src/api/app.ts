// このファイルは `bun run gen:app` が生成する。手で編集しない。
// ルートを足すときは登録済みcontextのinterface/routesへ置き、生成器を再実行する。
// middleware・エラーハンドラは手書きの api/app-base.ts が持つ。

import { hc } from "hono/client"
import { createAppBase, createRouteApp } from "@/api/app-base"
import * as companyAccountDirectoryRoute from "@/api/routes/company.account-directory"
import * as companyApplicationRequestsRoute from "@/api/routes/company.application-requests"
import * as companyApplicationRequestsIdRoute from "@/api/routes/company.application-requests.$id"
import * as companyApplicationRequestsIdApproveRoute from "@/api/routes/company.application-requests.$id.approve"
import * as companyApplicationRequestsIdReassignWorkflowStepRoute from "@/api/routes/company.application-requests.$id.reassign-workflow-step"
import * as companyApplicationRequestsIdRejectRoute from "@/api/routes/company.application-requests.$id.reject"
import * as companyApplicationRequestsIdResubmitRoute from "@/api/routes/company.application-requests.$id.resubmit"
import * as companyApplicationRequestsAdminRoute from "@/api/routes/company.application-requests.admin"
import * as companyApplicationRequestsInboxRoute from "@/api/routes/company.application-requests.inbox"
import * as companyApplicationRequestsMeRoute from "@/api/routes/company.application-requests.me"
import * as companyApplicationRequestsWorkflowRepairsRoute from "@/api/routes/company.application-requests.workflow-repairs"
import * as companyApplicationTemplatesRoute from "@/api/routes/company.application-templates"
import * as companyApplicationTemplatesCodeRoute from "@/api/routes/company.application-templates.$code"
import * as companyApplicationTemplatesCodeWorkflowRoute from "@/api/routes/company.application-templates.$code.workflow"
import * as companyApprovalDelegationsRoute from "@/api/routes/company.approval-delegations"
import * as companyApprovalDelegationsIdRoute from "@/api/routes/company.approval-delegations.$id"
import * as companyAuditEventExportsRoute from "@/api/routes/company.audit-event-exports"
import * as companyAuditEventsRoute from "@/api/routes/company.audit-events"
import * as companyAuditEventsEventIdRoute from "@/api/routes/company.audit-events.$eventId"
import * as companyCurrentProfileRoute from "@/api/routes/company.current-profile"
import * as companyDashboardRoute from "@/api/routes/company.dashboard"
import * as companyDashboardManagementRoute from "@/api/routes/company.dashboard.management"
import * as companyEmployeeRegistrationsRoute from "@/api/routes/company.employee-registrations"
import * as companyFeaturesRoute from "@/api/routes/company.features"
import * as companyInboxCountsRoute from "@/api/routes/company.inbox.counts"
import * as companyNotificationsRoute from "@/api/routes/company.notifications"
import * as companyPersonalDataErasureRequestsRoute from "@/api/routes/company.personal-data-erasure-requests"
import * as companyPersonalDataErasureRequestsIdExecuteRoute from "@/api/routes/company.personal-data-erasure-requests.$id.execute"
import * as companyPersonnelActionRequestsRoute from "@/api/routes/company.personnel-action-requests"
import * as systemPermissionDefinitionsRoute from "@/api/routes/system.permission-definitions"
import * as companyAccountEmployeeLinksRoute from "@/contexts/company/interface/routes/company.account-employee-links"
import * as companyAssignmentResourceAdoptionsRoute from "@/contexts/company/interface/routes/company.assignment-resource-adoptions"
import * as companyAuthorityResolutionsRoute from "@/contexts/company/interface/routes/company.authority-resolutions"
import * as companyBootstrapRoute from "@/contexts/company/interface/routes/company.bootstrap"
import * as companyCapabilitiesRoute from "@/contexts/company/interface/routes/company.capabilities"
import * as companyChangesRoute from "@/contexts/company/interface/routes/company.changes"
import * as companyDefinitionResourceAdoptionsCommandIdRoute from "@/contexts/company/interface/routes/company.definition-resource-adoptions.$commandId"
import * as companyDefinitionsRoute from "@/contexts/company/interface/routes/company.definitions"
import * as companyEmployeeDirectoryRoute from "@/contexts/company/interface/routes/company.employee-directory"
import * as companyEmployeeDirectoryCodeRoute from "@/contexts/company/interface/routes/company.employee-directory.$code"
import * as companyEmployeeLifecycleCodeEventsRoute from "@/contexts/company/interface/routes/company.employee-lifecycle.$code.events"
import * as companyEmployeeLifecycleCodeStateRoute from "@/contexts/company/interface/routes/company.employee-lifecycle.$code.state"
import * as companyEmployeeResourceAdoptionBatchesRoute from "@/contexts/company/interface/routes/company.employee-resource-adoption-batches"
import * as companyEmployeeResourceAdoptionsRoute from "@/contexts/company/interface/routes/company.employee-resource-adoptions"
import * as companyEmployeesRoute from "@/contexts/company/interface/routes/company.employees"
import * as companyEmploymentStartCorrectionsRoute from "@/contexts/company/interface/routes/company.employment-start-corrections"
import * as companyEmploymentsRoute from "@/contexts/company/interface/routes/company.employments"
import * as companyExternalIdentityImportsRoute from "@/contexts/company/interface/routes/company.external-identity-imports"
import * as companyGradeAssignmentHistoryRoute from "@/contexts/company/interface/routes/company.grade-assignment-history"
import * as companyGradeAwardArchivesCommandIdRoute from "@/contexts/company/interface/routes/company.grade-award-archives.$commandId"
import * as companyGradeAwardArchivesByEmployeeEmployeeIdRoute from "@/contexts/company/interface/routes/company.grade-award-archives.by-employee.$employeeId"
import * as companyLegacyPersonnelActionRecordsRoute from "@/contexts/company/interface/routes/company.legacy-personnel-action-records"
import * as companyMyDirectReportsRoute from "@/contexts/company/interface/routes/company.my-direct-reports"
import * as companyMyOrganizationUnitsRoute from "@/contexts/company/interface/routes/company.my-organization-units"
import * as companyMyProfileRoute from "@/contexts/company/interface/routes/company.my-profile"
import * as companyOrganizationChangesRoute from "@/contexts/company/interface/routes/company.organization-changes"
import * as companyOrganizationProfileRoute from "@/contexts/company/interface/routes/company.organization-profile"
import * as companyOrganizationResourceAdoptionsRoute from "@/contexts/company/interface/routes/company.organization-resource-adoptions"
import * as companyOrganizationSnapshotsRoute from "@/contexts/company/interface/routes/company.organization-snapshots"
import * as companyOrganizationTreeRoute from "@/contexts/company/interface/routes/company.organization-tree"
import * as companyOrganizationUnitsRoute from "@/contexts/company/interface/routes/company.organization-units"
import * as companyOrganizationUnitsCodeRoute from "@/contexts/company/interface/routes/company.organization-units.$code"
import * as companyOrganizationUnitsCodeMembersRoute from "@/contexts/company/interface/routes/company.organization-units.$code.members"
import * as companyPeopleRoute from "@/contexts/company/interface/routes/company.people"
import * as companyPersonnelActionEventsRoute from "@/contexts/company/interface/routes/company.personnel-action-events"
import * as companyPersonnelActionExecutionsRoute from "@/contexts/company/interface/routes/company.personnel-action-executions"
import * as companyPersonnelActionsRoute from "@/contexts/company/interface/routes/company.personnel-actions"
import * as companyPersonnelAnnotationsRoute from "@/contexts/company/interface/routes/company.personnel-annotations"
import * as companyProfileRoute from "@/contexts/company/interface/routes/company.profile"
import * as companyReportingLinesEmployeeCodeRoute from "@/contexts/company/interface/routes/company.reporting-lines.$employeeCode"
import * as companyResourceHistoryTypeIdRoute from "@/contexts/company/interface/routes/company.resource-history.$type.$id"
import * as companyResponsibilityResourceAdoptionsRoute from "@/contexts/company/interface/routes/company.responsibility-resource-adoptions"
import * as companyWorkforceConnectionCompletionsRoute from "@/contexts/company/interface/routes/company.workforce-connection-completions"
import * as systemAccountsRoute from "@system/interface/routes/system.accounts"
import * as systemAccountsAccountIdRoute from "@system/interface/routes/system.accounts.$accountId"
import * as systemAccountsAccountIdIdentitiesRoute from "@system/interface/routes/system.accounts.$accountId.identities"
import * as systemAccountsAccountIdIdentitiesIdentityIdRoute from "@system/interface/routes/system.accounts.$accountId.identities.$identityId"
import * as systemAccountsAccountIdPasswordCredentialsRoute from "@system/interface/routes/system.accounts.$accountId.password-credentials"
import * as systemAccountsAccountIdRoleBindingsRoute from "@system/interface/routes/system.accounts.$accountId.role-bindings"
import * as systemAccountsAccountIdRoleBindingsBindingIdRoute from "@system/interface/routes/system.accounts.$accountId.role-bindings.$bindingId"
import * as systemAttachmentsRoute from "@system/interface/routes/system.attachments"
import * as systemAttachmentsAttachmentIdRoute from "@system/interface/routes/system.attachments.$attachmentId"
import * as systemAttachmentsAttachmentIdPreservationsRoute from "@system/interface/routes/system.attachments.$attachmentId.preservations"
import * as systemAttachmentsAttachmentIdPreservationsPreservationIdReleaseRoute from "@system/interface/routes/system.attachments.$attachmentId.preservations.$preservationId.release"
import * as systemAttachmentsPurgeUnlinkedRoute from "@system/interface/routes/system.attachments.purge-unlinked"
import * as systemAuditDisclosurePoliciesRoute from "@system/interface/routes/system.audit-disclosure-policies"
import * as systemAuditEventsRoute from "@system/interface/routes/system.audit-events"
import * as systemAuditEventsEventIdRoute from "@system/interface/routes/system.audit-events.$eventId"
import * as systemAuthPasswordResetRoute from "@system/interface/routes/system.auth.password.reset"
import * as systemBatchJobsRoute from "@system/interface/routes/system.batch-jobs"
import * as systemBootstrapRoute from "@system/interface/routes/system.bootstrap"
import * as systemBrowserLoginCodesRoute from "@system/interface/routes/system.browser-login-codes"
import * as systemBrowserSessionsRoute from "@system/interface/routes/system.browser-sessions"
import * as systemCliAuthorizationCallbackRoute from "@system/interface/routes/system.cli-authorization-callback"
import * as systemCliAuthorizationsRoute from "@system/interface/routes/system.cli-authorizations"
import * as systemCliSessionsRoute from "@system/interface/routes/system.cli-sessions"
import * as systemConnectorsRoute from "@system/interface/routes/system.connectors"
import * as systemConnectorsConnectorIdRoute from "@system/interface/routes/system.connectors.$connectorId"
import * as systemDeadLettersRoute from "@system/interface/routes/system.dead-letters"
import * as systemDeadLettersDeadLetterIdRequeueRoute from "@system/interface/routes/system.dead-letters.$deadLetterId.requeue"
import * as systemDeliveriesRoute from "@system/interface/routes/system.deliveries"
import * as systemDeliveriesDeliveryIdRoute from "@system/interface/routes/system.deliveries.$deliveryId"
import * as systemHealthRoute from "@system/interface/routes/system.health"
import * as systemIdentitySessionsRoute from "@system/interface/routes/system.identity-sessions"
import * as systemInboxMessagesMessageIdRoute from "@system/interface/routes/system.inbox-messages.$messageId"
import * as systemIntegrationExchangesRoute from "@system/interface/routes/system.integration-exchanges"
import * as systemIntegrationExchangesExchangeIdRoute from "@system/interface/routes/system.integration-exchanges.$exchangeId"
import * as systemIntegrationExchangesExchangeIdReconciliationsRoute from "@system/interface/routes/system.integration-exchanges.$exchangeId.reconciliations"
import * as systemMachineSessionsRoute from "@system/interface/routes/system.machine-sessions"
import * as systemNotificationsRoute from "@system/interface/routes/system.notifications"
import * as systemNotificationsIdRoute from "@system/interface/routes/system.notifications.$id"
import * as systemNotificationsUnreadCountRoute from "@system/interface/routes/system.notifications.unread-count"
import * as systemOauthAuthorizationsRoute from "@system/interface/routes/system.oauth.authorizations"
import * as systemOauthMcpGrantsRoute from "@system/interface/routes/system.oauth.mcp-grants"
import * as systemOauthTokenRoute from "@system/interface/routes/system.oauth.token"
import * as systemOauthUserinfoRoute from "@system/interface/routes/system.oauth.userinfo"
import * as systemPreservedRecordsRoute from "@system/interface/routes/system.preserved-records"
import * as systemPreservedRecordsRecordIdContentRoute from "@system/interface/routes/system.preserved-records.$recordId.content"
import * as systemPreservedRecordsRecordIdDossierRoute from "@system/interface/routes/system.preserved-records.$recordId.dossier"
import * as systemPrincipalsRoute from "@system/interface/routes/system.principals"
import * as systemPrincipalsPrincipalIdRoute from "@system/interface/routes/system.principals.$principalId"
import * as systemPrincipalsPrincipalIdMachineCredentialsRoute from "@system/interface/routes/system.principals.$principalId.machine-credentials"
import * as systemPrincipalsPrincipalIdMachineCredentialsCredentialIdRoute from "@system/interface/routes/system.principals.$principalId.machine-credentials.$credentialId"
import * as systemProposalsNumberVersionsVersionRoute from "@system/interface/routes/system.proposals.$number.versions.$version"
import * as systemRolesRoute from "@system/interface/routes/system.roles"
import * as systemRolesRoleIdRoute from "@system/interface/routes/system.roles.$roleId"
import * as systemSessionsRoute from "@system/interface/routes/system.sessions"
import * as systemStepUpGrantsRoute from "@system/interface/routes/system.step-up-grants"
import * as systemWorkItemsRoute from "@system/interface/routes/system.work-items"
import * as systemWorkItemsIdRoute from "@system/interface/routes/system.work-items.$id"
import * as systemWorkItemsIdAcceptRoute from "@system/interface/routes/system.work-items.$id.accept"
import * as systemWorkItemsIdApproveRoute from "@system/interface/routes/system.work-items.$id.approve"
import * as systemWorkItemsIdCancelRoute from "@system/interface/routes/system.work-items.$id.cancel"
import * as systemWorkItemsIdEvidenceAttachmentIdRoute from "@system/interface/routes/system.work-items.$id.evidence.$attachmentId"
import * as systemWorkItemsIdHandoversRoute from "@system/interface/routes/system.work-items.$id.handovers"
import * as systemWorkItemsIdHandoversAcceptRoute from "@system/interface/routes/system.work-items.$id.handovers.accept"
import * as systemWorkItemsIdHandoversDeclineRoute from "@system/interface/routes/system.work-items.$id.handovers.decline"
import * as systemWorkItemsIdHistoryRoute from "@system/interface/routes/system.work-items.$id.history"
import * as systemWorkItemsIdResultsRoute from "@system/interface/routes/system.work-items.$id.results"
import * as systemWorkItemsIdReturnRoute from "@system/interface/routes/system.work-items.$id.return"

const routePart0 = createRouteApp()
  .get("/company/account-directory", ...companyAccountDirectoryRoute.GET)
  .get("/company/account-employee-links", ...companyAccountEmployeeLinksRoute.GET)
  .post("/company/account-employee-links", ...companyAccountEmployeeLinksRoute.POST)

const routePart1 = createRouteApp().get(
  "/company/application-requests",
  ...companyApplicationRequestsRoute.GET,
)

const routePart2 = createRouteApp().post(
  "/company/application-requests",
  ...companyApplicationRequestsRoute.POST,
)

const routePart3 = createRouteApp().get(
  "/company/application-requests/admin",
  ...companyApplicationRequestsAdminRoute.GET,
)

const routePart4 = createRouteApp().get(
  "/company/application-requests/inbox",
  ...companyApplicationRequestsInboxRoute.GET,
)

const routePart5 = createRouteApp().get(
  "/company/application-requests/me",
  ...companyApplicationRequestsMeRoute.GET,
)

const routePart6 = createRouteApp().get(
  "/company/application-requests/workflow-repairs",
  ...companyApplicationRequestsWorkflowRepairsRoute.GET,
)

const routePart7 = createRouteApp().get(
  "/company/application-requests/:id",
  ...companyApplicationRequestsIdRoute.GET,
)

const routePart8 = createRouteApp().put(
  "/company/application-requests/:id",
  ...companyApplicationRequestsIdRoute.PUT,
)

const routePart9 = createRouteApp().delete(
  "/company/application-requests/:id",
  ...companyApplicationRequestsIdRoute.DELETE,
)

const routePart10 = createRouteApp().post(
  "/company/application-requests/:id/approve",
  ...companyApplicationRequestsIdApproveRoute.POST,
)

const routePart11 = createRouteApp().post(
  "/company/application-requests/:id/reassign-workflow-step",
  ...companyApplicationRequestsIdReassignWorkflowStepRoute.POST,
)

const routePart12 = createRouteApp().post(
  "/company/application-requests/:id/reject",
  ...companyApplicationRequestsIdRejectRoute.POST,
)

const routePart13 = createRouteApp().post(
  "/company/application-requests/:id/resubmit",
  ...companyApplicationRequestsIdResubmitRoute.POST,
)

const routePart14 = createRouteApp().get(
  "/company/application-templates",
  ...companyApplicationTemplatesRoute.GET,
)

const routePart15 = createRouteApp().post(
  "/company/application-templates",
  ...companyApplicationTemplatesRoute.POST,
)

const routePart16 = createRouteApp().get(
  "/company/application-templates/:code",
  ...companyApplicationTemplatesCodeRoute.GET,
)

const routePart17 = createRouteApp().put(
  "/company/application-templates/:code",
  ...companyApplicationTemplatesCodeRoute.PUT,
)

const routePart18 = createRouteApp().delete(
  "/company/application-templates/:code",
  ...companyApplicationTemplatesCodeRoute.DELETE,
)

const routePart19 = createRouteApp().get(
  "/company/application-templates/:code/workflow",
  ...companyApplicationTemplatesCodeWorkflowRoute.GET,
)

const routePart20 = createRouteApp().put(
  "/company/application-templates/:code/workflow",
  ...companyApplicationTemplatesCodeWorkflowRoute.PUT,
)

const routePart21 = createRouteApp().get(
  "/company/approval-delegations",
  ...companyApprovalDelegationsRoute.GET,
)

const routePart22 = createRouteApp().post(
  "/company/approval-delegations",
  ...companyApprovalDelegationsRoute.POST,
)

const routePart23 = createRouteApp().delete(
  "/company/approval-delegations/:id",
  ...companyApprovalDelegationsIdRoute.DELETE,
)

const routePart24 = createRouteApp()
  .get("/company/assignment-resource-adoptions", ...companyAssignmentResourceAdoptionsRoute.GET)
  .post("/company/assignment-resource-adoptions", ...companyAssignmentResourceAdoptionsRoute.POST)
  .post("/company/audit-event-exports", ...companyAuditEventExportsRoute.POST)
  .get("/company/audit-events", ...companyAuditEventsRoute.GET)
  .get("/company/audit-events/:eventId", ...companyAuditEventsEventIdRoute.GET)
  .post("/company/authority-resolutions", ...companyAuthorityResolutionsRoute.POST)
  .post("/company/bootstrap", ...companyBootstrapRoute.POST)
  .get("/company/capabilities", ...companyCapabilitiesRoute.GET)
  .get("/company/changes", ...companyChangesRoute.GET)
  .get("/company/current-profile", ...companyCurrentProfileRoute.GET)
  .get("/company/dashboard", ...companyDashboardRoute.GET)
  .get("/company/dashboard/management", ...companyDashboardManagementRoute.GET)
  .get(
    "/company/definition-resource-adoptions/:commandId",
    ...companyDefinitionResourceAdoptionsCommandIdRoute.GET,
  )
  .get("/company/definitions", ...companyDefinitionsRoute.GET)
  .post("/company/definitions", ...companyDefinitionsRoute.POST)
  .get("/company/employee-directory", ...companyEmployeeDirectoryRoute.GET)
  .get("/company/employee-directory/:code", ...companyEmployeeDirectoryCodeRoute.GET)
  .put("/company/employee-directory/:code", ...companyEmployeeDirectoryCodeRoute.PUT)
  .get("/company/employee-lifecycle/:code/events", ...companyEmployeeLifecycleCodeEventsRoute.GET)
  .get("/company/employee-lifecycle/:code/state", ...companyEmployeeLifecycleCodeStateRoute.GET)
  .post("/company/employee-registrations", ...companyEmployeeRegistrationsRoute.POST)
  .post(
    "/company/employee-resource-adoption-batches",
    ...companyEmployeeResourceAdoptionBatchesRoute.POST,
  )
  .get("/company/employee-resource-adoptions", ...companyEmployeeResourceAdoptionsRoute.GET)
  .post("/company/employee-resource-adoptions", ...companyEmployeeResourceAdoptionsRoute.POST)
  .get("/company/employees", ...companyEmployeesRoute.GET)
  .post("/company/employees", ...companyEmployeesRoute.POST)
  .get("/company/employment-start-corrections", ...companyEmploymentStartCorrectionsRoute.GET)
  .post("/company/employment-start-corrections", ...companyEmploymentStartCorrectionsRoute.POST)
  .get("/company/employments", ...companyEmploymentsRoute.GET)
  .post("/company/employments", ...companyEmploymentsRoute.POST)
  .post("/company/external-identity-imports", ...companyExternalIdentityImportsRoute.POST)
  .get("/company/features", ...companyFeaturesRoute.GET)
  .get("/company/grade-assignment-history", ...companyGradeAssignmentHistoryRoute.GET)
  .get(
    "/company/grade-award-archives/by-employee/:employeeId",
    ...companyGradeAwardArchivesByEmployeeEmployeeIdRoute.GET,
  )
  .get("/company/grade-award-archives/:commandId", ...companyGradeAwardArchivesCommandIdRoute.GET)
  .get("/company/inbox/counts", ...companyInboxCountsRoute.GET)
  .get("/company/legacy-personnel-action-records", ...companyLegacyPersonnelActionRecordsRoute.GET)
  .get("/company/my-direct-reports", ...companyMyDirectReportsRoute.GET)
  .get("/company/my-organization-units", ...companyMyOrganizationUnitsRoute.GET)
  .get("/company/my-profile", ...companyMyProfileRoute.GET)
  .put("/company/my-profile", ...companyMyProfileRoute.PUT)
  .post("/company/notifications", ...companyNotificationsRoute.POST)
  .post("/company/organization-changes", ...companyOrganizationChangesRoute.POST)
  .get("/company/organization-profile", ...companyOrganizationProfileRoute.GET)
  .put("/company/organization-profile", ...companyOrganizationProfileRoute.PUT)
  .get("/company/organization-resource-adoptions", ...companyOrganizationResourceAdoptionsRoute.GET)
  .post(
    "/company/organization-resource-adoptions",
    ...companyOrganizationResourceAdoptionsRoute.POST,
  )
  .get("/company/organization-snapshots", ...companyOrganizationSnapshotsRoute.GET)

const routePart25 = createRouteApp()
  .get("/company/organization-tree", ...companyOrganizationTreeRoute.GET)
  .get("/company/organization-units", ...companyOrganizationUnitsRoute.GET)
  .post("/company/organization-units", ...companyOrganizationUnitsRoute.POST)
  .get("/company/organization-units/:code", ...companyOrganizationUnitsCodeRoute.GET)
  .put("/company/organization-units/:code", ...companyOrganizationUnitsCodeRoute.PUT)
  .delete("/company/organization-units/:code", ...companyOrganizationUnitsCodeRoute.DELETE)
  .get("/company/organization-units/:code/members", ...companyOrganizationUnitsCodeMembersRoute.GET)
  .get("/company/people", ...companyPeopleRoute.GET)
  .post("/company/people", ...companyPeopleRoute.POST)
  .post("/company/personal-data-erasure-requests", ...companyPersonalDataErasureRequestsRoute.POST)
  .post(
    "/company/personal-data-erasure-requests/:id/execute",
    ...companyPersonalDataErasureRequestsIdExecuteRoute.POST,
  )
  .get("/company/personnel-action-events", ...companyPersonnelActionEventsRoute.GET)
  .post("/company/personnel-action-executions", ...companyPersonnelActionExecutionsRoute.POST)

const routePart26 = createRouteApp().get(
  "/company/personnel-action-requests",
  ...companyPersonnelActionRequestsRoute.GET,
)

const routePart27 = createRouteApp().post(
  "/company/personnel-action-requests",
  ...companyPersonnelActionRequestsRoute.POST,
)

const routePart28 = createRouteApp()
  .get("/company/personnel-actions", ...companyPersonnelActionsRoute.GET)
  .get("/company/personnel-annotations", ...companyPersonnelAnnotationsRoute.GET)
  .get("/company/profile", ...companyProfileRoute.GET)
  .post("/company/profile", ...companyProfileRoute.POST)
  .get("/company/reporting-lines/:employeeCode", ...companyReportingLinesEmployeeCodeRoute.GET)
  .get("/company/resource-history/:type/:id", ...companyResourceHistoryTypeIdRoute.GET)
  .get(
    "/company/responsibility-resource-adoptions",
    ...companyResponsibilityResourceAdoptionsRoute.GET,
  )
  .post(
    "/company/responsibility-resource-adoptions",
    ...companyResponsibilityResourceAdoptionsRoute.POST,
  )
  .get(
    "/company/workforce-connection-completions",
    ...companyWorkforceConnectionCompletionsRoute.GET,
  )
  .post(
    "/company/workforce-connection-completions",
    ...companyWorkforceConnectionCompletionsRoute.POST,
  )
  .get("/system/accounts", ...systemAccountsRoute.GET)
  .post("/system/accounts", ...systemAccountsRoute.POST)
  .get("/system/accounts/:accountId", ...systemAccountsAccountIdRoute.GET)
  .patch("/system/accounts/:accountId", ...systemAccountsAccountIdRoute.PATCH)
  .get("/system/accounts/:accountId/identities", ...systemAccountsAccountIdIdentitiesRoute.GET)
  .post("/system/accounts/:accountId/identities", ...systemAccountsAccountIdIdentitiesRoute.POST)
  .get(
    "/system/accounts/:accountId/identities/:identityId",
    ...systemAccountsAccountIdIdentitiesIdentityIdRoute.GET,
  )
  .delete(
    "/system/accounts/:accountId/identities/:identityId",
    ...systemAccountsAccountIdIdentitiesIdentityIdRoute.DELETE,
  )
  .patch(
    "/system/accounts/:accountId/password-credentials",
    ...systemAccountsAccountIdPasswordCredentialsRoute.PATCH,
  )
  .get("/system/accounts/:accountId/role-bindings", ...systemAccountsAccountIdRoleBindingsRoute.GET)
  .post(
    "/system/accounts/:accountId/role-bindings",
    ...systemAccountsAccountIdRoleBindingsRoute.POST,
  )
  .delete(
    "/system/accounts/:accountId/role-bindings/:bindingId",
    ...systemAccountsAccountIdRoleBindingsBindingIdRoute.DELETE,
  )
  .post("/system/attachments", ...systemAttachmentsRoute.POST)
  .post("/system/attachments/purge-unlinked", ...systemAttachmentsPurgeUnlinkedRoute.POST)
  .get("/system/attachments/:attachmentId", ...systemAttachmentsAttachmentIdRoute.GET)
  .get(
    "/system/attachments/:attachmentId/preservations",
    ...systemAttachmentsAttachmentIdPreservationsRoute.GET,
  )
  .post(
    "/system/attachments/:attachmentId/preservations",
    ...systemAttachmentsAttachmentIdPreservationsRoute.POST,
  )
  .post(
    "/system/attachments/:attachmentId/preservations/:preservationId/release",
    ...systemAttachmentsAttachmentIdPreservationsPreservationIdReleaseRoute.POST,
  )
  .get("/system/audit-disclosure-policies", ...systemAuditDisclosurePoliciesRoute.GET)
  .post("/system/audit-disclosure-policies", ...systemAuditDisclosurePoliciesRoute.POST)
  .get("/system/audit-events", ...systemAuditEventsRoute.GET)
  .get("/system/audit-events/:eventId", ...systemAuditEventsEventIdRoute.GET)
  .post("/system/auth/password/reset", ...systemAuthPasswordResetRoute.POST)
  .patch("/system/auth/password/reset", ...systemAuthPasswordResetRoute.PATCH)
  .get("/system/batch-jobs", ...systemBatchJobsRoute.GET)
  .post("/system/bootstrap", ...systemBootstrapRoute.POST)
  .post("/system/browser-login-codes", ...systemBrowserLoginCodesRoute.POST)
  .post("/system/browser-sessions", ...systemBrowserSessionsRoute.POST)
  .get("/system/cli-authorization-callback", ...systemCliAuthorizationCallbackRoute.GET)
  .get("/system/cli-authorizations", ...systemCliAuthorizationsRoute.GET)
  .post("/system/cli-sessions", ...systemCliSessionsRoute.POST)
  .get("/system/connectors", ...systemConnectorsRoute.GET)
  .post("/system/connectors", ...systemConnectorsRoute.POST)
  .patch("/system/connectors/:connectorId", ...systemConnectorsConnectorIdRoute.PATCH)
  .get("/system/dead-letters", ...systemDeadLettersRoute.GET)
  .post(
    "/system/dead-letters/:deadLetterId/requeue",
    ...systemDeadLettersDeadLetterIdRequeueRoute.POST,
  )
  .get("/system/deliveries", ...systemDeliveriesRoute.GET)
  .post("/system/deliveries", ...systemDeliveriesRoute.POST)

const routePart29 = createRouteApp()
  .patch("/system/deliveries/:deliveryId", ...systemDeliveriesDeliveryIdRoute.PATCH)
  .get("/system/health", ...systemHealthRoute.GET)
  .post("/system/identity-sessions", ...systemIdentitySessionsRoute.POST)
  .patch("/system/inbox-messages/:messageId", ...systemInboxMessagesMessageIdRoute.PATCH)
  .get("/system/integration-exchanges", ...systemIntegrationExchangesRoute.GET)
  .post("/system/integration-exchanges", ...systemIntegrationExchangesRoute.POST)
  .get(
    "/system/integration-exchanges/:exchangeId",
    ...systemIntegrationExchangesExchangeIdRoute.GET,
  )
  .patch(
    "/system/integration-exchanges/:exchangeId",
    ...systemIntegrationExchangesExchangeIdRoute.PATCH,
  )
  .get(
    "/system/integration-exchanges/:exchangeId/reconciliations",
    ...systemIntegrationExchangesExchangeIdReconciliationsRoute.GET,
  )
  .post(
    "/system/integration-exchanges/:exchangeId/reconciliations",
    ...systemIntegrationExchangesExchangeIdReconciliationsRoute.POST,
  )
  .post("/system/machine-sessions", ...systemMachineSessionsRoute.POST)
  .get("/system/notifications", ...systemNotificationsRoute.GET)
  .post("/system/notifications", ...systemNotificationsRoute.POST)
  .patch("/system/notifications", ...systemNotificationsRoute.PATCH)
  .get("/system/notifications/unread-count", ...systemNotificationsUnreadCountRoute.GET)
  .get("/system/notifications/:id", ...systemNotificationsIdRoute.GET)
  .patch("/system/notifications/:id", ...systemNotificationsIdRoute.PATCH)
  .delete("/system/notifications/:id", ...systemNotificationsIdRoute.DELETE)
  .post("/system/oauth/authorizations", ...systemOauthAuthorizationsRoute.POST)
  .post("/system/oauth/mcp-grants", ...systemOauthMcpGrantsRoute.POST)
  .post("/system/oauth/token", ...systemOauthTokenRoute.POST)
  .get("/system/oauth/userinfo", ...systemOauthUserinfoRoute.GET)
  .get("/system/permission-definitions", ...systemPermissionDefinitionsRoute.GET)
  .get("/system/preserved-records", ...systemPreservedRecordsRoute.GET)
  .get(
    "/system/preserved-records/:recordId/content",
    ...systemPreservedRecordsRecordIdContentRoute.GET,
  )
  .get(
    "/system/preserved-records/:recordId/dossier",
    ...systemPreservedRecordsRecordIdDossierRoute.GET,
  )
  .get("/system/principals", ...systemPrincipalsRoute.GET)
  .post("/system/principals", ...systemPrincipalsRoute.POST)
  .get("/system/principals/:principalId", ...systemPrincipalsPrincipalIdRoute.GET)
  .patch("/system/principals/:principalId", ...systemPrincipalsPrincipalIdRoute.PATCH)
  .get(
    "/system/principals/:principalId/machine-credentials",
    ...systemPrincipalsPrincipalIdMachineCredentialsRoute.GET,
  )
  .post(
    "/system/principals/:principalId/machine-credentials",
    ...systemPrincipalsPrincipalIdMachineCredentialsRoute.POST,
  )
  .delete(
    "/system/principals/:principalId/machine-credentials/:credentialId",
    ...systemPrincipalsPrincipalIdMachineCredentialsCredentialIdRoute.DELETE,
  )
  .get(
    "/system/proposals/:number/versions/:version",
    ...systemProposalsNumberVersionsVersionRoute.GET,
  )
  .get("/system/roles", ...systemRolesRoute.GET)
  .post("/system/roles", ...systemRolesRoute.POST)
  .get("/system/roles/:roleId", ...systemRolesRoleIdRoute.GET)
  .patch("/system/roles/:roleId", ...systemRolesRoleIdRoute.PATCH)
  .delete("/system/roles/:roleId", ...systemRolesRoleIdRoute.DELETE)
  .post("/system/sessions", ...systemSessionsRoute.POST)
  .patch("/system/sessions", ...systemSessionsRoute.PATCH)
  .delete("/system/sessions", ...systemSessionsRoute.DELETE)
  .post("/system/step-up-grants", ...systemStepUpGrantsRoute.POST)
  .get("/system/work-items", ...systemWorkItemsRoute.GET)
  .post("/system/work-items", ...systemWorkItemsRoute.POST)
  .get("/system/work-items/:id", ...systemWorkItemsIdRoute.GET)
  .post("/system/work-items/:id/accept", ...systemWorkItemsIdAcceptRoute.POST)
  .post("/system/work-items/:id/approve", ...systemWorkItemsIdApproveRoute.POST)

const routePart30 = createRouteApp()
  .post("/system/work-items/:id/cancel", ...systemWorkItemsIdCancelRoute.POST)
  .get(
    "/system/work-items/:id/evidence/:attachmentId",
    ...systemWorkItemsIdEvidenceAttachmentIdRoute.GET,
  )
  .post("/system/work-items/:id/handovers", ...systemWorkItemsIdHandoversRoute.POST)
  .post("/system/work-items/:id/handovers/accept", ...systemWorkItemsIdHandoversAcceptRoute.POST)
  .post("/system/work-items/:id/handovers/decline", ...systemWorkItemsIdHandoversDeclineRoute.POST)
  .get("/system/work-items/:id/history", ...systemWorkItemsIdHistoryRoute.GET)
  .post("/system/work-items/:id/results", ...systemWorkItemsIdResultsRoute.POST)
  .post("/system/work-items/:id/return", ...systemWorkItemsIdReturnRoute.POST)

export const app = createAppBase()
  .route("/", routePart0)
  .route("/", routePart1)
  .route("/", routePart2)
  .route("/", routePart3)
  .route("/", routePart4)
  .route("/", routePart5)
  .route("/", routePart6)
  .route("/", routePart7)
  .route("/", routePart8)
  .route("/", routePart9)
  .route("/", routePart10)
  .route("/", routePart11)
  .route("/", routePart12)
  .route("/", routePart13)
  .route("/", routePart14)
  .route("/", routePart15)
  .route("/", routePart16)
  .route("/", routePart17)
  .route("/", routePart18)
  .route("/", routePart19)
  .route("/", routePart20)
  .route("/", routePart21)
  .route("/", routePart22)
  .route("/", routePart23)
  .route("/", routePart24)
  .route("/", routePart25)
  .route("/", routePart26)
  .route("/", routePart27)
  .route("/", routePart28)
  .route("/", routePart29)
  .route("/", routePart30)

export type AppType = typeof app

/**
 * routeを小さなHono appへ分割し、hc の型計算を再帰上限内で済ませた Client 型。
 * web/cli はこの型と AppType を type-only で import し、自前の hc<AppType>() に渡す。
 * 実行時に app 本体（全ルート）を消費側のバンドルへ引き込まないよう、ファクトリは置かない。
 */
type ApiClientPart0 = ReturnType<typeof hc<typeof routePart0>>
type ApiClientPart1 = ReturnType<typeof hc<typeof routePart1>>
type ApiClientPart2 = ReturnType<typeof hc<typeof routePart2>>
type ApiClientPart3 = ReturnType<typeof hc<typeof routePart3>>
type ApiClientPart4 = ReturnType<typeof hc<typeof routePart4>>
type ApiClientPart5 = ReturnType<typeof hc<typeof routePart5>>
type ApiClientPart6 = ReturnType<typeof hc<typeof routePart6>>
type ApiClientPart7 = ReturnType<typeof hc<typeof routePart7>>
type ApiClientPart8 = ReturnType<typeof hc<typeof routePart8>>
type ApiClientPart9 = ReturnType<typeof hc<typeof routePart9>>
type ApiClientPart10 = ReturnType<typeof hc<typeof routePart10>>
type ApiClientPart11 = ReturnType<typeof hc<typeof routePart11>>
type ApiClientPart12 = ReturnType<typeof hc<typeof routePart12>>
type ApiClientPart13 = ReturnType<typeof hc<typeof routePart13>>
type ApiClientPart14 = ReturnType<typeof hc<typeof routePart14>>
type ApiClientPart15 = ReturnType<typeof hc<typeof routePart15>>
type ApiClientPart16 = ReturnType<typeof hc<typeof routePart16>>
type ApiClientPart17 = ReturnType<typeof hc<typeof routePart17>>
type ApiClientPart18 = ReturnType<typeof hc<typeof routePart18>>
type ApiClientPart19 = ReturnType<typeof hc<typeof routePart19>>
type ApiClientPart20 = ReturnType<typeof hc<typeof routePart20>>
type ApiClientPart21 = ReturnType<typeof hc<typeof routePart21>>
type ApiClientPart22 = ReturnType<typeof hc<typeof routePart22>>
type ApiClientPart23 = ReturnType<typeof hc<typeof routePart23>>
type ApiClientPart24 = ReturnType<typeof hc<typeof routePart24>>
type ApiClientPart25 = ReturnType<typeof hc<typeof routePart25>>
type ApiClientPart26 = ReturnType<typeof hc<typeof routePart26>>
type ApiClientPart27 = ReturnType<typeof hc<typeof routePart27>>
type ApiClientPart28 = ReturnType<typeof hc<typeof routePart28>>
type ApiClientPart29 = ReturnType<typeof hc<typeof routePart29>>
type ApiClientPart30 = ReturnType<typeof hc<typeof routePart30>>
export type ApiClient = ApiClientPart0 &
  ApiClientPart1 &
  ApiClientPart2 &
  ApiClientPart3 &
  ApiClientPart4 &
  ApiClientPart5 &
  ApiClientPart6 &
  ApiClientPart7 &
  ApiClientPart8 &
  ApiClientPart9 &
  ApiClientPart10 &
  ApiClientPart11 &
  ApiClientPart12 &
  ApiClientPart13 &
  ApiClientPart14 &
  ApiClientPart15 &
  ApiClientPart16 &
  ApiClientPart17 &
  ApiClientPart18 &
  ApiClientPart19 &
  ApiClientPart20 &
  ApiClientPart21 &
  ApiClientPart22 &
  ApiClientPart23 &
  ApiClientPart24 &
  ApiClientPart25 &
  ApiClientPart26 &
  ApiClientPart27 &
  ApiClientPart28 &
  ApiClientPart29 &
  ApiClientPart30
