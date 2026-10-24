import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export type WorkforceManagerRelation = Readonly<{
  employeeId: EmployeeId
  managerEmployeeId: EmployeeId
}>
