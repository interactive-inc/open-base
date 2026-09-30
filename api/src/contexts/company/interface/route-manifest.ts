/** canonical Company APIの宣言的な正本。API rootだけがHTTP runtimeへ合成する。 */
export const companyRouteManifest = [
  {
    method: "GET",
    path: "/company/changes",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.changes",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/resource-history/:type/:id",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.resource-history.$type.$id",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/grade-assignment-history",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.grade-assignment-history",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/employment-start-corrections",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employment-start-corrections",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/employment-start-corrections",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employment-start-corrections",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/grade-award-archives/by-employee/:employeeId",
    phase: "authenticated",
    handler: {
      kind: "module",
      module:
        "@/contexts/company/interface/routes/company.grade-award-archives.by-employee.$employeeId",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/grade-award-archives/:commandId",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.grade-award-archives.$commandId",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/definition-resource-adoptions/:commandId",
    phase: "authenticated",
    handler: {
      kind: "module",
      module:
        "@/contexts/company/interface/routes/company.definition-resource-adoptions.$commandId",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/employee-resource-adoption-batches",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employee-resource-adoption-batches",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/responsibility-resource-adoptions",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.responsibility-resource-adoptions",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/responsibility-resource-adoptions",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.responsibility-resource-adoptions",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/personnel-action-events",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.personnel-action-events",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/assignment-resource-adoptions",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.assignment-resource-adoptions",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/assignment-resource-adoptions",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.assignment-resource-adoptions",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/organization-resource-adoptions",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-resource-adoptions",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/organization-resource-adoptions",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-resource-adoptions",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/employee-resource-adoptions",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employee-resource-adoptions",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/employee-resource-adoptions",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employee-resource-adoptions",
      exportName: "POST",
    },
  },

  {
    method: "POST",
    path: "/company/external-identity-imports",
    phase: "public",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.external-identity-imports",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/company/authority-resolutions",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.authority-resolutions",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/organization-profile",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-profile",
      exportName: "GET",
    },
  },
  {
    method: "PUT",
    path: "/company/organization-profile",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-profile",
      exportName: "PUT",
    },
  },
  {
    method: "GET",
    path: "/company/workforce-connection-completions",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.workforce-connection-completions",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/workforce-connection-completions",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.workforce-connection-completions",
      exportName: "POST",
    },
  },
  {
    method: "POST",
    path: "/company/bootstrap",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.bootstrap",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/capabilities",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.capabilities",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/profile",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.profile",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/profile",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.profile",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/people",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.people",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/people",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.people",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/employees",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employees",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/employees",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employees",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/employee-directory",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employee-directory",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/employee-directory/:code",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employee-directory.$code",
      exportName: "GET",
    },
  },
  {
    method: "PUT",
    path: "/company/employee-directory/:code",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employee-directory.$code",
      exportName: "PUT",
    },
  },
  {
    method: "GET",
    path: "/company/employee-lifecycle/:code/state",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employee-lifecycle.$code.state",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/employee-lifecycle/:code/events",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employee-lifecycle.$code.events",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/my-profile",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.my-profile",
      exportName: "GET",
    },
  },
  {
    method: "PUT",
    path: "/company/my-profile",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.my-profile",
      exportName: "PUT",
    },
  },
  {
    method: "GET",
    path: "/company/my-direct-reports",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.my-direct-reports",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/my-organization-units",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.my-organization-units",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/personnel-annotations",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.personnel-annotations",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/organization-units",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-units",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/organization-units",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-units",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/organization-units/:code",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-units.$code",
      exportName: "GET",
    },
  },
  {
    method: "PUT",
    path: "/company/organization-units/:code",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-units.$code",
      exportName: "PUT",
    },
  },
  {
    method: "DELETE",
    path: "/company/organization-units/:code",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-units.$code",
      exportName: "DELETE",
    },
  },
  {
    method: "GET",
    path: "/company/organization-units/:code/members",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-units.$code.members",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/organization-tree",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-tree",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/reporting-lines/:employeeCode",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.reporting-lines.$employeeCode",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/employments",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employments",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/employments",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.employments",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/organization-snapshots",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-snapshots",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/organization-changes",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.organization-changes",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/definitions",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.definitions",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/definitions",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.definitions",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/account-employee-links",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.account-employee-links",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/account-employee-links",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.account-employee-links",
      exportName: "POST",
    },
  },
  {
    method: "GET",
    path: "/company/legacy-personnel-action-records",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.legacy-personnel-action-records",
      exportName: "GET",
    },
  },
  {
    method: "GET",
    path: "/company/personnel-actions",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.personnel-actions",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/company/personnel-action-executions",
    phase: "audited",
    handler: {
      kind: "module",
      module: "@/contexts/company/interface/routes/company.personnel-action-executions",
      exportName: "POST",
    },
  },
] as const
