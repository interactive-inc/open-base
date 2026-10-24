import { resolveActiveSystemAccountId } from "@/api/http/accounts/resolve-active-system-account-id"
import type { CompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/parse-company-procedure-decision.policy"
import type { Context } from "@/env"
import { parseJsonValue } from "@/api/http/application-requests/lib/parse-json-value"
import { PublishSystemProcedure } from "@system/application/workflow/publish-system-procedure"
import type { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"

export function systemProcedureRepository(c: Context) {
  return openSystemProcedures({ env: { DB: c.env.DB } })
}

export async function loadSystemProcedure(
  c: Context,
  code: string,
): Promise<ProcedureDefinitionEntity | null | Error> {
  const key = procedureKeySchema.safeParse(code)
  if (!key.success) return null

  return systemProcedureRepository(c).find(key.data)
}

export function parseSystemProcedurePolicy(
  definition: ProcedureDefinitionEntity,
): CompanyProcedureDecisionPolicy | Error {
  try {
    return parseCompanyProcedureDecisionPolicy(JSON.parse(definition.decisionPolicyJson))
  } catch (cause) {
    return new Error("invalid System procedure decision policy", { cause })
  }
}

export function parseSystemProcedureInputSchema(
  definition: ProcedureDefinitionEntity,
): Readonly<{ value: unknown }> | Error {
  const parsed = parseJsonValue(definition.inputSchemaJson)
  if (parsed instanceof Error) {
    return new Error("invalid System procedure input schema", { cause: parsed })
  }

  return parsed
}

export async function publishSystemProcedure(
  c: Context,
  input: Readonly<{
    code: string
    expectedRevision: number
    name: string
    category: string
    description: string | null
    schemaJson: unknown
    policy: CompanyProcedureDecisionPolicy
    completionOperationKey: string | null
  }>,
): Promise<ProcedureDefinitionEntity | "revision_conflict" | Error> {
  if (["ringi_request", "expense_request"].includes(input.code))
    return new Error("App procedure requires its dedicated configuration route")
  const session = c.var.session
  if (session === null) return new Error("authenticated session is missing")
  const accountId = await resolveActiveSystemAccountId(c, session.accountId)
  if (accountId instanceof Error) return accountId

  return new PublishSystemProcedure(systemProcedureRepository(c)).run({
    key: input.code,
    expectedRevision: input.expectedRevision,
    title: input.name,
    category: input.category,
    description: input.description,
    inputSchema: input.schemaJson,
    decisionPolicy: input.policy,
    completionOperationKey: input.completionOperationKey,
    createdByAccountId: accountId,
    createdAt: new Date(c.env.NOW ?? Date.now()),
  })
}
