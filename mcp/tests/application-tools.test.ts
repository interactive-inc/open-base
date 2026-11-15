import { testToolCases } from "@/tests/support/tool-cases"
import { applicationCases } from "@/tests/cases/applications"

testToolCases(
  "MCP application tools send the expected API requests and never decide",
  applicationCases,
)
