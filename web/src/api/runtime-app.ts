// このファイルは `bun run gen:app` が生成する。手で編集しない。
// app.ts と同じ経路を同じ順序で登録し、route module は要求された経路の分だけ読み込む。
// Worker の入口（src/index.ts）が使う。型と全route の静的検証は app.ts が担う。

import { createAppBase } from "@/api/app-base"
import {
  lazyRouteHandlers,
  type RouteMethod,
  type RouteModuleLoader,
} from "@/api/http/lazy-route-handlers"

const companyAccountDirectoryRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.account-directory")
const companyApplicationRequestsRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.application-requests")
const companyApplicationRequestsIdRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.application-requests.$id")
const companyApplicationRequestsIdApproveRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.application-requests.$id.approve")
const companyApplicationRequestsIdReassignWorkflowStepRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.application-requests.$id.reassign-workflow-step")
const companyApplicationRequestsIdRejectRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.application-requests.$id.reject")
const companyApplicationRequestsIdResubmitRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.application-requests.$id.resubmit")
const companyApplicationRequestsAdminRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.application-requests.admin")
const companyApplicationRequestsInboxRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.application-requests.inbox")
const companyApplicationRequestsMeRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.application-requests.me")
const companyApplicationRequestsWorkflowRepairsRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.application-requests.workflow-repairs")
const companyApplicationTemplatesRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.application-templates")
const companyApplicationTemplatesCodeRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.application-templates.$code")
const companyApplicationTemplatesCodeWorkflowRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.application-templates.$code.workflow")
const companyApprovalDelegationsRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.approval-delegations")
const companyApprovalDelegationsIdRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.approval-delegations.$id")
const companyAuditEventExportsRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.audit-event-exports")
const companyAuditEventsRoute: RouteModuleLoader = () => import("@/api/routes/company.audit-events")
const companyAuditEventsEventIdRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.audit-events.$eventId")
const companyCurrentProfileRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.current-profile")
const companyDashboardRoute: RouteModuleLoader = () => import("@/api/routes/company.dashboard")
const companyDashboardManagementRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.dashboard.management")
const companyEmployeeRegistrationsRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.employee-registrations")
const companyFeaturesRoute: RouteModuleLoader = () => import("@/api/routes/company.features")
const companyInboxCountsRoute: RouteModuleLoader = () => import("@/api/routes/company.inbox.counts")
const companyNotificationsRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.notifications")
const companyPersonalDataErasureRequestsRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.personal-data-erasure-requests")
const companyPersonalDataErasureRequestsIdExecuteRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.personal-data-erasure-requests.$id.execute")
const companyPersonnelActionRequestsRoute: RouteModuleLoader = () =>
  import("@/api/routes/company.personnel-action-requests")
const systemPermissionDefinitionsRoute: RouteModuleLoader = () =>
  import("@/api/routes/system.permission-definitions")
const companyAccountEmployeeLinksRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.account-employee-links")
const companyAssignmentResourceAdoptionsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.assignment-resource-adoptions")
const companyAuthorityResolutionsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.authority-resolutions")
const companyBootstrapRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.bootstrap")
const companyCapabilitiesRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.capabilities")
const companyChangesRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.changes")
const companyDefinitionResourceAdoptionsCommandIdRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.definition-resource-adoptions.$commandId")
const companyDefinitionsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.definitions")
const companyEmployeeDirectoryRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.employee-directory")
const companyEmployeeDirectoryCodeRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.employee-directory.$code")
const companyEmployeeLifecycleCodeEventsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.employee-lifecycle.$code.events")
const companyEmployeeLifecycleCodeStateRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.employee-lifecycle.$code.state")
const companyEmployeeResourceAdoptionBatchesRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.employee-resource-adoption-batches")
const companyEmployeeResourceAdoptionsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.employee-resource-adoptions")
const companyEmployeesRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.employees")
const companyEmploymentStartCorrectionsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.employment-start-corrections")
const companyEmploymentsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.employments")
const companyExternalIdentityImportsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.external-identity-imports")
const companyGradeAssignmentHistoryRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.grade-assignment-history")
const companyGradeAwardArchivesCommandIdRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.grade-award-archives.$commandId")
const companyGradeAwardArchivesByEmployeeEmployeeIdRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.grade-award-archives.by-employee.$employeeId")
const companyLegacyPersonnelActionRecordsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.legacy-personnel-action-records")
const companyMyDirectReportsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.my-direct-reports")
const companyMyOrganizationUnitsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.my-organization-units")
const companyMyProfileRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.my-profile")
const companyOrganizationChangesRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.organization-changes")
const companyOrganizationProfileRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.organization-profile")
const companyOrganizationResourceAdoptionsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.organization-resource-adoptions")
const companyOrganizationSnapshotsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.organization-snapshots")
const companyOrganizationTreeRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.organization-tree")
const companyOrganizationUnitsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.organization-units")
const companyOrganizationUnitsCodeRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.organization-units.$code")
const companyOrganizationUnitsCodeMembersRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.organization-units.$code.members")
const companyPeopleRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.people")
const companyPersonnelActionEventsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.personnel-action-events")
const companyPersonnelActionExecutionsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.personnel-action-executions")
const companyPersonnelActionsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.personnel-actions")
const companyPersonnelAnnotationsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.personnel-annotations")
const companyProfileRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.profile")
const companyReportingLinesEmployeeCodeRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.reporting-lines.$employeeCode")
const companyResourceHistoryTypeIdRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.resource-history.$type.$id")
const companyResponsibilityResourceAdoptionsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.responsibility-resource-adoptions")
const companyWorkforceConnectionCompletionsRoute: RouteModuleLoader = () =>
  import("@/contexts/company/interface/routes/company.workforce-connection-completions")
const systemAccountsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.accounts")
const systemAccountsAccountIdRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.accounts.$accountId")
const systemAccountsAccountIdIdentitiesRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.accounts.$accountId.identities")
const systemAccountsAccountIdIdentitiesIdentityIdRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.accounts.$accountId.identities.$identityId")
const systemAccountsAccountIdPasswordCredentialsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.accounts.$accountId.password-credentials")
const systemAccountsAccountIdRoleBindingsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.accounts.$accountId.role-bindings")
const systemAccountsAccountIdRoleBindingsBindingIdRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.accounts.$accountId.role-bindings.$bindingId")
const systemAttachmentsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.attachments")
const systemAttachmentsAttachmentIdRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.attachments.$attachmentId")
const systemAttachmentsAttachmentIdPreservationsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.attachments.$attachmentId.preservations")
const systemAttachmentsAttachmentIdPreservationsPreservationIdReleaseRoute: RouteModuleLoader =
  () =>
    import("@system/interface/routes/system.attachments.$attachmentId.preservations.$preservationId.release")
const systemAttachmentsPurgeUnlinkedRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.attachments.purge-unlinked")
const systemAuditDisclosurePoliciesRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.audit-disclosure-policies")
const systemAuditEventsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.audit-events")
const systemAuditEventsEventIdRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.audit-events.$eventId")
const systemAuthPasswordResetRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.auth.password.reset")
const systemBatchJobsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.batch-jobs")
const systemBootstrapRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.bootstrap")
const systemBrowserLoginCodesRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.browser-login-codes")
const systemBrowserSessionsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.browser-sessions")
const systemCliAuthorizationCallbackRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.cli-authorization-callback")
const systemCliAuthorizationsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.cli-authorizations")
const systemCliSessionsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.cli-sessions")
const systemConnectorsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.connectors")
const systemConnectorsConnectorIdRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.connectors.$connectorId")
const systemDeadLettersRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.dead-letters")
const systemDeadLettersDeadLetterIdRequeueRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.dead-letters.$deadLetterId.requeue")
const systemDeliveriesRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.deliveries")
const systemDeliveriesDeliveryIdRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.deliveries.$deliveryId")
const systemHealthRoute: RouteModuleLoader = () => import("@system/interface/routes/system.health")
const systemIdentitySessionsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.identity-sessions")
const systemInboxMessagesMessageIdRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.inbox-messages.$messageId")
const systemIntegrationExchangesRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.integration-exchanges")
const systemIntegrationExchangesExchangeIdRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.integration-exchanges.$exchangeId")
const systemIntegrationExchangesExchangeIdReconciliationsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.integration-exchanges.$exchangeId.reconciliations")
const systemMachineSessionsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.machine-sessions")
const systemNotificationsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.notifications")
const systemNotificationsIdRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.notifications.$id")
const systemNotificationsUnreadCountRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.notifications.unread-count")
const systemOauthAuthorizationsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.oauth.authorizations")
const systemOauthMcpGrantsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.oauth.mcp-grants")
const systemOauthTokenRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.oauth.token")
const systemOauthUserinfoRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.oauth.userinfo")
const systemPreservedRecordsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.preserved-records")
const systemPreservedRecordsRecordIdContentRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.preserved-records.$recordId.content")
const systemPreservedRecordsRecordIdDossierRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.preserved-records.$recordId.dossier")
const systemPrincipalsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.principals")
const systemPrincipalsPrincipalIdRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.principals.$principalId")
const systemPrincipalsPrincipalIdMachineCredentialsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.principals.$principalId.machine-credentials")
const systemPrincipalsPrincipalIdMachineCredentialsCredentialIdRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.principals.$principalId.machine-credentials.$credentialId")
const systemProposalsNumberVersionsVersionRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.proposals.$number.versions.$version")
const systemRolesRoute: RouteModuleLoader = () => import("@system/interface/routes/system.roles")
const systemRolesRoleIdRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.roles.$roleId")
const systemSessionsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.sessions")
const systemStepUpGrantsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.step-up-grants")
const systemWorkItemsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.work-items")
const systemWorkItemsIdRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.work-items.$id")
const systemWorkItemsIdAcceptRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.work-items.$id.accept")
const systemWorkItemsIdApproveRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.work-items.$id.approve")
const systemWorkItemsIdCancelRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.work-items.$id.cancel")
const systemWorkItemsIdEvidenceAttachmentIdRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.work-items.$id.evidence.$attachmentId")
const systemWorkItemsIdHandoversRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.work-items.$id.handovers")
const systemWorkItemsIdHandoversAcceptRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.work-items.$id.handovers.accept")
const systemWorkItemsIdHandoversDeclineRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.work-items.$id.handovers.decline")
const systemWorkItemsIdHistoryRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.work-items.$id.history")
const systemWorkItemsIdResultsRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.work-items.$id.results")
const systemWorkItemsIdReturnRoute: RouteModuleLoader = () =>
  import("@system/interface/routes/system.work-items.$id.return")

const ROUTES: ReadonlyArray<readonly [RouteMethod, string, RouteModuleLoader]> = [
  ["GET", "/company/account-directory", companyAccountDirectoryRoute],
  ["GET", "/company/account-employee-links", companyAccountEmployeeLinksRoute],
  ["POST", "/company/account-employee-links", companyAccountEmployeeLinksRoute],
  ["GET", "/company/application-requests", companyApplicationRequestsRoute],
  ["POST", "/company/application-requests", companyApplicationRequestsRoute],
  ["GET", "/company/application-requests/admin", companyApplicationRequestsAdminRoute],
  ["GET", "/company/application-requests/inbox", companyApplicationRequestsInboxRoute],
  ["GET", "/company/application-requests/me", companyApplicationRequestsMeRoute],
  [
    "GET",
    "/company/application-requests/workflow-repairs",
    companyApplicationRequestsWorkflowRepairsRoute,
  ],
  ["GET", "/company/application-requests/:id", companyApplicationRequestsIdRoute],
  ["PUT", "/company/application-requests/:id", companyApplicationRequestsIdRoute],
  ["DELETE", "/company/application-requests/:id", companyApplicationRequestsIdRoute],
  ["POST", "/company/application-requests/:id/approve", companyApplicationRequestsIdApproveRoute],
  [
    "POST",
    "/company/application-requests/:id/reassign-workflow-step",
    companyApplicationRequestsIdReassignWorkflowStepRoute,
  ],
  ["POST", "/company/application-requests/:id/reject", companyApplicationRequestsIdRejectRoute],
  ["POST", "/company/application-requests/:id/resubmit", companyApplicationRequestsIdResubmitRoute],
  ["GET", "/company/application-templates", companyApplicationTemplatesRoute],
  ["POST", "/company/application-templates", companyApplicationTemplatesRoute],
  ["GET", "/company/application-templates/:code", companyApplicationTemplatesCodeRoute],
  ["PUT", "/company/application-templates/:code", companyApplicationTemplatesCodeRoute],
  ["DELETE", "/company/application-templates/:code", companyApplicationTemplatesCodeRoute],
  [
    "GET",
    "/company/application-templates/:code/workflow",
    companyApplicationTemplatesCodeWorkflowRoute,
  ],
  [
    "PUT",
    "/company/application-templates/:code/workflow",
    companyApplicationTemplatesCodeWorkflowRoute,
  ],
  ["GET", "/company/approval-delegations", companyApprovalDelegationsRoute],
  ["POST", "/company/approval-delegations", companyApprovalDelegationsRoute],
  ["DELETE", "/company/approval-delegations/:id", companyApprovalDelegationsIdRoute],
  ["GET", "/company/assignment-resource-adoptions", companyAssignmentResourceAdoptionsRoute],
  ["POST", "/company/assignment-resource-adoptions", companyAssignmentResourceAdoptionsRoute],
  ["POST", "/company/audit-event-exports", companyAuditEventExportsRoute],
  ["GET", "/company/audit-events", companyAuditEventsRoute],
  ["GET", "/company/audit-events/:eventId", companyAuditEventsEventIdRoute],
  ["POST", "/company/authority-resolutions", companyAuthorityResolutionsRoute],
  ["POST", "/company/bootstrap", companyBootstrapRoute],
  ["GET", "/company/capabilities", companyCapabilitiesRoute],
  ["GET", "/company/changes", companyChangesRoute],
  ["GET", "/company/current-profile", companyCurrentProfileRoute],
  ["GET", "/company/dashboard", companyDashboardRoute],
  ["GET", "/company/dashboard/management", companyDashboardManagementRoute],
  [
    "GET",
    "/company/definition-resource-adoptions/:commandId",
    companyDefinitionResourceAdoptionsCommandIdRoute,
  ],
  ["GET", "/company/definitions", companyDefinitionsRoute],
  ["POST", "/company/definitions", companyDefinitionsRoute],
  ["GET", "/company/employee-directory", companyEmployeeDirectoryRoute],
  ["GET", "/company/employee-directory/:code", companyEmployeeDirectoryCodeRoute],
  ["PUT", "/company/employee-directory/:code", companyEmployeeDirectoryCodeRoute],
  ["GET", "/company/employee-lifecycle/:code/events", companyEmployeeLifecycleCodeEventsRoute],
  ["GET", "/company/employee-lifecycle/:code/state", companyEmployeeLifecycleCodeStateRoute],
  ["POST", "/company/employee-registrations", companyEmployeeRegistrationsRoute],
  [
    "POST",
    "/company/employee-resource-adoption-batches",
    companyEmployeeResourceAdoptionBatchesRoute,
  ],
  ["GET", "/company/employee-resource-adoptions", companyEmployeeResourceAdoptionsRoute],
  ["POST", "/company/employee-resource-adoptions", companyEmployeeResourceAdoptionsRoute],
  ["GET", "/company/employees", companyEmployeesRoute],
  ["POST", "/company/employees", companyEmployeesRoute],
  ["GET", "/company/employment-start-corrections", companyEmploymentStartCorrectionsRoute],
  ["POST", "/company/employment-start-corrections", companyEmploymentStartCorrectionsRoute],
  ["GET", "/company/employments", companyEmploymentsRoute],
  ["POST", "/company/employments", companyEmploymentsRoute],
  ["POST", "/company/external-identity-imports", companyExternalIdentityImportsRoute],
  ["GET", "/company/features", companyFeaturesRoute],
  ["GET", "/company/grade-assignment-history", companyGradeAssignmentHistoryRoute],
  [
    "GET",
    "/company/grade-award-archives/by-employee/:employeeId",
    companyGradeAwardArchivesByEmployeeEmployeeIdRoute,
  ],
  ["GET", "/company/grade-award-archives/:commandId", companyGradeAwardArchivesCommandIdRoute],
  ["GET", "/company/inbox/counts", companyInboxCountsRoute],
  ["GET", "/company/legacy-personnel-action-records", companyLegacyPersonnelActionRecordsRoute],
  ["GET", "/company/my-direct-reports", companyMyDirectReportsRoute],
  ["GET", "/company/my-organization-units", companyMyOrganizationUnitsRoute],
  ["GET", "/company/my-profile", companyMyProfileRoute],
  ["PUT", "/company/my-profile", companyMyProfileRoute],
  ["POST", "/company/notifications", companyNotificationsRoute],
  ["POST", "/company/organization-changes", companyOrganizationChangesRoute],
  ["GET", "/company/organization-profile", companyOrganizationProfileRoute],
  ["PUT", "/company/organization-profile", companyOrganizationProfileRoute],
  ["GET", "/company/organization-resource-adoptions", companyOrganizationResourceAdoptionsRoute],
  ["POST", "/company/organization-resource-adoptions", companyOrganizationResourceAdoptionsRoute],
  ["GET", "/company/organization-snapshots", companyOrganizationSnapshotsRoute],
  ["GET", "/company/organization-tree", companyOrganizationTreeRoute],
  ["GET", "/company/organization-units", companyOrganizationUnitsRoute],
  ["POST", "/company/organization-units", companyOrganizationUnitsRoute],
  ["GET", "/company/organization-units/:code", companyOrganizationUnitsCodeRoute],
  ["PUT", "/company/organization-units/:code", companyOrganizationUnitsCodeRoute],
  ["DELETE", "/company/organization-units/:code", companyOrganizationUnitsCodeRoute],
  ["GET", "/company/organization-units/:code/members", companyOrganizationUnitsCodeMembersRoute],
  ["GET", "/company/people", companyPeopleRoute],
  ["POST", "/company/people", companyPeopleRoute],
  ["POST", "/company/personal-data-erasure-requests", companyPersonalDataErasureRequestsRoute],
  [
    "POST",
    "/company/personal-data-erasure-requests/:id/execute",
    companyPersonalDataErasureRequestsIdExecuteRoute,
  ],
  ["GET", "/company/personnel-action-events", companyPersonnelActionEventsRoute],
  ["POST", "/company/personnel-action-executions", companyPersonnelActionExecutionsRoute],
  ["GET", "/company/personnel-action-requests", companyPersonnelActionRequestsRoute],
  ["POST", "/company/personnel-action-requests", companyPersonnelActionRequestsRoute],
  ["GET", "/company/personnel-actions", companyPersonnelActionsRoute],
  ["GET", "/company/personnel-annotations", companyPersonnelAnnotationsRoute],
  ["GET", "/company/profile", companyProfileRoute],
  ["POST", "/company/profile", companyProfileRoute],
  ["GET", "/company/reporting-lines/:employeeCode", companyReportingLinesEmployeeCodeRoute],
  ["GET", "/company/resource-history/:type/:id", companyResourceHistoryTypeIdRoute],
  [
    "GET",
    "/company/responsibility-resource-adoptions",
    companyResponsibilityResourceAdoptionsRoute,
  ],
  [
    "POST",
    "/company/responsibility-resource-adoptions",
    companyResponsibilityResourceAdoptionsRoute,
  ],
  ["GET", "/company/workforce-connection-completions", companyWorkforceConnectionCompletionsRoute],
  ["POST", "/company/workforce-connection-completions", companyWorkforceConnectionCompletionsRoute],
  ["GET", "/system/accounts", systemAccountsRoute],
  ["POST", "/system/accounts", systemAccountsRoute],
  ["GET", "/system/accounts/:accountId", systemAccountsAccountIdRoute],
  ["PATCH", "/system/accounts/:accountId", systemAccountsAccountIdRoute],
  ["GET", "/system/accounts/:accountId/identities", systemAccountsAccountIdIdentitiesRoute],
  ["POST", "/system/accounts/:accountId/identities", systemAccountsAccountIdIdentitiesRoute],
  [
    "GET",
    "/system/accounts/:accountId/identities/:identityId",
    systemAccountsAccountIdIdentitiesIdentityIdRoute,
  ],
  [
    "DELETE",
    "/system/accounts/:accountId/identities/:identityId",
    systemAccountsAccountIdIdentitiesIdentityIdRoute,
  ],
  [
    "PATCH",
    "/system/accounts/:accountId/password-credentials",
    systemAccountsAccountIdPasswordCredentialsRoute,
  ],
  ["GET", "/system/accounts/:accountId/role-bindings", systemAccountsAccountIdRoleBindingsRoute],
  ["POST", "/system/accounts/:accountId/role-bindings", systemAccountsAccountIdRoleBindingsRoute],
  [
    "DELETE",
    "/system/accounts/:accountId/role-bindings/:bindingId",
    systemAccountsAccountIdRoleBindingsBindingIdRoute,
  ],
  ["POST", "/system/attachments", systemAttachmentsRoute],
  ["POST", "/system/attachments/purge-unlinked", systemAttachmentsPurgeUnlinkedRoute],
  ["GET", "/system/attachments/:attachmentId", systemAttachmentsAttachmentIdRoute],
  [
    "GET",
    "/system/attachments/:attachmentId/preservations",
    systemAttachmentsAttachmentIdPreservationsRoute,
  ],
  [
    "POST",
    "/system/attachments/:attachmentId/preservations",
    systemAttachmentsAttachmentIdPreservationsRoute,
  ],
  [
    "POST",
    "/system/attachments/:attachmentId/preservations/:preservationId/release",
    systemAttachmentsAttachmentIdPreservationsPreservationIdReleaseRoute,
  ],
  ["GET", "/system/audit-disclosure-policies", systemAuditDisclosurePoliciesRoute],
  ["POST", "/system/audit-disclosure-policies", systemAuditDisclosurePoliciesRoute],
  ["GET", "/system/audit-events", systemAuditEventsRoute],
  ["GET", "/system/audit-events/:eventId", systemAuditEventsEventIdRoute],
  ["POST", "/system/auth/password/reset", systemAuthPasswordResetRoute],
  ["PATCH", "/system/auth/password/reset", systemAuthPasswordResetRoute],
  ["GET", "/system/batch-jobs", systemBatchJobsRoute],
  ["POST", "/system/bootstrap", systemBootstrapRoute],
  ["POST", "/system/browser-login-codes", systemBrowserLoginCodesRoute],
  ["POST", "/system/browser-sessions", systemBrowserSessionsRoute],
  ["GET", "/system/cli-authorization-callback", systemCliAuthorizationCallbackRoute],
  ["GET", "/system/cli-authorizations", systemCliAuthorizationsRoute],
  ["POST", "/system/cli-sessions", systemCliSessionsRoute],
  ["GET", "/system/connectors", systemConnectorsRoute],
  ["POST", "/system/connectors", systemConnectorsRoute],
  ["PATCH", "/system/connectors/:connectorId", systemConnectorsConnectorIdRoute],
  ["GET", "/system/dead-letters", systemDeadLettersRoute],
  ["POST", "/system/dead-letters/:deadLetterId/requeue", systemDeadLettersDeadLetterIdRequeueRoute],
  ["GET", "/system/deliveries", systemDeliveriesRoute],
  ["POST", "/system/deliveries", systemDeliveriesRoute],
  ["PATCH", "/system/deliveries/:deliveryId", systemDeliveriesDeliveryIdRoute],
  ["GET", "/system/health", systemHealthRoute],
  ["POST", "/system/identity-sessions", systemIdentitySessionsRoute],
  ["PATCH", "/system/inbox-messages/:messageId", systemInboxMessagesMessageIdRoute],
  ["GET", "/system/integration-exchanges", systemIntegrationExchangesRoute],
  ["POST", "/system/integration-exchanges", systemIntegrationExchangesRoute],
  ["GET", "/system/integration-exchanges/:exchangeId", systemIntegrationExchangesExchangeIdRoute],
  ["PATCH", "/system/integration-exchanges/:exchangeId", systemIntegrationExchangesExchangeIdRoute],
  [
    "GET",
    "/system/integration-exchanges/:exchangeId/reconciliations",
    systemIntegrationExchangesExchangeIdReconciliationsRoute,
  ],
  [
    "POST",
    "/system/integration-exchanges/:exchangeId/reconciliations",
    systemIntegrationExchangesExchangeIdReconciliationsRoute,
  ],
  ["POST", "/system/machine-sessions", systemMachineSessionsRoute],
  ["GET", "/system/notifications", systemNotificationsRoute],
  ["POST", "/system/notifications", systemNotificationsRoute],
  ["PATCH", "/system/notifications", systemNotificationsRoute],
  ["GET", "/system/notifications/unread-count", systemNotificationsUnreadCountRoute],
  ["GET", "/system/notifications/:id", systemNotificationsIdRoute],
  ["PATCH", "/system/notifications/:id", systemNotificationsIdRoute],
  ["DELETE", "/system/notifications/:id", systemNotificationsIdRoute],
  ["POST", "/system/oauth/authorizations", systemOauthAuthorizationsRoute],
  ["POST", "/system/oauth/mcp-grants", systemOauthMcpGrantsRoute],
  ["POST", "/system/oauth/token", systemOauthTokenRoute],
  ["GET", "/system/oauth/userinfo", systemOauthUserinfoRoute],
  ["GET", "/system/permission-definitions", systemPermissionDefinitionsRoute],
  ["GET", "/system/preserved-records", systemPreservedRecordsRoute],
  [
    "GET",
    "/system/preserved-records/:recordId/content",
    systemPreservedRecordsRecordIdContentRoute,
  ],
  [
    "GET",
    "/system/preserved-records/:recordId/dossier",
    systemPreservedRecordsRecordIdDossierRoute,
  ],
  ["GET", "/system/principals", systemPrincipalsRoute],
  ["POST", "/system/principals", systemPrincipalsRoute],
  ["GET", "/system/principals/:principalId", systemPrincipalsPrincipalIdRoute],
  ["PATCH", "/system/principals/:principalId", systemPrincipalsPrincipalIdRoute],
  [
    "GET",
    "/system/principals/:principalId/machine-credentials",
    systemPrincipalsPrincipalIdMachineCredentialsRoute,
  ],
  [
    "POST",
    "/system/principals/:principalId/machine-credentials",
    systemPrincipalsPrincipalIdMachineCredentialsRoute,
  ],
  [
    "DELETE",
    "/system/principals/:principalId/machine-credentials/:credentialId",
    systemPrincipalsPrincipalIdMachineCredentialsCredentialIdRoute,
  ],
  ["GET", "/system/proposals/:number/versions/:version", systemProposalsNumberVersionsVersionRoute],
  ["GET", "/system/roles", systemRolesRoute],
  ["POST", "/system/roles", systemRolesRoute],
  ["GET", "/system/roles/:roleId", systemRolesRoleIdRoute],
  ["PATCH", "/system/roles/:roleId", systemRolesRoleIdRoute],
  ["DELETE", "/system/roles/:roleId", systemRolesRoleIdRoute],
  ["POST", "/system/sessions", systemSessionsRoute],
  ["PATCH", "/system/sessions", systemSessionsRoute],
  ["DELETE", "/system/sessions", systemSessionsRoute],
  ["POST", "/system/step-up-grants", systemStepUpGrantsRoute],
  ["GET", "/system/work-items", systemWorkItemsRoute],
  ["POST", "/system/work-items", systemWorkItemsRoute],
  ["GET", "/system/work-items/:id", systemWorkItemsIdRoute],
  ["POST", "/system/work-items/:id/accept", systemWorkItemsIdAcceptRoute],
  ["POST", "/system/work-items/:id/approve", systemWorkItemsIdApproveRoute],
  ["POST", "/system/work-items/:id/cancel", systemWorkItemsIdCancelRoute],
  [
    "GET",
    "/system/work-items/:id/evidence/:attachmentId",
    systemWorkItemsIdEvidenceAttachmentIdRoute,
  ],
  ["POST", "/system/work-items/:id/handovers", systemWorkItemsIdHandoversRoute],
  ["POST", "/system/work-items/:id/handovers/accept", systemWorkItemsIdHandoversAcceptRoute],
  ["POST", "/system/work-items/:id/handovers/decline", systemWorkItemsIdHandoversDeclineRoute],
  ["GET", "/system/work-items/:id/history", systemWorkItemsIdHistoryRoute],
  ["POST", "/system/work-items/:id/results", systemWorkItemsIdResultsRoute],
  ["POST", "/system/work-items/:id/return", systemWorkItemsIdReturnRoute],
]

export function createRuntimeApp() {
  const app = createAppBase()
  for (const [method, path, load] of ROUTES) {
    app.on(method, path, lazyRouteHandlers(load, method))
  }
  return app
}
