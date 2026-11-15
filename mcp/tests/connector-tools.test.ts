import { testToolCases } from "@/tests/support/tool-cases"
import { connectorCases } from "@/tests/cases/connectors"

testToolCases("MCP connector and delivery tools send the expected API requests", connectorCases)
