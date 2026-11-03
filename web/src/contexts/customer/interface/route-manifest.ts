export const customerRouteManifest = [
  {
    method: "GET",
    path: "/customer/records",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/customer/interface/routes/customer.records",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/customer/records",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/customer/interface/routes/customer.records",
      exportName: "POST",
    },
  },
] as const
