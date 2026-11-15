import { pageApiReader } from "@/api/http/void-api-route"
import * as personnelActionRequestsRoute from "@/api/routes/company.personnel-action-requests"
import * as employeeDirectoryRoute from "@/contexts/company/interface/routes/company.employee-directory"
import * as employeeRoute from "@/contexts/company/interface/routes/company.employee-directory.$code"
import * as lifecycleEventsRoute from "@/contexts/company/interface/routes/company.employee-lifecycle.$code.events"
import * as lifecycleStateRoute from "@/contexts/company/interface/routes/company.employee-lifecycle.$code.state"
import * as myDirectReportsRoute from "@/contexts/company/interface/routes/company.my-direct-reports"
import * as myProfileRoute from "@/contexts/company/interface/routes/company.my-profile"
import * as organizationUnitsRoute from "@/contexts/company/interface/routes/company.organization-units"
import * as personnelActionsRoute from "@/contexts/company/interface/routes/company.personnel-actions"

/**
 * 従業員の画面のloaderが最初の表示のために読むAPI。
 * 型は画面の側が決める。ここは経路とhandlerの対応だけを持つ。
 */
export const readEmployeeDirectory = pageApiReader(
  "/company/employee-directory",
  employeeDirectoryRoute.GET,
)

export const readEmployee = pageApiReader("/company/employee-directory/:code", employeeRoute.GET)

export const readLifecycleState = pageApiReader(
  "/company/employee-lifecycle/:code/state",
  lifecycleStateRoute.GET,
)

export const readLifecycleEvents = pageApiReader(
  "/company/employee-lifecycle/:code/events",
  lifecycleEventsRoute.GET,
)

export const readOrganizationUnits = pageApiReader(
  "/company/organization-units",
  organizationUnitsRoute.GET,
)

export const readPersonnelActions = pageApiReader(
  "/company/personnel-actions",
  personnelActionsRoute.GET,
)

export const readPersonnelActionRequests = pageApiReader(
  "/company/personnel-action-requests",
  personnelActionRequestsRoute.GET,
)

export const readMyProfile = pageApiReader("/company/my-profile", myProfileRoute.GET)

export const readMyDirectReports = pageApiReader(
  "/company/my-direct-reports",
  myDirectReportsRoute.GET,
)
