import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { findUnknownCompanyApproverRoles } from "@/api/http/application-templates/find-unknown-company-approver-roles"
import {
  loadSystemProcedure,
  parseSystemProcedureInputSchema,
  parseSystemProcedurePolicy,
  publishSystemProcedure,
  systemProcedureRepository,
} from "@/api/http/application-templates/lib/system-procedure-route"
import { factory } from "@/api/http/factory"
import { jsonPayloadSchema } from "@/lib/http/json-payload-schema"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ForbiddenError, InternalError, NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { ConflictError as ApplicationConflictError, UnprocessableError } from "@/lib/errors"
import {
  zAppApplicationTemplate,
  zAppApplicationTemplateDetail,
} from "@/api/http/company/response-schemas"
import { validateCodeParam } from "@/lib/http/validate-code-param"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  if (c.var.session === null) throw new UnauthorizedError()
  const code = validateCodeParam(c.req.param("code"), "application template")
  const definition = await loadSystemProcedure(c, code)
  if (definition instanceof Error) throw new InternalError("failed to load template")
  if (definition === null) throw new NotFoundError("template not found")
  const schema = parseSystemProcedureInputSchema(definition)
  const policy = parseSystemProcedurePolicy(definition)
  if (schema instanceof Error || policy instanceof Error) {
    throw new InternalError("invalid template data")
  }

  return c.json(
    zAppApplicationTemplate.parse({
      code: definition.key,
      name: definition.title,
      category: definition.category,
      description: definition.description,
      schema_json: schema.value,
      approver_roles: policy.approverRoles,
    }),
    200,
  )
})

// @authorization permission - 権限キーで判定する
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(500),
      category: z.string().min(1).max(200),
      description: z.string().max(3_000).nullable().optional(),
      schema_json: jsonPayloadSchema(10_000),
      approver_roles: z.array(z.string().max(100)).max(20).optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    if (!session.hasPermission("application_template:manage")) throw new ForbiddenError()
    const code = validateCodeParam(c.req.param("code"), "application template")
    const current = await loadSystemProcedure(c, code)
    if (current instanceof Error) throw new InternalError("failed to load template")
    if (current === null) throw new NotFoundError("template not found")
    const currentSchema = parseSystemProcedureInputSchema(current)
    if (
      ["ringi.request.authorize", "expense.request.authorize", "leave.request.authorize"].includes(
        current.completionOperationKey ?? "",
      )
    )
      throw new ForbiddenError("対象業務の規程設定を使用してください")
    const currentPolicy = parseSystemProcedurePolicy(current)
    if (currentSchema instanceof Error || currentPolicy instanceof Error) {
      throw new InternalError("invalid template data")
    }
    const body = c.req.valid("json")
    const approverRoles = body.approver_roles ?? []
    const unknownRoles = await findUnknownCompanyApproverRoles(c.env.DB, approverRoles)
    if (unknownRoles instanceof Error) {
      throw new InternalError("failed to validate approver roles")
    }
    if (unknownRoles.length > 0) {
      throw toHttpException(
        new UnprocessableError("unknown approver role", "unknown_approver_role"),
      )
    }
    const policy = createCompanyProcedureDecisionPolicy({
      approverRoles,
      workflow: currentPolicy.workflow,
      workflowRevision: currentPolicy.workflowRevision,
    })
    if (policy instanceof Error) throw new InternalError("failed to create procedure policy")
    const schemaJson = body.schema_json ?? {}
    const currentSchemaJson = CanonicalSystemJsonValue.create(currentSchema.value)
    const nextSchemaJson = CanonicalSystemJsonValue.create(schemaJson)
    const currentApproverRolesJson = CanonicalSystemJsonValue.create(currentPolicy.approverRoles)
    const nextApproverRolesJson = CanonicalSystemJsonValue.create(approverRoles)
    if (
      currentSchemaJson instanceof Error ||
      nextSchemaJson instanceof Error ||
      currentApproverRolesJson instanceof Error ||
      nextApproverRolesJson instanceof Error
    ) {
      throw new InternalError("failed to canonicalize template data")
    }
    if (
      current.completionOperationKey !== null &&
      (current.category !== body.category ||
        !currentSchemaJson.equals(nextSchemaJson) ||
        !currentApproverRolesJson.equals(nextApproverRolesJson))
    ) {
      throw toHttpException(
        new UnprocessableError(
          "system template structure cannot be changed",
          "system_template_structure_locked",
        ),
      )
    }
    const updated = await publishSystemProcedure(c, {
      code,
      expectedRevision: current.revision,
      name: body.name,
      category: body.category,
      description: body.description ?? null,
      schemaJson,
      policy,
      completionOperationKey: current.completionOperationKey,
    })
    if (updated === "revision_conflict") {
      throw toHttpException(
        new ApplicationConflictError(
          "template was updated by another administrator",
          "template_revision_conflict",
        ),
      )
    }
    if (updated instanceof Error) throw new InternalError("failed to update template")
    const number = await systemProcedureRepository(c).findNumber(updated.key)
    if (number instanceof Error || number === null) {
      throw new InternalError("failed to load template number")
    }

    const schema = parseSystemProcedureInputSchema(updated)
    if (schema instanceof Error) throw new InternalError("invalid template data")

    return c.json(
      zAppApplicationTemplateDetail.parse({
        id: number,
        code: updated.key,
        name: updated.title,
        category: updated.category,
        description: updated.description,
        schema_json: schema.value,
        approver_roles: policy.approverRoles,
      }),
      200,
    )
  },
)

// @authorization permission - 権限キーで判定する
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  if (!session.hasPermission("application_template:manage")) throw new ForbiddenError()
  const code = validateCodeParam(c.req.param("code"), "application template")
  const current = await loadSystemProcedure(c, code)
  if (current instanceof Error) throw new InternalError("failed to load template")
  if (current === null) throw new NotFoundError("template not found")
  if (current.completionOperationKey !== null) {
    throw toHttpException(
      new ApplicationConflictError("system template cannot be deleted", "system_template_locked"),
    )
  }
  const repository = systemProcedureRepository(c)
  const inUse = await repository.hasProposals(current.key)
  if (inUse instanceof Error) throw new InternalError("failed to inspect template use")
  if (inUse) {
    throw toHttpException(
      new ApplicationConflictError("template is in use by applications", "template_in_use"),
    )
  }
  const retired = await repository.retire({
    key: current.key,
    expectedRevision: current.revision,
    retiredAt: new Date(c.env.NOW ?? Date.now()),
  })
  if (retired === "not_found") throw new NotFoundError("template not found")
  if (retired === "revision_conflict") {
    throw toHttpException(
      new ApplicationConflictError(
        "template was updated by another administrator",
        "template_revision_conflict",
      ),
    )
  }
  if (retired instanceof Error) throw new InternalError("failed to retire template")

  return c.body(null, 204)
})
