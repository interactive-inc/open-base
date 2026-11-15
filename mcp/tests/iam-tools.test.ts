import { testToolCases } from "@/tests/support/tool-cases"
import { iamCases } from "@/tests/cases/iam"

testToolCases("MCP role, permission and principal tools send the expected API requests", iamCases)
