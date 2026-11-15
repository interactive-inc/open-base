import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readCurrentProfile } from "@/api/http/page-readers"
import { readEmployeeDirectory, readOrganizationUnits } from "@/api/http/employees-page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import {
  directoryPath,
  filtersToSearch,
  readFilters,
} from "@/components/app/employees-directory-query"
import type { DirectoryPage, OrganizationUnit } from "@/components/app/employees-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const filters = readFilters((name) => c.req.query(name))
  const user = getUser()
  if (user === null)
    return c.redirect(
      `/sign-in?next=${encodeURIComponent(`/employees${filtersToSearch(filters)}`)}`,
    )
  const [profile, directory, units] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readEmployeeDirectory<DirectoryPage>(c, directoryPath(filters)),
    readOrganizationUnits<ReadonlyArray<OrganizationUnit>>(c),
  ])
  return {
    email: user.email,
    pathname: "/employees",
    filters,
    initial: { profile, directory, units },
  }
})

export const head = defineHead(() => ({
  title: "従業員",
  bodyAttrs: { "data-shell": "app" },
}))
