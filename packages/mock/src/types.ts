export type Scenario = "admin" | "member" | "unlinked" | "empty" | "error" | "slow" | "signed-out"
export type MockNotification = { id: string; title: string; read: boolean; createdAt: string }
export type MockState = {
  scenario: Scenario
  signedIn: boolean
  profile: {
    name: string
    email: string
    dept_name: string
    position: string
    permissions: string[]
  }
  dashboard: {
    employee_count: number
    pending_application_count: number
    department_breakdown: { dept_name: string; count: number }[]
    application_trend: { month: string; count: number }[]
  }
  applications: number
  templates: MockTemplate[]
  requests: MockRequest[]
  /** 機能の領域ごとの状態。領域の名前で引く。中身の型は各領域が持つ。 */
  areas: Record<string, unknown>
  notifications: MockNotification[]
  devices: Record<string, "pending" | "approved" | "denied">
}

export type MockTemplate = {
  code: string
  name: string
  category: string
  description: string | null
  schema_json: {
    fields: {
      id: string
      label: string
      type: "text" | "textarea" | "number" | "date" | "select"
      required: boolean
      options: string[] | null
    }[]
  }
}

export type MockStepStatus = "waiting" | "pending" | "approved" | "rejected" | "returned"

/** 申請の一件。`mine` は本人が出したもの、`canDecide` は本人が判断する番のもの。 */
export type MockRequest = {
  id: number
  templateCode: string
  applicantName: string
  mine: boolean
  canDecide: boolean
  status: "pending" | "approved" | "rejected"
  payload: Record<string, string | number>
  createdAt: string
  steps: { key: string; name: string; status: MockStepStatus }[]
  decisions: {
    id: number
    step_key: string
    approver_name: string
    action: "approve" | "reject"
    comment: string | null
    created_at: string
  }[]
}
