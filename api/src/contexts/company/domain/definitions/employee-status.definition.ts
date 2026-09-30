import { z } from "zod"

/** Companyが所有する従業員台帳の在籍状態。 */
export const employeeStatusSchema = z.enum(["active", "leave", "retired"])

export type EmployeeStatus = z.infer<typeof employeeStatusSchema>
