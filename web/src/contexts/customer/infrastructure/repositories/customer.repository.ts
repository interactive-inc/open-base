import type { CustomerCommand } from "@/contexts/customer/domain/customer-command"
import { saveCatalogRevision } from "@/lib/d1/save-catalog-revision"
import { readCatalogRevisions } from "@/lib/d1/read-catalog-revisions"
import type { CatalogStorageContext, CatalogQuery } from "@/lib/d1/catalog-storage"

export class CustomerRepository {
  constructor(private readonly c: CatalogStorageContext) {}

  list(query: CatalogQuery) {
    const table = "customer_catalog_revisions"
    const predicate = `EXISTS (SELECT 1 FROM json_each(snapshot_json, '$.aliases') alias WHERE instr(lower(alias.value), lower(?2)) > 0)`
    return readCatalogRevisions<CustomerCommand>(this.c, { table, predicate }, query)
  }

  save(command: CustomerCommand, key: string) {
    return saveCatalogRevision(
      this.c,
      { table: "customer_catalog_revisions", target: "customer" },
      { command, key },
    )
  }
}
