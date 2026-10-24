import { ChangeManager } from "@/contexts/company/application/employee-lifecycle/change-manager"
import { ChangePosition } from "@/contexts/company/application/employee-lifecycle/change-position"
import { CorrectPersonnelAction } from "@/contexts/company/application/employee-lifecycle/correct-personnel-action"
import { EndAssignment } from "@/contexts/company/application/employee-lifecycle/end-assignment"
import { EndDepartmentResponsibility } from "@/contexts/company/application/employee-lifecycle/end-department-responsibility"
import { HireEmployee } from "@/contexts/company/application/employee-lifecycle/hire-employee"
import { InitializeEmployeeLifecycle } from "@/contexts/company/application/employee-lifecycle/initialize-employee-lifecycle"
import { RehireEmployee } from "@/contexts/company/application/employee-lifecycle/rehire-employee"
import { RetireEmployee } from "@/contexts/company/application/employee-lifecycle/retire-employee"
import { ReturnEmployeeFromLeave } from "@/contexts/company/application/employee-lifecycle/return-employee-from-leave"
import { StartConcurrentAssignment } from "@/contexts/company/application/employee-lifecycle/start-concurrent-assignment"
import { StartDepartmentResponsibility } from "@/contexts/company/application/employee-lifecycle/start-department-responsibility"
import { StartEmployeeLeave } from "@/contexts/company/application/employee-lifecycle/start-employee-leave"
import { StartPrimaryAssignment } from "@/contexts/company/application/employee-lifecycle/start-primary-assignment"
import { TransferEmployee } from "@/contexts/company/application/employee-lifecycle/transfer-employee"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"

type Command = Readonly<{
  session: CompanyPersonnelSession
  employeeId: CompanyPersonnelSession["employeeId"]
  input: PersonnelActionInput
  idempotencyKey: string
  expectedCompanyRevision?: number
  expectedEmployeeRevision: number
  expectedOrganizationRevision: number | null
}>

/** 発令種別を対応する一操作Applicationへ振り分ける。複数操作は実行しない。 */
export async function dispatchPersonnelAction(context: CompanyContext, command: Command) {
  switch (command.input.kind) {
    case "hire":
      return new HireEmployee(context).execute({ ...command, input: command.input })
    case "rehire":
      return new RehireEmployee(context).execute({ ...command, input: command.input })
    case "primary_assignment_started":
      return new StartPrimaryAssignment(context).execute({ ...command, input: command.input })
    case "transferred":
      return new TransferEmployee(context).execute({ ...command, input: command.input })
    case "concurrent_assignment_started":
      return new StartConcurrentAssignment(context).execute({ ...command, input: command.input })
    case "assignment_ended":
      return new EndAssignment(context).execute({ ...command, input: command.input })
    case "position_changed":
      return new ChangePosition(context).execute({ ...command, input: command.input })
    case "manager_changed":
      return new ChangeManager(context).execute({ ...command, input: command.input })
    case "department_responsibility_started":
      return new StartDepartmentResponsibility(context).execute({
        ...command,
        input: command.input,
      })
    case "department_responsibility_ended":
      return new EndDepartmentResponsibility(context).execute({ ...command, input: command.input })
    case "leave_started":
      return new StartEmployeeLeave(context).execute({ ...command, input: command.input })
    case "returned":
      return new ReturnEmployeeFromLeave(context).execute({ ...command, input: command.input })
    case "retired":
      return new RetireEmployee(context).execute({ ...command, input: command.input })
    case "corrected":
      return new CorrectPersonnelAction(context).execute({ ...command, input: command.input })
    case "initial_state":
      return new InitializeEmployeeLifecycle(context).execute({ ...command, input: command.input })
  }
}
