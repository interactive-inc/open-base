/** /company/capabilities */
import {
  COMPANY_API_VERSION,
  COMPANY_CORE_CAPABILITIES,
} from "@/contexts/company/interface/capabilities/company-capabilities"
import { createFactory } from "hono/factory"

const factory = createFactory()

// @authorization authenticated - capability catalog contains no company data
export const GET = factory.createHandlers((context) =>
  context.json(
    {
      apiVersion: COMPANY_API_VERSION,
      capabilities: COMPANY_CORE_CAPABILITIES,
    },
    200,
  ),
)
