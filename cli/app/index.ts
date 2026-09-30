import responsibilityAdoptionHandler from "@/app/employees/responsibility-adoption/route"
import workItemHandler from "@/app/work-items/route"
import assignmentAdoptionHandler from "@/app/employees/assignment-adoption/route"
import organizationAdoptionHandler from "@/app/departments/adoption/route"
import { HTTPException } from "hono/http-exception"
import { factory } from "@/factory"
import { loadConfig } from "@/lib/config/load-config"
import { toConnectionErrorMessage } from "@/lib/http/to-connection-error-message"
import appApproveHandler from "@/app/application-requests/approve/[app_id]/route"
import appHandler from "@/app/application-requests/route"
import appInboxHandler from "@/app/application-requests/inbox/route"
import appMineHandler from "@/app/application-requests/mine/route"
import appRejectHandler from "@/app/application-requests/reject/[app_id]/route"
import appShowHandler from "@/app/application-requests/show/[app_id]/route"
import appSubmitHandler from "@/app/application-requests/submit/[template_code]/route"
import appTemplateHandler from "@/app/application-requests/template/[code]/route"
import appTemplatesHandler from "@/app/application-requests/templates/route"
import batchHandler from "@/app/batch/route"
import dashboardHandler from "@/app/dashboard/route"
import dashboardManagementHandler from "@/app/dashboard/management/route"
import employeeHandler from "@/app/employees/route"
import employeeSearchHandler from "@/app/employees/search/route"
import gradesHandler from "@/app/grade-definitions/route"
import gradesListHandler from "@/app/grade-definitions/list/route"
import gradesCreateHandler from "@/app/grade-definitions/create/route"
import gradesUpdateHandler from "@/app/grade-definitions/update/route"
import gradesDeleteHandler from "@/app/grade-definitions/delete/route"
import gradesAssignmentsHandler from "@/app/employee-grades/list/route"
import gradesAssignHandler from "@/app/employee-grades/create/route"
import positionsHandler from "@/app/position-definitions/route"
import positionsListHandler from "@/app/position-definitions/list/route"
import positionsCreateHandler from "@/app/position-definitions/create/route"
import positionsUpdateHandler from "@/app/position-definitions/update/route"
import positionsDeleteHandler from "@/app/position-definitions/delete/route"
import employeeEventsHandler from "@/app/employee-events/route"
import employeeEventsListHandler from "@/app/employee-events/list/route"
import loginHandler from "@/app/login/route"
import bootstrapHandler from "@/app/bootstrap/route"
import notifyCountHandler from "@/app/notifications/count/route"
import notifyHandler from "@/app/notifications/route"
import notifyListHandler from "@/app/notifications/list/route"
import notifyReadAllHandler from "@/app/notifications/read-all/route"
import notifyReadHandler from "@/app/notifications/read/[notification_id]/route"
import notifySendHandler from "@/app/notifications/send/route"
import rolesHandler from "@/app/roles/route"
import accountsHandler from "@/app/accounts/route"
import orgHandler from "@/app/departments/route"
import orgLineHandler from "@/app/employees/reporting-line/[employee_code]/route"
import orgMembersHandler from "@/app/departments/members/[dept_code]/route"
import orgTreeHandler from "@/app/departments/tree/route"
import whoamiHandler from "@/app/whoami/route"
import appTemplateCreateHandler from "@/app/application-requests/template-create/route"
import appTemplateUpdateHandler from "@/app/application-requests/template-update/route"
import appTemplateDeleteHandler from "@/app/application-requests/template-delete/route"
import appWorkflowHandler from "@/app/application-requests/workflow/[code]/route"
import appWorkflowRepairListHandler from "@/app/application-requests/workflow-repair/list/route"
import appWorkflowRepairReassignHandler from "@/app/application-requests/workflow-repair/reassign/[app_id]/route"
import appResubmitHandler from "@/app/application-requests/resubmit/[app_id]/route"
import appDelegationsHandler from "@/app/application-requests/delegations/route"
import appDelegateHandler from "@/app/application-requests/delegate/route"
import appDelegationDeleteHandler from "@/app/application-requests/delegation-delete/[id]/route"
import appUpdateHandler from "@/app/application-requests/update/[app_id]/route"
import appWithdrawHandler from "@/app/application-requests/withdraw/[app_id]/route"
import employeeGradesRootHandler from "@/app/employee-grades/route"
import employeeRegisterHandler from "@/app/employees/register/route"
import employeeShowHandler from "@/app/employees/show/[employee_code]/route"
import employeeUpdateHandler from "@/app/employees/update/[employee_code]/route"
import employeeAdoptionHandler from "@/app/employees/adoption/route"
import employeeAdoptionBatchHandler from "@/app/employees/adoption-batch/route"
import employeeTimelineHandler from "@/app/employees/timeline/route"
import employeeStateHandler from "@/app/employees/state/route"
import personnelActionListHandler from "@/app/personnel-actions/list/route"
import personnelActionRequestHandler from "@/app/personnel-actions/request/route"
import personnelActionApplyHandler from "@/app/personnel-actions/apply/route"
import personnelActionCorrectHandler from "@/app/personnel-actions/correct/route"
import notifyDeleteHandler from "@/app/notifications/delete/route"
import notifyShowHandler from "@/app/notifications/show/route"
import orgDeptCreateHandler from "@/app/departments/create/route"
import orgDeptDeleteHandler from "@/app/departments/delete/route"
import orgDeptListHandler from "@/app/departments/list/route"
import orgDeptShowHandler from "@/app/departments/show/route"
import orgDeptUpdateHandler from "@/app/departments/update/route"

const base = factory.createApp()

base.onError(async (error, c) => {
  // ハンドラに到達して投げられたエラーであることを示すマーカー。
  // 未登録パスで Hono が返す素の 404 と、ハンドラ由来の 404 を index.ts で区別する。
  c.header("x-base-handler-error", "1")

  if (error instanceof HTTPException) {
    if (error.status === 401) {
      return c.text(
        `${error.message}\n認証されていません。'base login' でログインしてください。`,
        error.status,
      )
    }

    if (error.status === 403) {
      return c.text(`${error.message}\nこの操作を実行する権限がありません。`, error.status)
    }

    return c.text(error.message, error.status)
  }

  // HTTPException でない = API への接続失敗・タイムアウトなど。接続先を添えて案内する。
  const config = await loadConfig()

  const connectionMessage = toConnectionErrorMessage(error, config.base_url)

  if (connectionMessage !== null) {
    return c.text(connectionMessage, 500)
  }

  return c.text(error instanceof Error ? error.message : String(error), 500)
})

/**
 * すべて POST で登録する。位置引数は path param、`--flag value` は JSON body。
 * ファイル構造（routes/<path>/route.ts、Next.js App Router 記法）に対応する。
 */
const routes = base

routes.post("/login", ...loginHandler)
routes.post("/bootstrap", ...bootstrapHandler)
routes.post("/whoami", ...whoamiHandler)

routes.post("/employees", ...employeeHandler)
routes.post("/employees/search", ...employeeSearchHandler)

routes.post("/application-requests", ...appHandler)
routes.post("/application-requests/templates", ...appTemplatesHandler)
routes.post("/application-requests/template/:code?", ...appTemplateHandler)
routes.post("/application-requests/submit/:template_code?", ...appSubmitHandler)
routes.post("/application-requests/inbox", ...appInboxHandler)
routes.post("/application-requests/mine", ...appMineHandler)
routes.post("/application-requests/show/:app_id?", ...appShowHandler)
routes.post("/application-requests/approve/:app_id?", ...appApproveHandler)
routes.post("/application-requests/reject/:app_id?", ...appRejectHandler)

routes.post("/employee-grades", ...employeeGradesRootHandler)

routes.post("/work-items/:operation?/:id?", ...workItemHandler)

routes.post("/grade-definitions", ...gradesHandler)
routes.post("/grade-definitions/list", ...gradesListHandler)
routes.post("/grade-definitions/create", ...gradesCreateHandler)
routes.post("/grade-definitions/update", ...gradesUpdateHandler)
routes.post("/grade-definitions/delete", ...gradesDeleteHandler)
routes.post("/employee-grades/list", ...gradesAssignmentsHandler)
routes.post("/employee-grades/create", ...gradesAssignHandler)
routes.post("/position-definitions", ...positionsHandler)
routes.post("/position-definitions/list", ...positionsListHandler)
routes.post("/position-definitions/create", ...positionsCreateHandler)
routes.post("/position-definitions/update", ...positionsUpdateHandler)
routes.post("/position-definitions/delete", ...positionsDeleteHandler)

routes.post("/employee-events", ...employeeEventsHandler)
routes.post("/employee-events/list", ...employeeEventsListHandler)

routes.post("/notifications", ...notifyHandler)
routes.post("/notifications/list", ...notifyListHandler)
routes.post("/notifications/count", ...notifyCountHandler)
routes.post("/notifications/read-all", ...notifyReadAllHandler)
routes.post("/notifications/read/:notification_id?", ...notifyReadHandler)
routes.post("/notifications/send", ...notifySendHandler)

routes.post("/departments", ...orgHandler)
routes.post("/departments/tree", ...orgTreeHandler)
routes.post("/departments/members/:dept_code?", ...orgMembersHandler)
routes.post("/employees/reporting-line/:employee_code?", ...orgLineHandler)

routes.post("/roles", ...rolesHandler)
routes.post("/accounts", ...accountsHandler)

routes.post("/batch", ...batchHandler)
routes.post("/dashboard", ...dashboardHandler)
routes.post("/dashboard/management", ...dashboardManagementHandler)

routes.post("/application-requests/template-create", ...appTemplateCreateHandler)
routes.post("/application-requests/template-update", ...appTemplateUpdateHandler)
routes.post("/application-requests/template-delete", ...appTemplateDeleteHandler)
routes.post("/application-requests/workflow/:code?", ...appWorkflowHandler)
routes.post("/application-requests/workflow-repair/list", ...appWorkflowRepairListHandler)
routes.post(
  "/application-requests/workflow-repair/reassign/:app_id?",
  ...appWorkflowRepairReassignHandler,
)
routes.post("/application-requests/resubmit/:app_id?", ...appResubmitHandler)
routes.post("/application-requests/update/:app_id?", ...appUpdateHandler)
routes.post("/application-requests/withdraw/:app_id?", ...appWithdrawHandler)
routes.post("/application-requests/delegations", ...appDelegationsHandler)
routes.post("/application-requests/delegate", ...appDelegateHandler)
routes.post("/application-requests/delegation-delete/:id?", ...appDelegationDeleteHandler)

routes.post("/employees/register", ...employeeRegisterHandler)
routes.post("/employees/show/:employee_code?", ...employeeShowHandler)
routes.post("/employees/update/:employee_code?", ...employeeUpdateHandler)
routes.post("/employees/adoption", ...employeeAdoptionHandler)
routes.post("/employees/adoption-batch", ...employeeAdoptionBatchHandler)
routes.post("/employees/assignment-adoption", ...assignmentAdoptionHandler)
routes.post("/employees/responsibility-adoption", ...responsibilityAdoptionHandler)
routes.post("/employees/timeline", ...employeeTimelineHandler)
routes.post("/employees/state", ...employeeStateHandler)
routes.post("/personnel-actions/list", ...personnelActionListHandler)
routes.post("/personnel-actions/request", ...personnelActionRequestHandler)
routes.post("/personnel-actions/apply", ...personnelActionApplyHandler)
routes.post("/personnel-actions/correct", ...personnelActionCorrectHandler)
routes.post("/notifications/delete", ...notifyDeleteHandler)
routes.post("/notifications/show", ...notifyShowHandler)
routes.post("/departments/adoption", ...organizationAdoptionHandler)
routes.post("/departments/create", ...orgDeptCreateHandler)
routes.post("/departments/delete", ...orgDeptDeleteHandler)
routes.post("/departments/list", ...orgDeptListHandler)
routes.post("/departments/show", ...orgDeptShowHandler)
routes.post("/departments/update", ...orgDeptUpdateHandler)

export const app = routes
