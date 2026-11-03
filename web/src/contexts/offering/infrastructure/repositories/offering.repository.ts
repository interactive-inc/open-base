import type { OfferingCommand } from "@/contexts/offering/domain/offering-command"
import { saveCatalogRevision } from "@/lib/d1/save-catalog-revision"
import { readCatalogRevisions } from "@/lib/d1/read-catalog-revisions"
import type { CatalogStorageContext, CatalogQuery } from "@/lib/d1/catalog-storage"

export class OfferingRepository {
  constructor(private readonly c: CatalogStorageContext) {}

  list(query: CatalogQuery) {
    const table = "offering_catalog_revisions"
    const predicate = `instr(lower(json_extract(snapshot_json, '$.code')), lower(?2)) > 0`
    return readCatalogRevisions<OfferingCommand>(this.c, { table, predicate }, query)
  }

  save(command: OfferingCommand, key: string) {
    return saveCatalogRevision(
      this.c,
      { table: "offering_catalog_revisions", target: "offering" },
      { command, key },
    )
  }
}
