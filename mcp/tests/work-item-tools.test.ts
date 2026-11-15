import { testToolCases } from "@/tests/support/tool-cases"
import { workItemCases } from "@/tests/cases/work-items"

testToolCases(
  "MCP work item tools send the expected API requests and require step-up for decisions",
  workItemCases,
)
