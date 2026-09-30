import { resolveCompanyRecordedAt } from "@/contexts/company/interface/request-environment/resolve-company-recorded-at"
/** /company/organization-changes */
import { ApplyOrganizationChange } from "@/contexts/company/application/organization/apply-organization-change"
import type { CompanyJsonObject } from "@/contexts/company/domain/entities/company-resource.entity"
import { companyResourceTypes } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import {
  CompanyAccessDeniedError,
  CompanyAuthenticationRequiredError,
  CompanyBodyInvalidError,
  CompanyCommandConflictError,
  CompanyDatabaseUnavailableError,
  CompanyHeadersInvalidError,
  CompanyInvariantValidationError,
  CompanyResourceConflictError,
  CompanyResourceOrganizationMismatchError,
  CompanyRevisionConflictError,
  CompanyWriteUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization service
export const POST = factory.createHandlers(
  zValidator(
    "header",
    z.object({
      "x-company-organization-id": z.string().regex(/^\S{1,255}$/),
      "idempotency-key": z.string().regex(/^\S{1,255}$/),
      "if-match": z.string().regex(/^(?:W\/)?(?:"\d+"|\d+)$/),
    }),
    (validation) => {
      if (!validation.success) {
        throw new CompanyHeadersInvalidError(validation.error)
      }
    },
  ),
  zValidator(
    "json",
    z.object({
      reason: z.string().trim().min(1).max(2_000),
      evidenceReferences: z
        .array(
          z.strictObject({
            context: z.string().trim().min(1).max(100),
            kind: z.string().trim().min(1).max(100),
            id: z.string().trim().min(1).max(512),
            version: z.string().trim().min(1).max(255),
          }),
        )
        .max(100)
        .optional(),
      corrections: z
        .array(
          z.strictObject({
            type: z.enum(companyResourceTypes),
            id: z.string().regex(/^\S{1,255}$/),
            revision: z.number().int().min(2),
            correctsRevision: z.number().int().min(1),
          }),
        )
        .max(100)
        .optional(),
      resources: z
        .array(
          z.discriminatedUnion("type", [
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("legal-entity"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  officialName: z.string().trim().min(1).max(2_000),
                  jurisdictionCountryCode: z.string().regex(/^[A-Z]{2}$/),
                  registrationNumber: z.string().trim().min(1).max(255).nullable(),
                  defaultCurrencyCode: z.string().regex(/^[A-Z]{3}$/),
                })
                .strict(),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("site"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  code: z.string().regex(/^[A-Z0-9][A-Z0-9._-]{0,63}$/),
                  officialName: z.string().trim().min(1).max(2_000),
                  legalEntityId: z.string().regex(/^\S{1,255}$/),
                  kind: z.enum(["physical", "virtual"]),
                  timeZone: z.string().regex(/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/),
                  countryCode: z.string().regex(/^[A-Z]{2}$/),
                })
                .strict(),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("workplace"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  code: z.string().regex(/^[A-Z0-9][A-Z0-9._-]{0,63}$/),
                  officialName: z.string().trim().min(1).max(2_000),
                  siteId: z.string().regex(/^\S{1,255}$/),
                  kind: z.enum(["office", "store", "plant", "warehouse", "remote", "other"]),
                  organizationUnitId: z
                    .string()
                    .regex(/^\S{1,255}$/)
                    .nullable()
                    .optional(),
                })
                .strict(),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("person"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  officialName: z
                    .string()
                    .trim()
                    .min(1)
                    .max(200)
                    .refine((value) => !value.includes("\0")),
                  email: z.email().max(320).nullable().optional(),
                  phone: z.string().trim().min(1).max(64).nullable().optional(),
                })
                .strict(),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("employee"),
              id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  personId: z.string().regex(/^\S{1,255}$/),
                  employeeCode: z.string().trim().min(1).max(64).nullable().optional(),
                })
                .strict(),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("employment"),
              id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  employeeId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
                  status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]),
                  employmentType: z.enum(["FULL_TIME", "PART_TIME"]),
                  contractTerm: z
                    .discriminatedUnion("kind", [
                      z
                        .object({
                          kind: z.literal("FIXED_TERM"),
                          startsOn: z.string().date(),
                          endsBefore: z.string().date(),
                        })
                        .strict(),
                      z
                        .object({
                          kind: z.literal("INDEFINITE"),
                          startsOn: z.string().date(),
                        })
                        .strict(),
                    ])
                    .refine((term) => term.kind !== "FIXED_TERM" || term.startsOn < term.endsBefore)
                    .nullable()
                    .optional(),
                  employerLegalEntityId: z
                    .string()
                    .regex(/^\S{1,255}$/)
                    .nullable()
                    .optional(),
                  officialName: z.string().trim().min(1).max(200).optional(),
                })
                .strict(),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("organization-unit"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  organizationUnitId: z.string().regex(/^\S{1,255}$/),
                  code: z.string().trim().min(1).max(64),
                  officialName: z.string().trim().min(1).max(200),
                  kind: z.enum(["COMPANY", "DIVISION", "DEPARTMENT", "TEAM", "OTHER"]),
                  parentOrganizationUnitId: z
                    .string()
                    .regex(/^\S{1,255}$/)
                    .nullable(),
                })
                .strict(),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("assignment"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  employeeId: z.string().regex(/^\S{1,255}$/),
                  employmentId: z.string().regex(/^\S{1,255}$/),
                  organizationUnitId: z.string().regex(/^\S{1,255}$/),
                  assignmentType: z.enum(["PRIMARY", "CONCURRENT"]),
                  positionTitle: z.string().trim().min(1).max(200).nullable().optional(),
                })
                .strict(),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("reporting-relation"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  employeeId: z.string().regex(/^\S{1,255}$/),
                  managerEmployeeId: z.string().regex(/^\S{1,255}$/),
                  organizationUnitId: z.string().regex(/^\S{1,255}$/),
                })
                .strict(),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("grade"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  code: z.string().trim().min(1).max(255),
                  officialName: z.string().trim().min(1).max(2_000),
                  rank: z.number().int().nullable().optional(),
                  description: z.string().trim().min(1).max(2_000).nullable().optional(),
                })
                .strict(),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("grade-assignment"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  employeeId: z.string().regex(/^\S{1,255}$/),
                  employmentId: z.string().regex(/^\S{1,255}$/),
                  gradeId: z.string().regex(/^\S{1,255}$/),
                })
                .strict(),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("office-assignment"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  employeeId: z.string().regex(/^\S{1,255}$/),
                  employmentId: z.string().regex(/^\S{1,255}$/),
                  organizationalOfficeId: z.string().regex(/^\S{1,255}$/),
                })
                .strict(),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("responsibility-assignment"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  responsibilityId: z.string().regex(/^\S{1,255}$/),
                  holderType: z.enum(["employee", "organizational-office", "collective-body"]),
                  holderId: z.string().regex(/^\S{1,255}$/),
                  authorityScopeId: z
                    .string()
                    .regex(/^\S{1,255}$/)
                    .nullable(),
                  delegationAllowed: z.boolean(),
                })
                .strict(),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("collective-body-membership"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  collectiveBodyId: z.string().regex(/^\S{1,255}$/),
                  employeeId: z.string().regex(/^\S{1,255}$/),
                  role: z.enum(["chair", "member", "secretary"]),
                  voting: z.boolean(),
                })
                .strict(),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("organizational-authority"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  employeeId: z.string().regex(/^\S{1,255}$/),
                  employmentId: z.string().regex(/^\S{1,255}$/),
                  scopeType: z.enum(["organization-unit", "authority-scope"]),
                  scopeId: z.string().regex(/^\S{1,255}$/),
                  authority: z.string().trim().min(1).max(255),
                })
                .strict(),
            }),
          ]),
        )
        .min(1)
        .max(100),
    }),
    (validation) => {
      if (!validation.success) {
        throw new CompanyBodyInvalidError(validation.error)
      }
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) {
      throw new CompanyAuthenticationRequiredError()
    }

    const database = context.env.DB
    if (database === undefined) {
      throw new CompanyDatabaseUnavailableError()
    }

    const headers = context.req.valid("header")
    const body = context.req.valid("json")
    const organizationId = headers["x-company-organization-id"]
    if (body.resources.some((resource) => resource.organizationId !== organizationId)) {
      throw new CompanyResourceOrganizationMismatchError()
    }

    const change = {
      commandId: headers["idempotency-key"],
      expectedRevision: Number(headers["if-match"].replace(/^W\//, "").replace(/^"|"$/g, "")),
      reason: body.reason,
      evidenceReferences: body.evidenceReferences,
      corrections: body.corrections,
      recordedAt: resolveCompanyRecordedAt(context.var.companyClock),
      resources: body.resources.map((resource) => ({
        ...resource,
        effectiveFrom: restoreCalendarDate(resource.effectiveFrom),
        effectiveTo:
          resource.effectiveTo === null ? null : restoreCalendarDate(resource.effectiveTo),
        attributes: resource.attributes as CompanyJsonObject,
      })),
    }
    const applyOrganizationChange = new ApplyOrganizationChange({
      actor,
      repository: new D1CompanyResourceRepository({ database }),
    })
    const result = await applyOrganizationChange.execute(change)

    if (result.kind === "forbidden") {
      throw new CompanyAccessDeniedError()
    }
    if (result.kind === "invalid") {
      throw new CompanyInvariantValidationError(result.error.code, result.error)
    }
    if (result.kind === "conflict") {
      throw new CompanyRevisionConflictError(`"${result.actualRevision}"`)
    }
    if (result.kind === "resource_conflict") {
      throw new CompanyResourceConflictError()
    }
    if (result.kind === "command_conflict") {
      throw new CompanyCommandConflictError()
    }
    if (result.kind === "unavailable") {
      throw new CompanyWriteUnavailableError(result.cause)
    }

    context.header("etag", `"${result.organizationRevision}"`)

    return context.json(
      {
        organizationId,
        organizationRevision: result.organizationRevision,
        replayed: result.replayed,
      },
      result.replayed ? 200 : 201,
    )
  },
)
