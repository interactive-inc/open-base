import Link from "next/link"
import { PageHeader } from "@/components/page-header"

export default function HomePage() {
  return (
    <>
      <PageHeader title={process.env.NEXT_PUBLIC_APP_NAME ?? "Open Base"} />
      <p>System と Company の共通基盤</p>
      <nav className="flex gap-6">
        <Link href="/company/employees">従業員</Link>
        <Link href="/company/departments">組織</Link>
        <Link href="/system/applications">申請</Link>
      </nav>
    </>
  )
}
