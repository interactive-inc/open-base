import { ApplyExternalIdentities } from "@/contexts/company/application/external-identities/apply-external-identities"
import { ExternalIdentityImportRepository } from "@/contexts/company/infrastructure/repositories/external-identities/external-identity-import.repository"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { iamRoleIdSchema } from "@system/domain/schemas/iam/iam-role.schema"
import { authenticateSystemMachineAccessToken } from "@system/interface/middlewares/authenticate-system-machine-access-token"
import { createFactory } from "hono/factory"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { CompanyExternalIdentityImportError } from "@/contexts/company/interface/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const factory = createFactory<SystemHonoEnv & { Bindings: { COMPANY_TIME_ZONE?: string } }>()
const responseSchema = z
  .object({
    created: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    organization_revision: z.number().int().positive(),
    replayed: z.boolean(),
  })
  .strict()

// @authorization machine - Systemの機械tokenとprovider scopeを検査してCompanyの正本へ取り込む
export const POST = factory.createHandlers(
  authenticateSystemMachineAccessToken,
  zValidator(
    "json",
    z
      .object({
        command_id: z.string().regex(/^\S{1,200}$/),
        expected_revision: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER - 1),
        reason: z.string().trim().min(1).max(2_000),
        identities: z
          .array(
            z
              .object({
                subject: identitySubjectSchema,
                source_revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
                email: z.email().max(254),
                name: z.string().trim().min(1).max(200),
                account_id: zAccountId.nullable().default(null),
                initial_role_id: iamRoleIdSchema.nullable().default(null),
                new_employee: z
                  .object({
                    hire_date: z.string().refine((value): boolean => isCalendarDate(value)),
                    employment_type: z.enum(["FULL_TIME", "PART_TIME"]),
                  })
                  .strict()
                  .nullable()
                  .default(null),
              })
              .strict(),
          )
          .min(1)
          .max(25),
      })
      .strict(),
  ),
  async (c) => {
    const claims = c.var.systemAccessToken
    if (claims?.machineCredentialId === undefined)
      throw new CompanyExternalIdentityImportError("forbidden")
    const body = c.req.valid("json")
    const result = await new ApplyExternalIdentities({
      repository: new ExternalIdentityImportRepository(c),
      actor: {
        accountId: claims.sub,
        tokenVersion: claims.ver,
        credentialId: claims.machineCredentialId,
        issuedAtMs: claims.issuedAtMs,
      },
      now: c.var.now,
    }).execute({
      commandId: body.command_id,
      expectedRevision: body.expected_revision,
      reason: body.reason,
      identities: body.identities.map((identity) => ({
        subject: identity.subject,
        sourceRevision: identity.source_revision,
        email: identity.email,
        name: identity.name,
        accountId: identity.account_id,
        initialRoleId: identity.initial_role_id,
        newEmployee:
          identity.new_employee === null
            ? null
            : {
                hireDate: identity.new_employee.hire_date,
                employmentType: identity.new_employee.employment_type,
              },
      })),
    })
    if (result.kind === "forbidden") throw new CompanyExternalIdentityImportError("forbidden")
    if (result.kind === "invalid")
      throw new CompanyExternalIdentityImportError("invalid", result.reason)
    if (result.kind === "conflict")
      throw new CompanyExternalIdentityImportError("conflict", result.reason)
    if (result.kind === "unavailable") throw new CompanyExternalIdentityImportError("unavailable")
    return c.json(
      responseSchema.parse({
        ...result.summary,
        organization_revision: result.organizationRevision,
        replayed: result.replayed,
      }),
      200,
    )
  },
)
