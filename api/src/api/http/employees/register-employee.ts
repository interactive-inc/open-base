import { prepareCompanyPersonnelActionPersistence } from "@/contexts/company/interface/operations/prepare-company-personnel-action-persistence"
import { prepareCompanyPersonnelActionCompletion } from "@/contexts/company/interface/operations/prepare-company-personnel-action-completion"
import { prepareCompanyInitialAccountProfileStatement } from "@/contexts/company/interface/operations/prepare-company-initial-account-profile-statement"
import { findCompanyRegisteredEmployeeByOperation } from "@/contexts/company/interface/operations/find-company-registered-employee-by-operation"
import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { readCompanyOrganizationLifecycleRevision } from "@/contexts/company/interface/operations/read-company-organization-lifecycle-revision"
import type { Context } from "@/env"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import { fingerprintPersonnelAction } from "@/contexts/company/domain/definitions/fingerprint-personnel-action.definition"
import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { SystemPasswordValue } from "@system/domain/values/auth/system-password.value"
import { hashPassword } from "@system/lib/auth/hash-password"
import { verifyPassword } from "@system/lib/auth/verify-password"
import { openSystemAccountProvisioning } from "@system/interface/operations/open-system-account-provisioning"
import { openSystemRoleCatalog } from "@system/interface/operations/open-system-role-catalog"
import { isCompanyWriteAbortedByGuard as isAbortedByGuard } from "@/contexts/company/interface/operations/is-company-write-aborted-by-guard"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

/**
 * 登録時に既定で割り当てるrole key。このroleは全従業員が持つ基準の権限集合なので、
 * 割り当てにemployee:assign_roleを要求しない。
 */
const BASELINE_REGISTRATION_ROLE_KEY = "member"

/** Company採用、System Account、Identity、Role、両者のlinkを一つのD1 batchで作る。 */
export class RegisterEmployee {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: {
    action: Extract<PersonnelActionInput, { kind: "hire" }>
    expectedCompanyRevision?: number
    email: string
    password: string
    roleKey: "member" | "manager" | "hr" | "root"
    idempotencyKey: string
    now: Date
  }): Promise<
    | {
        code: string
        name: string
        departmentName: string | null
        positionTitle: string | null
        email: string
        role: "member" | "manager" | "hr" | "root"
        replayed: boolean
      }
    | ApplicationError
  > {
    const session = this.c.var.session
    if (session === null) return new ForbiddenError("認証が必要です", "forbidden")
    if (
      !session.hasPermission("employee:create") ||
      !session.hasPermission("employee:lifecycle:apply") ||
      !session.hasPermission("account:manage") ||
      !session.hasPermission("iam:write")
    ) {
      return new ForbiddenError(
        "従業員、入社発令、System Accountを作成する権限が必要です",
        "forbidden",
      )
    }
    if (
      input.roleKey !== BASELINE_REGISTRATION_ROLE_KEY &&
      !session.hasPermission("employee:assign_role")
    ) {
      return new ForbiddenError("このRoleを割り当てる権限がありません", "forbidden")
    }
    const company = {
      env: {
        DB: this.c.env.DB,
        COMPANY_TIME_ZONE: this.c.env.COMPANY_TIME_ZONE,
        NOW: input.now.toISOString(),
      },
      var: { database: this.c.var.database, auditContext: this.c.var.auditContext },
    }
    const roles = await openSystemRoleCatalog({ env: { DB: this.c.env.DB } }).findMany()
    if (roles instanceof Error) {
      return new UnexpectedError("System Roleを取得できません", { cause: roles })
    }
    const role = roles.find((candidate) => candidate.key === `company:${input.roleKey}`)
    if (role === undefined) return new ValidationError("Roleが見つかりません", "role_not_found")
    if (!role.permissionKeys.every((permission) => session.hasPermission(permission))) {
      return new ForbiddenError("保持していない権限を含むRoleは割り当てられません", "forbidden")
    }
    const password = SystemPasswordValue.create(input.password)
    if (password instanceof Error) {
      return new ValidationError("パスワードは12文字以上200文字以下です", password.code)
    }
    const pepper = this.c.env.PEPPER_SECRET
    if (pepper === undefined || pepper === "") {
      return new UnexpectedError("パスワード登録が構成されていません")
    }
    const payloadFingerprint = await fingerprintPersonnelAction(
      `prospective:${input.action.employeeCode}`,
      input.action,
      input.expectedCompanyRevision,
    )
    const registrationReplayInput = {
      idempotencyKey: input.idempotencyKey,
      payloadFingerprint,
      actorAccountId: session.accountId,
      employeeCode: input.action.employeeCode,
      employeeName: input.action.employeeName,
      email: input.email,
      password: input.password,
      pepper,
      roleKey: input.roleKey,
      departmentName: input.action.departmentCode ?? null,
      positionTitle: input.action.positionTitle ?? null,
    } as const
    const replay = await this.findCompletedRegistration(registrationReplayInput)
    if (replay instanceof ApplicationError) return replay
    if (replay !== null) return replay
    const [existingEmployee, existingIdentity] = await Promise.all([
      openCompanyEmployeeDirectory(company).findByCode(input.action.employeeCode),
      this.c.env.DB.prepare(
        `SELECT 1 AS found FROM system_identity_profiles
         WHERE lower(email) = lower(?1) LIMIT 1`,
      )
        .bind(input.email)
        .first<number>("found"),
    ])
    if (existingEmployee instanceof Error) {
      return new UnexpectedError("従業員コードを検査できません", { cause: existingEmployee })
    }
    if (existingEmployee !== null) {
      return new ConflictError("employee code already exists", "employee_code_conflict")
    }
    if (existingIdentity !== null) {
      return new ConflictError("email already exists", "email_conflict")
    }
    const lifecycleRevision = await readCompanyOrganizationLifecycleRevision({
      database: this.c.env.DB,
    })
    if (lifecycleRevision instanceof Error)
      return new UnexpectedError("人事情報を確認できません", { cause: lifecycleRevision })
    const organizationRevision = lifecycleRevision ?? 0
    const prepared = await prepareCompanyPersonnelActionCompletion(company, {
      session,
      employeeId: null,
      input: input.action,
      sourceApplicationId: null,
      idempotencyKey: input.idempotencyKey,
      requestedByEmployeeId: session.employeeId,
      expectedCompanyRevision: input.expectedCompanyRevision,
      expectedEmployeeRevision: 0,
      expectedOrganizationRevision: organizationRevision,
      expectedPayloadFingerprint: payloadFingerprint,
    })
    if (prepared instanceof CompanyOperationError) {
      const completed = await this.findCompletedRegistration(registrationReplayInput)
      if (completed !== null) return completed
      return new UnexpectedError("入社発令を準備できません", { cause: prepared })
    }
    const passwordHash = await hashPassword(password.toString(), pepper)
    const system = openSystemAccountProvisioning({ env: { DB: this.c.env.DB } }).prepare({
      actorAccountId: session.accountId,
      provider: "password",
      subject: input.email,
      email: input.email,
      passwordHash,
      roleId: role.id,
      now: input.now,
    })
    if (system instanceof Error) {
      return new UnexpectedError("System Accountを準備できません", { cause: system })
    }
    const persistence = {
      ...prepared.persistence,
      prospectiveEmployee: {
        ...prepared.persistence.prospectiveEmployee!,
        email: input.email,
        accountId: system.accountId,
      },
    }
    const companyStatements = await prepareCompanyPersonnelActionPersistence(company, persistence)
    if (companyStatements instanceof CompanyOperationError) {
      return new UnexpectedError("入社発令を保存用に変換できません", {
        cause: companyStatements,
      })
    }
    try {
      const executions = await this.c.env.DB.batch([
        system.accountStatement,
        ...companyStatements,
        prepareCompanyInitialAccountProfileStatement(this.c.env.DB, {
          organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
          accountId: system.accountId,
          displayName: input.action.employeeName,
          at: input.now.getTime(),
        }),
        ...system.identityStatements,
      ])
      if (executions.some((execution) => !execution.success)) {
        return new UnexpectedError("従業員登録transactionが完了しませんでした")
      }
    } catch (cause) {
      const completed = await this.findCompletedRegistration(registrationReplayInput)
      if (completed !== null) return completed
      if (isAbortedByGuard(cause)) {
        return new ConflictError(
          "登録中にCompanyの状態が変更されました",
          "employee_registration_conflict",
        )
      }
      const message = cause instanceof Error ? cause.message : String(cause)
      if (message.includes("UNIQUE constraint")) {
        return new ConflictError("employee code or email already exists", "employee_code_conflict")
      }
      if (message.includes("integer overflow")) {
        return new ForbiddenError("登録中に権限が変更されました", "forbidden")
      }
      return new UnexpectedError("従業員を登録できません", { cause })
    }
    return {
      code: input.action.employeeCode,
      name: input.action.employeeName,
      departmentName: input.action.departmentCode ?? null,
      positionTitle: input.action.positionTitle ?? null,
      email: input.email,
      role: input.roleKey,
      replayed: false,
    }
  }

  private async findCompletedRegistration(input: {
    idempotencyKey: string
    payloadFingerprint: string
    actorAccountId: string
    employeeCode: string
    employeeName: string
    email: string
    password: string
    pepper: string
    roleKey: "member" | "manager" | "hr" | "root"
    departmentName: string | null
    positionTitle: string | null
  }): Promise<
    | {
        code: string
        name: string
        departmentName: string | null
        positionTitle: string | null
        email: string
        role: "member" | "manager" | "hr" | "root"
        replayed: boolean
      }
    | ApplicationError
    | null
  > {
    try {
      const registered = await findCompanyRegisteredEmployeeByOperation(
        this.c.env.DB,
        input.idempotencyKey,
      )
      if (registered instanceof Error) throw registered
      if (registered === null) return null
      const credential = await this.c.env.DB.prepare(
        `SELECT identity_profile.email, credential.password_hash,
                EXISTS (
                  SELECT 1
                    FROM system_role_bindings AS binding
                    JOIN system_iam_roles AS role ON role.id = binding.role_id
                   WHERE binding.account_id = ?1
                     AND binding.resource_type IS NULL
                     AND binding.revoked_at IS NULL
                     AND role.key = ?2
                ) AS has_expected_role
           FROM (SELECT 1) AS account
           LEFT JOIN system_identity_bindings AS identity
             ON identity.account_id = ?1
            AND identity.provider = 'password'
            AND identity.revoked_at IS NULL
           LEFT JOIN system_identity_profiles AS identity_profile
             ON identity_profile.identity_id = identity.id
           LEFT JOIN system_password_credentials AS credential
             ON credential.identity_id = identity.id`,
      )
        .bind(registered.accountId, `company:${input.roleKey}`)
        .first<{ email: string | null; password_hash: string | null; has_expected_role: number }>()
      const row =
        credential === null
          ? null
          : {
              kind: registered.kind,
              payload_fingerprint: registered.payloadFingerprint,
              recorded_by_account_id: registered.recordedByAccountId,
              employee_code: registered.employeeCode,
              official_name: registered.officialName,
              email: credential.email,
              password_hash: credential.password_hash,
              has_expected_role: credential.has_expected_role,
            }
      if (row === null) return null
      if (row.password_hash === null || row.email === null) {
        return new UnexpectedError("完了済み従業員登録のSystem資格情報が見つかりません")
      }
      const matches =
        row.kind === "hire" &&
        row.payload_fingerprint === input.payloadFingerprint &&
        row.recorded_by_account_id === input.actorAccountId &&
        row.employee_code === input.employeeCode &&
        row.official_name === input.employeeName &&
        row.email.toLocaleLowerCase("en-US") === input.email.toLocaleLowerCase("en-US") &&
        row.has_expected_role === 1 &&
        (await verifyPassword(input.password, row.password_hash, input.pepper))
      if (!matches) {
        return new ConflictError(
          "Idempotency-Key is already used by another employee registration",
          "idempotency_conflict",
        )
      }
      return {
        code: input.employeeCode,
        name: input.employeeName,
        departmentName: input.departmentName,
        positionTitle: input.positionTitle,
        email: input.email,
        role: input.roleKey,
        replayed: true,
      }
    } catch (cause) {
      return new UnexpectedError("完了済み従業員登録を検証できません", { cause })
    }
  }
}
