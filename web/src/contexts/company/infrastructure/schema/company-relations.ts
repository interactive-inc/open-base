import { relations } from "drizzle-orm"
import {
  companyAccountProfiles,
  companyOrganizations,
} from "@/contexts/company/infrastructure/schema/company"
import { accountEmployeeLinks, employees } from "@/contexts/company/infrastructure/schema/employee"
import {
  employmentAttributes,
  employments,
} from "@/contexts/company/infrastructure/schema/employment"
import {
  organizationAssignmentPeriodVersions,
  organizationResponsibilityPeriodVersions,
  organizationUnitPeriodVersions,
  organizationUnits,
} from "@/contexts/company/infrastructure/schema/organization"
import { systemAccounts } from "@system/infrastructure/schema/system-core"

/**
 * Company が所有する table の Drizzle relations。上流 context の table への関係は、その table を参照できる
 * この context 側で宣言する（Drizzle は同じ table への relations を合成する）。API root の schema 合成が全 context 分を束ねる。
 */
export const employeesRelations = relations(employees, (helpers) => {
  return {
    accountLink: helpers.one(accountEmployeeLinks, {
      fields: [employees.id],
      references: [accountEmployeeLinks.employeeId],
    }),
    employments: helpers.many(employments),
    organizationAssignments: helpers.many(organizationAssignmentPeriodVersions, {
      relationName: "organizationAssignmentEmployee",
    }),
    managedOrganizationAssignments: helpers.many(organizationAssignmentPeriodVersions, {
      relationName: "organizationAssignmentManager",
    }),
    organizationResponsibilities: helpers.many(organizationResponsibilityPeriodVersions),
  }
})

export const accountEmployeeLinksRelations = relations(accountEmployeeLinks, (helpers) => {
  return {
    employee: helpers.one(employees, {
      fields: [accountEmployeeLinks.employeeId],
      references: [employees.id],
    }),
    account: helpers.one(systemAccounts, {
      fields: [accountEmployeeLinks.accountId],
      references: [systemAccounts.id],
    }),
  }
})

export const systemAccountsCompanyRelations = relations(systemAccounts, (helpers) => {
  return {
    companyProfiles: helpers.many(companyAccountProfiles),
    employeeLink: helpers.one(accountEmployeeLinks, {
      fields: [systemAccounts.id],
      references: [accountEmployeeLinks.accountId],
    }),
  }
})

export const companyOrganizationsRelations = relations(companyOrganizations, (helpers) => {
  return {
    accountProfiles: helpers.many(companyAccountProfiles),
  }
})

export const companyAccountProfilesRelations = relations(companyAccountProfiles, (helpers) => {
  return {
    organization: helpers.one(companyOrganizations, {
      fields: [companyAccountProfiles.organizationId],
      references: [companyOrganizations.id],
    }),
    account: helpers.one(systemAccounts, {
      fields: [companyAccountProfiles.accountId],
      references: [systemAccounts.id],
    }),
  }
})

export const employmentAttributesRelations = relations(employmentAttributes, (helpers) => {
  return {
    employment: helpers.one(employments, {
      fields: [employmentAttributes.employmentId],
      references: [employments.id],
    }),
  }
})

export const organizationUnitsRelations = relations(organizationUnits, (helpers) => {
  return {
    periods: helpers.many(organizationUnitPeriodVersions, { relationName: "organizationUnit" }),
    childPeriods: helpers.many(organizationUnitPeriodVersions, {
      relationName: "parentOrganizationUnit",
    }),
  }
})

export const organizationUnitPeriodVersionsRelations = relations(
  organizationUnitPeriodVersions,
  (helpers) => {
    return {
      organizationUnit: helpers.one(organizationUnits, {
        fields: [organizationUnitPeriodVersions.organizationUnitId],
        references: [organizationUnits.id],
        relationName: "organizationUnit",
      }),
      parentOrganizationUnit: helpers.one(organizationUnits, {
        fields: [organizationUnitPeriodVersions.parentOrganizationUnitId],
        references: [organizationUnits.id],
        relationName: "parentOrganizationUnit",
      }),
    }
  },
)

export const organizationAssignmentPeriodVersionsRelations = relations(
  organizationAssignmentPeriodVersions,
  (helpers) => {
    return {
      employment: helpers.one(employments, {
        fields: [organizationAssignmentPeriodVersions.employmentId],
        references: [employments.id],
      }),
      employee: helpers.one(employees, {
        fields: [organizationAssignmentPeriodVersions.employeeId],
        references: [employees.id],
        relationName: "organizationAssignmentEmployee",
      }),
      managerEmployee: helpers.one(employees, {
        fields: [organizationAssignmentPeriodVersions.managerEmployeeId],
        references: [employees.id],
        relationName: "organizationAssignmentManager",
      }),
      organizationUnit: helpers.one(organizationUnits, {
        fields: [organizationAssignmentPeriodVersions.organizationUnitId],
        references: [organizationUnits.id],
      }),
    }
  },
)

export const organizationResponsibilityPeriodVersionsRelations = relations(
  organizationResponsibilityPeriodVersions,
  (helpers) => {
    return {
      employment: helpers.one(employments, {
        fields: [organizationResponsibilityPeriodVersions.employmentId],
        references: [employments.id],
      }),
      employee: helpers.one(employees, {
        fields: [organizationResponsibilityPeriodVersions.employeeId],
        references: [employees.id],
      }),
      organizationUnit: helpers.one(organizationUnits, {
        fields: [organizationResponsibilityPeriodVersions.organizationUnitId],
        references: [organizationUnits.id],
      }),
    }
  },
)
