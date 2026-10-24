import { randomUUID } from "node:crypto"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

/**
 * 公開デモ用に、初期化直後の空のDBへ架空のサンプルデータをHTTP APIで投入する。
 * 起動中のAPIへfetchで接続するため、ローカルの `wrangler dev` と配備先のどちらにも使える。
 * 通常のセットアップでは使わない。明示的に実行したときだけ、管理者、会社、組織、従業員、
 * 申請の例と、閲覧専用roleを持つ共有のデモAccountを作る。
 * 秘密値と接続先は環境変数から受け取り、パスワードとtokenは出力しない。
 */

type Json = Record<string, unknown>

const ORGANIZATION = COMPANY_DEFAULT_ORGANIZATION_ID
const DEMO_ROLE_KEY = "demo:viewer"

/**
 * デモAccountのroleに含める閲覧用の権限。書き込み、管理、出力、消去の権限は含めない。
 * employee:readはCompanyの閲覧資格（company:read）と従業員の参照を導出する。
 */
const DEMO_VIEWER_PERMISSION_KEYS = [
  "employee:read",
  "employee:lifecycle:read:all",
  "application:read:all",
  "application:read:department",
  "iam:read",
  "batch:view",
] as const

function requireEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value.trim() === "") {
    console.error(`環境変数 ${name} を設定してください`)
    process.exit(1)
  }
  return value
}

const api = (process.env.BASE_API ?? "http://127.0.0.1:18787").replace(/\/+$/u, "")
const bootstrapToken = requireEnv("BOOTSTRAP_TOKEN")
const adminEmail = requireEnv("DEMO_ADMIN_EMAIL")
const adminPassword = requireEnv("DEMO_ADMIN_PASSWORD")
const viewerEmail = requireEnv("DEMO_VIEWER_EMAIL")
const viewerPassword = requireEnv("DEMO_VIEWER_PASSWORD")
const secrets = [bootstrapToken, adminPassword, viewerPassword]

for (const [name, password] of [
  ["DEMO_ADMIN_PASSWORD", adminPassword],
  ["DEMO_VIEWER_PASSWORD", viewerPassword],
] as const) {
  if (password.length < 12) {
    console.error(`${name} は12文字以上にしてください`)
    process.exit(1)
  }
}

class SeedError extends Error {}

/** 応答本文に秘密値が含まれても出力しない。 */
function redact(text: string): string {
  return secrets.reduce((current, secret) => current.split(secret).join("[redacted]"), text)
}

async function call(
  method: string,
  path: string,
  options: Readonly<{ token?: string; headers?: Record<string, string>; body?: unknown }> = {},
): Promise<{ status: number; body: Json }> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${api}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(options.token === undefined ? {} : { authorization: `Bearer ${options.token}` }),
        ...options.headers,
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    })
    // 配備先のrate limitに当たったときは待って同じ要求を再送する。書き込みは冪等keyで重複しない。
    if (response.status === 429 && attempt < 5) {
      await response.body?.cancel()
      const seconds = Number(response.headers.get("retry-after") ?? "10")
      await new Promise((resolve) =>
        setTimeout(resolve, (Number.isFinite(seconds) ? seconds : 10) * 1000),
      )
      continue
    }
    const text = await response.text()
    let body: Json = {}
    if (text.length > 0) {
      try {
        body = JSON.parse(text) as Json
      } catch {
        body = { text }
      }
    }
    return { status: response.status, body }
  }
}

function expectStatus(
  result: Readonly<{ status: number; body: Json }>,
  status: number,
  label: string,
): Json {
  if (result.status !== status) {
    throw new SeedError(`${label}: HTTP ${result.status} ${redact(JSON.stringify(result.body))}`)
  }
  return result.body
}

async function main() {
  // System管理者の初期化。初期化済みのDBには重複して投入しない。
  const bootstrap = await call("POST", "/system/bootstrap", {
    body: { token: bootstrapToken, email: adminEmail, password: adminPassword },
  })
  if (bootstrap.status === 409) {
    throw new SeedError("Systemは初期化済みです。デモデータは初期化直後の空のDBにだけ投入します")
  }
  if (bootstrap.status === 404) {
    throw new SeedError("POST /system/bootstrap が無効です。APIにBOOTSTRAP_TOKENを設定してください")
  }
  expectStatus(bootstrap, 201, "Systemの初期化")

  const login = async (email: string, password: string, label: string) =>
    z
      .object({ access_token: z.string(), account_id: z.string() })
      .parse(
        expectStatus(
          await call("POST", "/system/sessions", { body: { subject: email, password } }),
          201,
          label,
        ),
      )
  const root = (await login(adminEmail, adminPassword, "管理者のログイン")).access_token
  const stepUp = z.object({ step_up_token: z.string() }).parse(
    expectStatus(
      await call("POST", "/system/step-up-grants", {
        token: root,
        body: { method: "password", password: adminPassword },
      }),
      201,
      "管理者の再認証",
    ),
  ).step_up_token
  const elevated = { "x-system-step-up": stepUp }

  // 会社の初期化。管理者自身が最初の従業員になる。
  const hireDate = "2024-04-01"
  const company = z.object({ employee_id: z.string() }).parse(
    expectStatus(
      await call("POST", "/company/bootstrap", {
        token: root,
        headers: { "idempotency-key": "demo-company-bootstrap" },
        body: {
          name: "山田 太郎",
          code: "E0001",
          organization_name: "Example 株式会社",
          representative_name: "山田 太郎",
          initial_responsibilities: [],
          hire_date: hireDate,
          employment_type: "FULL_TIME",
          locale: "ja-JP",
          time_zone: "Asia/Tokyo",
          fiscal_year_start_month: 4,
          reason: "デモ用の架空の会社を作成",
        },
      }),
      201,
      "会社の初期化",
    ),
  )
  const companyHeaders = { "x-company-organization-id": ORGANIZATION }

  const snapshot = z
    .object({
      organizationRevision: z.number(),
      resources: z.array(
        z.object({
          type: z.string(),
          id: z.string(),
          effectiveFrom: z.string(),
          attributes: z.record(z.string(), z.unknown()),
        }),
      ),
    })
    .parse(
      expectStatus(
        await call("GET", "/company/organization-snapshots", {
          token: root,
          headers: companyHeaders,
        }),
        200,
        "組織snapshot",
      ),
    )
  let revision = snapshot.organizationRevision
  const companyUnit = snapshot.resources.find(
    (resource) => resource.type === "organization-unit" && resource.attributes.kind === "COMPANY",
  )
  // 会社の初期化は管理者の主所属を最上位組織へ作る。その雇用を以降の所属と等級に使う。
  const rootAssignment = snapshot.resources.find(
    (resource) =>
      resource.type === "assignment" && resource.attributes.employeeId === company.employee_id,
  )
  if (companyUnit === undefined || rootAssignment === undefined) {
    throw new SeedError("会社の最上位組織または管理者の所属が見つかりません")
  }
  const startsOn = hireDate
  const rootEmploymentId = String(rootAssignment.attributes.employmentId)

  const write = async (path: string, reason: string, resources: ReadonlyArray<unknown>) => {
    const result = await call("POST", path, {
      token: root,
      headers: { ...companyHeaders, "idempotency-key": randomUUID(), "if-match": `"${revision}"` },
      body: { reason, resources },
    })
    revision = z
      .object({ organizationRevision: z.number() })
      .parse(expectStatus(result, 201, reason)).organizationRevision
  }
  const envelope = (type: string, id: string, effectiveFrom: string, attributes: Json) => ({
    organizationId: ORGANIZATION,
    type,
    id,
    revision: 1,
    state: "active",
    effectiveFrom,
    effectiveTo: null,
    attributes,
  })

  // 組織
  const units = [
    { code: "SALES", name: "営業部", kind: "DEPARTMENT", parent: null },
    { code: "SALES-1", name: "第一営業課", kind: "TEAM", parent: "SALES" },
    { code: "SALES-2", name: "第二営業課", kind: "TEAM", parent: "SALES" },
    { code: "DEV", name: "開発部", kind: "DEPARTMENT", parent: null },
    { code: "DEV-PLATFORM", name: "プラットフォームチーム", kind: "TEAM", parent: "DEV" },
    { code: "DEV-APP", name: "アプリケーションチーム", kind: "TEAM", parent: "DEV" },
    { code: "ADMIN", name: "管理部", kind: "DEPARTMENT", parent: null },
    { code: "ADMIN-HR", name: "人事課", kind: "TEAM", parent: "ADMIN" },
    { code: "ADMIN-GA", name: "総務課", kind: "TEAM", parent: "ADMIN" },
  ] as const
  const unitIds = new Map<string, string>([
    ["COMPANY", String(companyUnit.attributes.organizationUnitId)],
  ])
  for (const unit of units) unitIds.set(unit.code, randomUUID())
  const unitId = (code: string) => {
    const id = unitIds.get(code)
    if (id === undefined) throw new SeedError(`組織 ${code} がありません`)
    return id
  }
  await write(
    "/company/organization-changes",
    "デモ用の組織を作成",
    units.map((unit) =>
      envelope("organization-unit", randomUUID(), startsOn, {
        organizationUnitId: unitId(unit.code),
        code: unit.code,
        officialName: unit.name,
        kind: unit.kind,
        parentOrganizationUnitId: unitId(unit.parent ?? "COMPANY"),
      }),
    ),
  )

  // 等級、役職、責務の定義
  const grades = [
    { code: "G1", name: "一般職1級", rank: 1 },
    { code: "G2", name: "一般職2級", rank: 2 },
    { code: "G3", name: "主任", rank: 3 },
    { code: "G4", name: "管理職1級", rank: 4 },
    { code: "G5", name: "管理職2級", rank: 5 },
  ] as const
  const positions = [
    { code: "PRESIDENT", name: "代表取締役", rank: 1 },
    { code: "GENERAL-MANAGER", name: "部長", rank: 2 },
    { code: "MANAGER", name: "課長", rank: 3 },
    { code: "LEADER", name: "リーダー", rank: 4 },
    { code: "STAFF", name: "担当", rank: 5 },
  ] as const
  const responsibilities = [
    { code: "DEPARTMENT-APPROVER", name: "部門の申請承認" },
    { code: "PEOPLE-OPERATIONS", name: "人事手続きの確認" },
  ] as const
  await write("/company/definitions", "デモ用の等級、役職、責務を定義", [
    ...grades.map((grade) =>
      envelope("grade", `grade:${grade.code}`, startsOn, {
        code: grade.code,
        officialName: grade.name,
        rank: grade.rank,
      }),
    ),
    ...positions.map((position) =>
      envelope("position", `position:${position.code}`, startsOn, {
        code: position.code,
        officialName: position.name,
        rank: position.rank,
      }),
    ),
    ...responsibilities.map((responsibility) =>
      envelope("responsibility", `responsibility:${responsibility.code}`, startsOn, {
        code: responsibility.code,
        officialName: responsibility.name,
      }),
    ),
  ])

  // 従業員。上長は先に並べる。
  const members = [
    {
      code: "E0002",
      name: "佐藤 花子",
      email: "hanako.sato@example.com",
      unit: "SALES",
      title: "部長",
      grade: "G5",
      manager: "E0001",
      type: "FULL_TIME",
      hired: startsOn,
    },
    {
      code: "E0003",
      name: "鈴木 一郎",
      email: "ichiro.suzuki@example.com",
      unit: "SALES-1",
      title: "課長",
      grade: "G4",
      manager: "E0002",
      type: "FULL_TIME",
      hired: startsOn,
    },
    {
      code: "E0004",
      name: "高橋 美咲",
      email: "misaki.takahashi@example.com",
      unit: "SALES-1",
      title: "担当",
      grade: "G2",
      manager: "E0003",
      type: "FULL_TIME",
      hired: startsOn,
    },
    {
      code: "E0005",
      name: "田中 健太",
      email: "kenta.tanaka@example.com",
      unit: "SALES-2",
      title: "課長",
      grade: "G4",
      manager: "E0002",
      type: "FULL_TIME",
      hired: startsOn,
    },
    {
      code: "E0006",
      name: "伊藤 さくら",
      email: "sakura.ito@example.com",
      unit: "SALES-2",
      title: "担当",
      grade: "G1",
      manager: "E0005",
      type: "PART_TIME",
      hired: "2025-04-01",
    },
    {
      code: "E0007",
      name: "渡辺 翔",
      email: "sho.watanabe@example.com",
      unit: "DEV",
      title: "部長",
      grade: "G5",
      manager: "E0001",
      type: "FULL_TIME",
      hired: startsOn,
    },
    {
      code: "E0008",
      name: "山本 優子",
      email: "yuko.yamamoto@example.com",
      unit: "DEV-PLATFORM",
      title: "リーダー",
      grade: "G3",
      manager: "E0007",
      type: "FULL_TIME",
      hired: startsOn,
    },
    {
      code: "E0009",
      name: "中村 大輔",
      email: "daisuke.nakamura@example.com",
      unit: "DEV-PLATFORM",
      title: "担当",
      grade: "G2",
      manager: "E0008",
      type: "FULL_TIME",
      hired: "2025-04-01",
    },
    {
      code: "E0010",
      name: "小林 真由",
      email: "mayu.kobayashi@example.com",
      unit: "DEV-APP",
      title: "リーダー",
      grade: "G3",
      manager: "E0007",
      type: "FULL_TIME",
      hired: startsOn,
    },
    {
      code: "E0011",
      name: "加藤 拓海",
      email: "takumi.kato@example.com",
      unit: "DEV-APP",
      title: "担当",
      grade: "G1",
      manager: "E0010",
      type: "FULL_TIME",
      hired: "2025-10-01",
    },
    {
      code: "E0012",
      name: "吉田 恵",
      email: "megumi.yoshida@example.com",
      unit: "ADMIN",
      title: "部長",
      grade: "G5",
      manager: "E0001",
      type: "FULL_TIME",
      hired: startsOn,
    },
    {
      code: "E0013",
      name: "山口 直樹",
      email: "naoki.yamaguchi@example.com",
      unit: "ADMIN-HR",
      title: "担当",
      grade: "G2",
      manager: "E0012",
      type: "FULL_TIME",
      hired: startsOn,
    },
    {
      code: "E0014",
      name: "松本 彩",
      email: "aya.matsumoto@example.com",
      unit: "ADMIN-GA",
      title: "担当",
      grade: "G2",
      manager: "E0012",
      type: "PART_TIME",
      hired: "2025-04-01",
    },
  ] as const
  const staff = new Map<string, { employeeId: string; employmentId: string; hired: string }>([
    ["E0001", { employeeId: company.employee_id, employmentId: rootEmploymentId, hired: startsOn }],
  ])
  for (const member of members) {
    staff.set(member.code, {
      employeeId: randomUUID(),
      employmentId: randomUUID(),
      hired: member.hired,
    })
  }
  const staffOf = (code: string) => {
    const found = staff.get(code)
    if (found === undefined) throw new SeedError(`従業員 ${code} がありません`)
    return found
  }
  const personIds = new Map(members.map((member) => [member.code, randomUUID()]))
  await write(
    "/company/people",
    "デモ用の人物を登録",
    members.map((member) =>
      envelope("person", String(personIds.get(member.code)), member.hired, {
        officialName: member.name,
        email: member.email,
      }),
    ),
  )
  await write(
    "/company/employees",
    "デモ用の従業員を登録",
    members.map((member) =>
      envelope("employee", staffOf(member.code).employeeId, member.hired, {
        personId: String(personIds.get(member.code)),
        employeeCode: member.code,
      }),
    ),
  )
  await write(
    "/company/employments",
    "デモ用の雇用を登録",
    members.map((member) =>
      envelope("employment", staffOf(member.code).employmentId, member.hired, {
        employeeId: staffOf(member.code).employeeId,
        status: "ACTIVE",
        employmentType: member.type,
      }),
    ),
  )

  // 所属、上長、等級、責務の任命
  await write(
    "/company/organization-changes",
    "デモ用の所属と上長を登録",
    members.flatMap((member) => {
      const self = staffOf(member.code)
      return [
        envelope("assignment", randomUUID(), member.hired, {
          employeeId: self.employeeId,
          employmentId: self.employmentId,
          organizationUnitId: unitId(member.unit),
          assignmentType: "PRIMARY",
          positionTitle: member.title,
        }),
        envelope("reporting-relation", randomUUID(), member.hired, {
          employeeId: self.employeeId,
          managerEmployeeId: staffOf(member.manager).employeeId,
          organizationUnitId: unitId(member.unit),
        }),
      ]
    }),
  )
  await write("/company/organization-changes", "デモ用の等級と責務を任命", [
    ...members.map((member) =>
      envelope("grade-assignment", randomUUID(), member.hired, {
        employeeId: staffOf(member.code).employeeId,
        employmentId: staffOf(member.code).employmentId,
        gradeId: `grade:${member.grade}`,
      }),
    ),
    ...members
      .filter((member) => member.title === "部長")
      .map((member) =>
        envelope("responsibility-assignment", randomUUID(), member.hired, {
          responsibilityId: "responsibility:DEPARTMENT-APPROVER",
          holderType: "employee",
          holderId: staffOf(member.code).employeeId,
          authorityScopeId: null,
          delegationAllowed: false,
        }),
      ),
    envelope("responsibility-assignment", randomUUID(), startsOn, {
      responsibilityId: "responsibility:PEOPLE-OPERATIONS",
      holderType: "employee",
      holderId: staffOf("E0013").employeeId,
      authorityScopeId: null,
      delegationAllowed: false,
    }),
  ])

  // 閲覧専用roleと共有のデモAccount
  const role = z.object({ id: z.string() }).parse(
    expectStatus(
      await call("POST", "/system/roles", {
        token: root,
        headers: elevated,
        body: {
          key: DEMO_ROLE_KEY,
          name: "デモ閲覧者",
          description: "公開デモの共有Account用。画面の閲覧に必要な参照権限だけを持つ",
          resource_type: null,
          permission_keys: DEMO_VIEWER_PERMISSION_KEYS,
        },
      }),
      201,
      "閲覧専用roleの作成",
    ),
  )
  const viewer = z
    .object({ id: z.string() })
    .parse(
      expectStatus(
        await call("POST", "/system/accounts", { token: root, headers: elevated }),
        201,
        "デモAccountの作成",
      ),
    )
  expectStatus(
    await call("POST", `/system/accounts/${viewer.id}/identities`, {
      token: root,
      headers: elevated,
      body: { provider: "password", email: viewerEmail, password: viewerPassword },
    }),
    201,
    "デモAccountのパスワード登録",
  )
  expectStatus(
    await call("POST", `/system/accounts/${viewer.id}/role-bindings`, {
      token: root,
      headers: elevated,
      body: { role_id: role.id, resource: null },
    }),
    201,
    "閲覧専用roleの割当",
  )
  // 申請の承認者にする従業員のAccount。ログイン手段を持たせず、デモからは操作できない。
  const approver = z
    .object({ id: z.string() })
    .parse(
      expectStatus(
        await call("POST", "/system/accounts", { token: root, headers: elevated }),
        201,
        "承認者Accountの作成",
      ),
    )
  // Companyの画面はAccountと従業員の対応を要求するため、架空の従業員へ紐付ける。
  const viewerEmployee = staffOf("E0003")
  const approverEmployee = staffOf("E0002")
  await write("/company/account-employee-links", "デモAccountと承認者を従業員へ紐付け", [
    envelope("account-employee-link", randomUUID(), viewerEmployee.hired, {
      accountId: viewer.id,
      employeeId: viewerEmployee.employeeId,
    }),
    envelope("account-employee-link", randomUUID(), approverEmployee.hired, {
      accountId: approver.id,
      employeeId: approverEmployee.employeeId,
    }),
  ])
  await login(viewerEmail, viewerPassword, "デモAccountのログイン確認")

  // 申請テンプレートと申請の例
  const templates = [
    {
      code: "equipment_purchase",
      name: "備品購入申請",
      category: "総務",
      description: "業務で使う備品の購入を申請します",
      fields: [
        {
          id: "item",
          label: "品名",
          type: "text",
          required: true,
          description: null,
          options: null,
        },
        {
          id: "amount",
          label: "金額（円）",
          type: "number",
          required: true,
          description: null,
          options: null,
        },
        {
          id: "reason",
          label: "購入理由",
          type: "textarea",
          required: true,
          description: null,
          options: null,
        },
      ],
    },
    {
      code: "business_trip",
      name: "出張申請",
      category: "総務",
      description: "出張の日程と目的を申請します",
      fields: [
        {
          id: "destination",
          label: "行き先",
          type: "text",
          required: true,
          description: null,
          options: null,
        },
        {
          id: "date",
          label: "出発日",
          type: "date",
          required: true,
          description: null,
          options: null,
        },
        {
          id: "purpose",
          label: "目的",
          type: "textarea",
          required: true,
          description: null,
          options: null,
        },
      ],
    },
    {
      code: "remote_work",
      name: "在宅勤務申請",
      category: "勤務",
      description: "在宅勤務の予定日を申請します",
      fields: [
        {
          id: "date",
          label: "実施日",
          type: "date",
          required: true,
          description: null,
          options: null,
        },
        {
          id: "style",
          label: "勤務形態",
          type: "select",
          required: true,
          description: null,
          options: ["終日", "午前のみ", "午後のみ"],
        },
      ],
    },
  ] as const
  for (const template of templates) {
    expectStatus(
      await call("POST", "/company/application-templates", {
        token: root,
        body: {
          code: template.code,
          name: template.name,
          category: template.category,
          description: template.description,
          schema_json: { fields: template.fields },
        },
      }),
      201,
      `申請テンプレート ${template.name} の作成`,
    )
    expectStatus(
      await call("PUT", `/company/application-templates/${template.code}/workflow`, {
        token: root,
        body: {
          version: 1,
          steps: [
            {
              key: "department_head",
              name: "部長承認",
              approvers: [{ type: "employee", employee_code: "E0002" }],
            },
          ],
          expected_revision: 0,
        },
      }),
      200,
      `申請テンプレート ${template.name} の承認経路の設定`,
    )
  }
  const applications = [
    {
      template_code: "equipment_purchase",
      payload: { item: "ノートPC用スタンド", amount: 4800, reason: "姿勢の改善のため" },
    },
    {
      template_code: "business_trip",
      payload: { destination: "大阪支店", date: "2026-11-12", purpose: "取引先との定例会議" },
    },
    { template_code: "remote_work", payload: { date: "2026-11-05", style: "終日" } },
  ] as const
  for (const application of applications) {
    expectStatus(
      await call("POST", "/company/application-requests", { token: root, body: application }),
      201,
      `申請の例 ${application.template_code} の提出`,
    )
  }

  console.log(
    [
      `デモデータを ${api} へ投入しました`,
      `組織 ${units.length}、従業員 ${members.length + 1}、等級 ${grades.length}、役職 ${positions.length}、申請テンプレート ${templates.length}、申請 ${applications.length}`,
      `デモAccount ${viewerEmail} に role ${DEMO_ROLE_KEY}（${DEMO_VIEWER_PERMISSION_KEYS.join(", ")}）を割り当てました`,
    ].join("\n"),
  )
}

try {
  await main()
} catch (caught) {
  console.error(caught instanceof SeedError ? caught.message : redact(String(caught)))
  process.exit(1)
}
