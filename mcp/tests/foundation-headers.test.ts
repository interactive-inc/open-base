import { testToolCases, stepUp } from "@/tests/support/tool-cases"

/** 汎用の呼び出しでも、Companyの会社ID・期待版とSystemの再認証トークンを送れる。 */
testToolCases("foundation_request forwards organization, if-match and step-up headers", [
  {
    tool: "foundation_request",
    args: {
      path: "/company/organization-units",
      method: "POST",
      body: { reason: "Register" },
      idempotency_key: "unit-command-1",
      organization_id: "example-organization",
      if_match: "4",
    },
    method: "POST",
    path: "/company/organization-units",
    headers: {
      "x-company-organization-id": "example-organization",
      "if-match": "4",
      "idempotency-key": "unit-command-1",
    },
    body: { reason: "Register" },
  },
  {
    tool: "foundation_request",
    args: { path: "/system/batch-jobs", step_up_token: stepUp },
    method: "GET",
    path: "/system/batch-jobs",
    headers: { "x-system-step-up": stepUp },
    optionalStepUp: true,
  },
])
