import { testToolCases } from "@/tests/support/tool-cases"
import { companyAdminCases, companySelfCases } from "@/tests/cases/company-other"

testToolCases("MCP self-service Company tools send the expected API requests", companySelfCases)
testToolCases("MCP Company administration tools send the expected API requests", companyAdminCases)
