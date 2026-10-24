/** API rootへ公開するcanonical Company contextの境界。 */
export const companyContextModule = {
  context: "company",
  tier: "company",
  routesDirectory: "contexts/company/interface/routes",
  routeImportPrefix: "@/contexts/company/interface/routes",
} as const
