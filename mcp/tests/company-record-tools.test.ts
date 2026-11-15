import { testToolCases } from "@/tests/support/tool-cases"
import { companyRecordCases } from "@/tests/cases/company-records"

testToolCases(
  "MCP Company record tools send organization, if-match and idempotency headers",
  companyRecordCases,
)
