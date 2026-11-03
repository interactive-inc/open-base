export const offeringRouteManifest = [
  {
    method: "GET",
    path: "/offering/records",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/offering/interface/routes/offering.records",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/offering/records",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/offering/interface/routes/offering.records",
      exportName: "POST",
    },
  },
] as const
