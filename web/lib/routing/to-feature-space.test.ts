import { describe, expect, test } from "vite-plus/test"
import { toFeatureSpace } from "@/lib/routing/to-feature-space"

describe("toFeatureSpace", () => {
  test("ホームは本人の空間にする", () => {
    expect(toFeatureSpace("/")).toBe("my")
  })

  test("本人スコープと部署スコープ、受信箱と通知を本人の空間にする", () => {
    expect(toFeatureSpace("/my/expenses")).toBe("my")
    expect(toFeatureSpace("/teams/D001/members")).toBe("my")
    expect(toFeatureSpace("/teams/approval-delegations")).toBe("my")
    expect(toFeatureSpace("/inbox")).toBe("my")
    expect(toFeatureSpace("/notifications")).toBe("my")
  })

  test("所有者 prefix を持つ URL はその所有者の空間にする", () => {
    expect(toFeatureSpace("/system/accounts")).toBe("system")
    expect(toFeatureSpace("/company/employees")).toBe("company")
  })

  test("context 名で始まる App の全社ビューは業務の空間にする", () => {
    expect(toFeatureSpace("/expense/expenses")).toBe("apps")
    expect(toFeatureSpace("/dashboards/management")).toBe("apps")
  })

  test("prefix の一致は segment 単位で見る", () => {
    expect(toFeatureSpace("/mycompany/things")).toBe("apps")
    expect(toFeatureSpace("/teamsync/things")).toBe("apps")
  })
})
