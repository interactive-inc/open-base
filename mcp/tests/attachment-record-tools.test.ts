import { testToolCases } from "@/tests/support/tool-cases"
import { attachmentCases, recordCases } from "@/tests/cases/attachments-records"

testToolCases("MCP attachment tools send the expected API requests", attachmentCases)
testToolCases("MCP erasure and preserved record tools send the expected API requests", recordCases)
