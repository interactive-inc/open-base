/** 公開routeの宣言的な正本。API rootの生成器だけが合成する。 */
export const systemRouteManifest = [
  {
    method: "GET",
    path: "/system/preserved-records/:recordId/dossier",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.preserved-records.$recordId.dossier",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/system/preserved-records",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.preserved-records",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/system/preserved-records/:recordId/content",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.preserved-records.$recordId.content",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/system/proposals/:number/versions/:version",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.proposals.$number.versions.$version",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/work-items/:id/accept",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.work-items.$id.accept",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/work-items/:id/approve",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.work-items.$id.approve",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/work-items/:id/cancel",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.work-items.$id.cancel",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/work-items/:id/evidence/:attachmentId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.work-items.$id.evidence.$attachmentId",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/work-items/:id/handovers/accept",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.work-items.$id.handovers.accept",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/work-items/:id/handovers/decline",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.work-items.$id.handovers.decline",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/work-items/:id/handovers",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.work-items.$id.handovers",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/work-items/:id/history",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.work-items.$id.history",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/work-items/:id/results",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.work-items.$id.results",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/work-items/:id/return",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.work-items.$id.return",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/work-items/:id",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.work-items.$id",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/work-items",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.work-items",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/work-items",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.work-items",
      exportName: "GET",
    },
  },

  {
    method: "GET",
    path: "/system/audit-disclosure-policies",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.audit-disclosure-policies",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/audit-disclosure-policies",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.audit-disclosure-policies",
      exportName: "POST",
    },
  },

  {
    method: "GET",
    path: "/system/attachments/:attachmentId/preservations",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.attachments.$attachmentId.preservations",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/attachments/:attachmentId/preservations",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.attachments.$attachmentId.preservations",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/attachments/:attachmentId/preservations/:preservationId/release",
    phase: "public",
    handler: {
      kind: "module",
      module:
        "@system/interface/routes/system.attachments.$attachmentId.preservations.$preservationId.release",
      exportName: "POST",
    },
  },

  {
    method: "POST",
    path: "/system/dead-letters/:deadLetterId/requeue",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.dead-letters.$deadLetterId.requeue",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/dead-letters",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.dead-letters",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/system/deliveries",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.deliveries",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/deliveries",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.deliveries",
      exportName: "POST",
    },
  },
  {
    method: "PATCH",
    path: "/system/deliveries/:deliveryId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.deliveries.$deliveryId",
      exportName: "PATCH",
    },
  },
  {
    method: "PATCH",
    path: "/system/inbox-messages/:messageId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.inbox-messages.$messageId",
      exportName: "PATCH",
    },
  },
  {
    method: "POST",
    path: "/system/machine-sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.machine-sessions",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/principals",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.principals",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/principals",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.principals",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/principals/:principalId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.principals.$principalId",
      exportName: "GET",
    },
  },
  {
    method: "PATCH",
    path: "/system/principals/:principalId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.principals.$principalId",
      exportName: "PATCH",
    },
  },
  {
    method: "GET",
    path: "/system/principals/:principalId/machine-credentials",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.principals.$principalId.machine-credentials",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/principals/:principalId/machine-credentials",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.principals.$principalId.machine-credentials",
      exportName: "POST",
    },
  },
  {
    method: "DELETE",
    path: "/system/principals/:principalId/machine-credentials/:credentialId",
    phase: "public",
    handler: {
      kind: "module",
      module:
        "@system/interface/routes/system.principals.$principalId.machine-credentials.$credentialId",
      exportName: "DELETE",
    },
  },
  {
    method: "POST",
    path: "/system/step-up-grants",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.step-up-grants",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/connectors",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.connectors",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/connectors",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.connectors",
      exportName: "POST",
    },
  },
  {
    method: "PATCH",
    path: "/system/connectors/:connectorId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.connectors.$connectorId",
      exportName: "PATCH",
    },
  },
  {
    method: "GET",
    path: "/system/integration-exchanges",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.integration-exchanges",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/integration-exchanges",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.integration-exchanges",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/integration-exchanges/:exchangeId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.integration-exchanges.$exchangeId",
      exportName: "GET",
    },
  },
  {
    method: "PATCH",
    path: "/system/integration-exchanges/:exchangeId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.integration-exchanges.$exchangeId",
      exportName: "PATCH",
    },
  },
  {
    method: "GET",
    path: "/system/integration-exchanges/:exchangeId/reconciliations",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.integration-exchanges.$exchangeId.reconciliations",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/integration-exchanges/:exchangeId/reconciliations",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.integration-exchanges.$exchangeId.reconciliations",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/attachments",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.attachments",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/attachments/:attachmentId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.attachments.$attachmentId",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/system/health",
    phase: "pre-database",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.health",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.sessions",
      exportName: "POST",
    },
  },
  {
    method: "PATCH",
    path: "/system/sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.sessions",
      exportName: "PATCH",
    },
  },
  {
    method: "DELETE",
    path: "/system/sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.sessions",
      exportName: "DELETE",
    },
  },
  {
    method: "GET",
    path: "/system/accounts",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/accounts",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/accounts/:accountId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId",
      exportName: "GET",
    },
  },
  {
    method: "PATCH",
    path: "/system/accounts/:accountId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId",
      exportName: "PATCH",
    },
  },
  {
    method: "GET",
    path: "/system/accounts/:accountId/identities",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId.identities",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/accounts/:accountId/identities",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId.identities",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/accounts/:accountId/identities/:identityId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId.identities.$identityId",
      exportName: "GET",
    },
  },
  {
    method: "DELETE",
    path: "/system/accounts/:accountId/identities/:identityId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId.identities.$identityId",
      exportName: "DELETE",
    },
  },
  {
    method: "PATCH",
    path: "/system/accounts/:accountId/password-credentials",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId.password-credentials",
      exportName: "PATCH",
    },
  },
  {
    method: "GET",
    path: "/system/accounts/:accountId/role-bindings",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId.role-bindings",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/accounts/:accountId/role-bindings",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId.role-bindings",
      exportName: "POST",
    },
  },
  {
    method: "DELETE",
    path: "/system/accounts/:accountId/role-bindings/:bindingId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.accounts.$accountId.role-bindings.$bindingId",
      exportName: "DELETE",
    },
  },
  {
    method: "POST",
    path: "/system/bootstrap",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.bootstrap",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/batch-jobs",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.batch-jobs",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/attachments/purge-unlinked",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.attachments.purge-unlinked",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/browser-login-codes",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.browser-login-codes",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/browser-sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.browser-sessions",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/cli-authorization-callback",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.cli-authorization-callback",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/system/cli-authorizations",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.cli-authorizations",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/cli-sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.cli-sessions",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/identity-sessions",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.identity-sessions",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/roles",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.roles",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/roles",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.roles",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/roles/:roleId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.roles.$roleId",
      exportName: "GET",
    },
  },
  {
    method: "PATCH",
    path: "/system/roles/:roleId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.roles.$roleId",
      exportName: "PATCH",
    },
  },
  {
    method: "DELETE",
    path: "/system/roles/:roleId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.roles.$roleId",
      exportName: "DELETE",
    },
  },

  {
    method: "GET",
    path: "/system/notifications",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.notifications",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/notifications",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.notifications",
      exportName: "POST",
    },
  },
  {
    method: "PATCH",
    path: "/system/notifications",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.notifications",
      exportName: "PATCH",
    },
  },
  {
    method: "GET",
    path: "/system/notifications/unread-count",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.notifications.unread-count",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/system/notifications/:id",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.notifications.$id",
      exportName: "GET",
    },
  },
  {
    method: "PATCH",
    path: "/system/notifications/:id",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.notifications.$id",
      exportName: "PATCH",
    },
  },
  {
    method: "DELETE",
    path: "/system/notifications/:id",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.notifications.$id",
      exportName: "DELETE",
    },
  },
  {
    method: "GET",
    path: "/system/audit-events",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.audit-events",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/system/audit-events/:eventId",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.audit-events.$eventId",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/auth/password/reset",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.auth.password.reset",
      exportName: "POST",
    },
  },
  {
    method: "PATCH",
    path: "/system/auth/password/reset",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.auth.password.reset",
      exportName: "PATCH",
    },
  },
  {
    method: "POST",
    path: "/system/oauth/token",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.oauth.token",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/system/oauth/userinfo",
    phase: "public",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.oauth.userinfo",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/system/oauth/authorizations",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.oauth.authorizations",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/system/oauth/mcp-grants",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@system/interface/routes/system.oauth.mcp-grants",
      exportName: "POST",
    },
  },
] as const
