import { RegisterEmployee } from "@/api/http/employees/register-employee"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import {
  resolvePersonnelActionInput,
  wirePersonnelActionInputSchema,
} from "@/contexts/company/interface/operations/resolve-personnel-action-input"
import { toHttpException as toCompanyHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import { toHttpException } from "@/lib/http/to-http-exception"
import { BadRequestError } from "@/lib/http/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const bodySchema = z.strictObject({
  expected_company_revision: z.number().int().nonnegative(),
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  email: z.string().email().max(320),
  password: z.string().min(12).max(200),
  role: z.enum(["member", "manager", "hr", "root"]),
  hire_on: z.string().date(),
  employment_type: z.enum(["FULL_TIME", "PART_TIME"]),
  department_code: z.string().trim().min(1).max(64).nullable().optional(),
  position_code: z.string().trim().min(1).max(64).nullable().optional(),
  manager_employee_code: z.string().trim().min(1).max(64).nullable().optional(),
})

// @authorization permission - employee:create、lifecycle、IAM権限をApplicationで再検証する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", bodySchema),
  async (context) => {
    const idempotencyKey = context.req.header("Idempotency-Key")
    if (idempotencyKey === undefined || !z.uuid().safeParse(idempotencyKey).success) {
      throw new BadRequestError("A UUID Idempotency-Key is required")
    }
    const body = context.req.valid("json")
    const wire = wirePersonnelActionInputSchema.parse({
      kind: "hire",
      employmentType: body.employment_type,
      employeeCode: body.code,
      employeeName: body.name,
      eventOn: body.hire_on,
      departmentCode: body.department_code ?? null,
      positionCode: body.position_code ?? null,
      managerEmployeeCode: body.manager_employee_code ?? null,
    })
    const action = await resolvePersonnelActionInput(context, wire, body.expected_company_revision)
    if (action instanceof CompanyOperationError) throw toCompanyHttpException(action)
    if (action.kind !== "hire") throw new BadRequestError("hire action is required")
    const result = await new RegisterEmployee(context).execute({
      action,
      expectedCompanyRevision: body.expected_company_revision,
      email: body.email,
      password: body.password,
      roleKey: body.role,
      idempotencyKey,
      now: context.var.now(),
    })
    if (result instanceof ApplicationError) throw toHttpException(result)
    return context.json(
      {
        code: result.code,
        name: result.name,
        dept_name: result.departmentName,
        position: result.positionTitle,
        email: result.email,
        status: "active",
        role: result.role,
        replayed: result.replayed,
      },
      result.replayed ? 200 : 201,
    )
  },
)
