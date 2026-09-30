import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { DirectPersonnelActionCommand } from "@/contexts/company/domain/definitions/direct-personnel-action-command.definition"
import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import { DirectPersonnelActionAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/direct-personnel-action.adapter"

type Context = CompanyContext

type Command = Omit<DirectPersonnelActionCommand, "input"> &
  Readonly<{ input: Extract<PersonnelActionInput, { kind: "leave_started" }> }>

/** 従業員の休職を開始する。 */
export class StartEmployeeLeave {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command) {
    return await new DirectPersonnelActionAdapter(this.c).apply(command)
  }
}
