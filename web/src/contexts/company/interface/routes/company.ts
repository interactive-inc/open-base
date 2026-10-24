import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { Hono } from "hono"
import * as accountEmployeeLinks from "@/contexts/company/interface/routes/company.account-employee-links"
import * as assignmentResourceAdoptions from "@/contexts/company/interface/routes/company.assignment-resource-adoptions"
import * as authorityResolutions from "@/contexts/company/interface/routes/company.authority-resolutions"
import * as bootstrap from "@/contexts/company/interface/routes/company.bootstrap"
import * as capabilities from "@/contexts/company/interface/routes/company.capabilities"
import * as changes from "@/contexts/company/interface/routes/company.changes"
import * as definitionResourceAdoptionsCommandId from "@/contexts/company/interface/routes/company.definition-resource-adoptions.$commandId"
import * as definitions from "@/contexts/company/interface/routes/company.definitions"
import * as employeeDirectory from "@/contexts/company/interface/routes/company.employee-directory"
import * as employeeDirectoryCode from "@/contexts/company/interface/routes/company.employee-directory.$code"
import * as employeeLifecycleCodeEvents from "@/contexts/company/interface/routes/company.employee-lifecycle.$code.events"
import * as employeeLifecycleCodeState from "@/contexts/company/interface/routes/company.employee-lifecycle.$code.state"
import * as employeeResourceAdoptionBatches from "@/contexts/company/interface/routes/company.employee-resource-adoption-batches"
import * as employeeResourceAdoptions from "@/contexts/company/interface/routes/company.employee-resource-adoptions"
import * as employees from "@/contexts/company/interface/routes/company.employees"
import * as employmentStartCorrections from "@/contexts/company/interface/routes/company.employment-start-corrections"
import * as employments from "@/contexts/company/interface/routes/company.employments"
import * as externalIdentityImports from "@/contexts/company/interface/routes/company.external-identity-imports"
import * as gradeAssignmentHistory from "@/contexts/company/interface/routes/company.grade-assignment-history"
import * as gradeAwardArchivesCommandId from "@/contexts/company/interface/routes/company.grade-award-archives.$commandId"
import * as gradeAwardArchivesByEmployeeEmployeeId from "@/contexts/company/interface/routes/company.grade-award-archives.by-employee.$employeeId"
import * as legacyPersonnelActionRecords from "@/contexts/company/interface/routes/company.legacy-personnel-action-records"
import * as myDirectReports from "@/contexts/company/interface/routes/company.my-direct-reports"
import * as myOrganizationUnits from "@/contexts/company/interface/routes/company.my-organization-units"
import * as myProfile from "@/contexts/company/interface/routes/company.my-profile"
import * as organizationChanges from "@/contexts/company/interface/routes/company.organization-changes"
import * as organizationProfile from "@/contexts/company/interface/routes/company.organization-profile"
import * as organizationResourceAdoptions from "@/contexts/company/interface/routes/company.organization-resource-adoptions"
import * as organizationSnapshots from "@/contexts/company/interface/routes/company.organization-snapshots"
import * as organizationTree from "@/contexts/company/interface/routes/company.organization-tree"
import * as organizationUnits from "@/contexts/company/interface/routes/company.organization-units"
import * as organizationUnitsCode from "@/contexts/company/interface/routes/company.organization-units.$code"
import * as organizationUnitsCodeMembers from "@/contexts/company/interface/routes/company.organization-units.$code.members"
import * as people from "@/contexts/company/interface/routes/company.people"
import * as personnelActionEvents from "@/contexts/company/interface/routes/company.personnel-action-events"
import * as personnelActionExecutions from "@/contexts/company/interface/routes/company.personnel-action-executions"
import * as personnelActions from "@/contexts/company/interface/routes/company.personnel-actions"
import * as personnelAnnotations from "@/contexts/company/interface/routes/company.personnel-annotations"
import * as profile from "@/contexts/company/interface/routes/company.profile"
import * as reportingLinesEmployeeCode from "@/contexts/company/interface/routes/company.reporting-lines.$employeeCode"
import * as resourceHistoryTypeId from "@/contexts/company/interface/routes/company.resource-history.$type.$id"
import * as responsibilityResourceAdoptions from "@/contexts/company/interface/routes/company.responsibility-resource-adoptions"
import * as workforceConnectionCompletions from "@/contexts/company/interface/routes/company.workforce-connection-completions"

// `bun run gen:app` の生成物。手で編集せず、routeは所有contextのinterface/route-manifest.tsへ足す。
export const companyPublicRoutes = new Hono<CompanyHttpEnvironment>().post(
  "/external-identity-imports",
  ...externalIdentityImports.POST,
)

export const companyAuthenticatedRoutes = new Hono<CompanyHttpEnvironment>()
  .get("/account-employee-links", ...accountEmployeeLinks.GET)
  .get("/assignment-resource-adoptions", ...assignmentResourceAdoptions.GET)
  .post("/authority-resolutions", ...authorityResolutions.POST)
  .post("/bootstrap", ...bootstrap.POST)
  .get("/capabilities", ...capabilities.GET)
  .get("/changes", ...changes.GET)
  .get("/definition-resource-adoptions/:commandId", ...definitionResourceAdoptionsCommandId.GET)
  .get("/definitions", ...definitions.GET)
  .get("/employee-directory", ...employeeDirectory.GET)
  .get("/employee-directory/:code", ...employeeDirectoryCode.GET)
  .get("/employee-lifecycle/:code/events", ...employeeLifecycleCodeEvents.GET)
  .get("/employee-lifecycle/:code/state", ...employeeLifecycleCodeState.GET)
  .get("/employee-resource-adoptions", ...employeeResourceAdoptions.GET)
  .get("/employees", ...employees.GET)
  .get("/employment-start-corrections", ...employmentStartCorrections.GET)
  .get("/employments", ...employments.GET)
  .get("/grade-assignment-history", ...gradeAssignmentHistory.GET)
  .get(
    "/grade-award-archives/by-employee/:employeeId",
    ...gradeAwardArchivesByEmployeeEmployeeId.GET,
  )
  .get("/grade-award-archives/:commandId", ...gradeAwardArchivesCommandId.GET)
  .get("/legacy-personnel-action-records", ...legacyPersonnelActionRecords.GET)
  .get("/my-direct-reports", ...myDirectReports.GET)
  .get("/my-organization-units", ...myOrganizationUnits.GET)
  .get("/my-profile", ...myProfile.GET)
  .get("/organization-profile", ...organizationProfile.GET)
  .get("/organization-resource-adoptions", ...organizationResourceAdoptions.GET)
  .get("/organization-snapshots", ...organizationSnapshots.GET)
  .get("/organization-tree", ...organizationTree.GET)
  .get("/organization-units", ...organizationUnits.GET)
  .get("/organization-units/:code", ...organizationUnitsCode.GET)
  .get("/organization-units/:code/members", ...organizationUnitsCodeMembers.GET)
  .get("/people", ...people.GET)
  .get("/personnel-action-events", ...personnelActionEvents.GET)
  .get("/personnel-actions", ...personnelActions.GET)
  .get("/personnel-annotations", ...personnelAnnotations.GET)
  .get("/profile", ...profile.GET)
  .get("/reporting-lines/:employeeCode", ...reportingLinesEmployeeCode.GET)
  .get("/resource-history/:type/:id", ...resourceHistoryTypeId.GET)
  .get("/workforce-connection-completions", ...workforceConnectionCompletions.GET)

export const companyAuditedRoutes = new Hono<CompanyHttpEnvironment>()
  .post("/account-employee-links", ...accountEmployeeLinks.POST)
  .post("/assignment-resource-adoptions", ...assignmentResourceAdoptions.POST)
  .post("/definitions", ...definitions.POST)
  .put("/employee-directory/:code", ...employeeDirectoryCode.PUT)
  .post("/employee-resource-adoption-batches", ...employeeResourceAdoptionBatches.POST)
  .post("/employee-resource-adoptions", ...employeeResourceAdoptions.POST)
  .post("/employees", ...employees.POST)
  .post("/employment-start-corrections", ...employmentStartCorrections.POST)
  .post("/employments", ...employments.POST)
  .put("/my-profile", ...myProfile.PUT)
  .post("/organization-changes", ...organizationChanges.POST)
  .put("/organization-profile", ...organizationProfile.PUT)
  .post("/organization-resource-adoptions", ...organizationResourceAdoptions.POST)
  .post("/organization-units", ...organizationUnits.POST)
  .put("/organization-units/:code", ...organizationUnitsCode.PUT)
  .delete("/organization-units/:code", ...organizationUnitsCode.DELETE)
  .post("/people", ...people.POST)
  .post("/personnel-action-executions", ...personnelActionExecutions.POST)
  .post("/profile", ...profile.POST)
  .get("/responsibility-resource-adoptions", ...responsibilityResourceAdoptions.GET)
  .post("/responsibility-resource-adoptions", ...responsibilityResourceAdoptions.POST)
  .post("/workforce-connection-completions", ...workforceConnectionCompletions.POST)
