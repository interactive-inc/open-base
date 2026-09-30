import { GetCurrentCompanyProfile } from "@/api/http/employees/get-current-company-profile"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"

// @authorization owner - System sessionとCompany従業員を合成し、本人の表示用profileだけを返す
export const GET = factory.createHandlers(verifyBearer, async (context) => {
  return context.json(await new GetCurrentCompanyProfile(context).execute(), 200)
})
