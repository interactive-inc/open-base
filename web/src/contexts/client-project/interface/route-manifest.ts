export const clientProjectRouteManifest = [
  {
    method: "GET",
    path: "/client-project/records",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/client-project/interface/routes/client-project.records",
      exportName: "GET",
    },
  },
  {
    method: "POST",
    path: "/client-project/records",
    phase: "authenticated",
    handler: {
      kind: "module",
      module: "@/contexts/client-project/interface/routes/client-project.records",
      exportName: "POST",
    },
  },
] as const
