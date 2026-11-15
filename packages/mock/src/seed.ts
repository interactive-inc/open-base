import { areas } from "./areas/index.ts"
import type { MockState, Scenario } from "./types.ts"

export const scenarios = [
  "admin",
  "member",
  "unlinked",
  "empty",
  "error",
  "slow",
  "signed-out",
] as const

/** 固定の架空値だけで、各画面を再現可能な初期状態へ戻す。 */
export function createMockState(scenario: Scenario = "admin"): MockState {
  if (!scenarios.includes(scenario)) throw new Error("BASE_MOCK_SCENARIO の値を確認してください")
  const empty = scenario === "empty"
  return {
    scenario,
    signedIn: scenario !== "signed-out",
    profile: {
      name: scenario === "member" ? "Example Member" : "Example Administrator",
      email: "you@example.com",
      dept_name: "開発部",
      position: scenario === "member" ? "メンバー" : "管理者",
      permissions: scenario === "member" ? [] : ["dashboard:view"],
    },
    dashboard: {
      employee_count: empty ? 0 : 148,
      pending_application_count: empty ? 0 : 27,
      department_breakdown: empty
        ? []
        : [
            { dept_name: "開発部", count: 72 },
            { dept_name: "営業部", count: 38 },
            { dept_name: "管理部", count: 24 },
            { dept_name: "とても長い名前の新規事業推進準備室", count: 14 },
          ],
      application_trend: ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"].map(
        (month, i) => ({ month, count: empty ? 0 : [18, 26, 12, 43, 32, 27][i]! }),
      ),
    },
    applications: empty ? 0 : 5,
    templates: empty ? [] : templates(),
    requests: empty ? [] : requests(),
    areas: Object.fromEntries(areas.map((area) => [area.name, area.seed(scenario)])),
    notifications: empty
      ? []
      : Array.from({ length: 24 }, (_, i) => ({
          id: `notification-${i + 1}`,
          title: ["申請が届きました", "組織情報が更新されました", "承認結果を確認してください"][
            i % 3
          ]!,
          read: i >= 7,
          createdAt: new Date(Date.UTC(2026, 10, 1, 9, i)).toISOString(),
        })),
    devices: { "DEMO-CODE": "pending" },
  }
}

function templates(): MockState["templates"] {
  return [
    {
      code: "leave",
      name: "休暇の申請",
      category: "勤怠",
      description: "休みを取る日と理由を届け出ます。",
      schema_json: {
        fields: [
          { id: "date", label: "休む日", type: "date", required: true, options: null },
          {
            id: "kind",
            label: "種類",
            type: "select",
            required: true,
            options: ["有給休暇", "特別休暇", "欠勤"],
          },
          { id: "reason", label: "理由", type: "textarea", required: false, options: null },
        ],
      },
    },
    {
      code: "purchase",
      name: "備品の購入",
      category: "経費",
      description: null,
      schema_json: {
        fields: [
          { id: "item", label: "品名", type: "text", required: true, options: null },
          { id: "amount", label: "金額", type: "number", required: true, options: null },
        ],
      },
    },
  ]
}

function requests(): MockState["requests"] {
  const at = (day: number) => new Date(Date.UTC(2026, 10, day, 1)).toISOString()
  return [
    {
      id: 101,
      templateCode: "leave",
      applicantName: "Example Member",
      mine: false,
      canDecide: true,
      status: "pending",
      payload: { date: "2026-11-20", kind: "有給休暇", reason: "私用のため" },
      createdAt: at(1),
      steps: [
        { key: "manager", name: "上長", status: "pending" },
        { key: "people", name: "人事", status: "waiting" },
      ],
      decisions: [],
    },
    {
      id: 102,
      templateCode: "purchase",
      applicantName: "とても長い名前の申請者 Example Applicant",
      mine: false,
      canDecide: true,
      status: "pending",
      payload: { item: "モニター", amount: 39800 },
      createdAt: at(12),
      steps: [{ key: "manager", name: "上長", status: "pending" }],
      decisions: [],
    },
    {
      id: 103,
      templateCode: "leave",
      applicantName: "Example Administrator",
      mine: true,
      canDecide: false,
      status: "pending",
      payload: { date: "2026-11-25", kind: "特別休暇" },
      createdAt: at(10),
      steps: [
        { key: "manager", name: "上長", status: "approved" },
        { key: "people", name: "人事", status: "pending" },
      ],
      decisions: [
        {
          id: 1,
          step_key: "manager",
          approver_name: "Example Manager",
          action: "approve",
          comment: "確認しました",
          created_at: at(11),
        },
      ],
    },
    {
      id: 104,
      templateCode: "purchase",
      applicantName: "Example Administrator",
      mine: true,
      canDecide: false,
      status: "rejected",
      payload: { item: "椅子", amount: 120000 },
      createdAt: at(3),
      steps: [{ key: "manager", name: "上長", status: "rejected" }],
      decisions: [
        {
          id: 2,
          step_key: "manager",
          approver_name: "Example Manager",
          action: "reject",
          comment: "予算を超えています",
          created_at: at(4),
        },
      ],
    },
  ]
}
