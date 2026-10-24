import type { EmploymentStatus } from "@/contexts/company/domain/definitions/employment-status.definition"
import type {
  EmployeeId,
  EmploymentId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"

/** Companyが所有するEmployeeと、現在の雇用・主務所属を合成した読取りモデル。 */
export type CompanyEmployeeDirectoryEntry = Readonly<{
  id: EmployeeId
  officialName: string
  employeeCode: string | null
  email: string | null
  phone: string | null
  employment: Readonly<{
    id: EmploymentId
    status: EmploymentStatus
  }> | null
  primaryAssignment: Readonly<{
    organizationUnitId: string
    organizationUnitCode: string
    organizationUnitName: string
    positionTitle: string | null
  }> | null
}>
