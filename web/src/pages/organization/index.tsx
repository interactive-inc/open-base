import { Building2Icon, MousePointerClickIcon } from "lucide-react"
import { Link } from "@void/react"
import { useState, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tree,
  TreeItem,
  TreeItemIndicator,
  TreeItemLabel,
  visibleTreeRows,
  type TreeItemData,
} from "@/components/ui/tree"
import { EmptyState, Loaded, PageHeader, RowsSkeleton } from "@/components/app/data-view"
import { useCompanyJson } from "@/components/app/organization-api"
import { AsOfPicker, ChangeMark } from "@/components/app/organization-period"
import {
  addedSince,
  flattenTree,
  formatCalendarDate,
  pastOrganizationTree,
  todayOnCompanyCalendar,
  UNIT_KIND_LABEL,
  type CompanyResourceList,
  type MyOrganizationUnits,
  type OrganizationMember,
  type OrganizationTreeNode,
  type PastTreeNode,
} from "@/components/app/organization-types"
import { useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./index.server"

type OrganizationProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 組織図。今の姿を木で見せ、基準日を選ぶとその日の姿と今との違いを見せる。 */
export default function OrganizationChart({ organizationId, initial }: OrganizationProps) {
  const tree = useApiJson<OrganizationTreeNode[]>("/company/organization-tree", initial?.tree)
  const myUnits = useApiJson<MyOrganizationUnits>(
    "/company/my-organization-units",
    initial?.myUnits,
  )

  return (
    <>
      <PageHeader
        title="組織"
        description="部署のつながりと所属する人です。部署を選ぶと詳しく見られます。"
        badges={
          myUnits.kind === "ok" && myUnits.data.data.length > 0 ? (
            <>
              <span className="text-sm">あなたの所属</span>
              {myUnits.data.data.map((unit) => (
                <Badge
                  key={unit.code}
                  variant="secondary"
                  render={<Link href={`/organization/units/${encodeURIComponent(unit.code)}`} />}
                >
                  {unit.name}（{unit.assignment_type === "primary" ? "主務" : "兼務"}）
                </Badge>
              ))}
            </>
          ) : undefined
        }
      />

      <Loaded state={tree} fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
        {(current) =>
          current.length === 0 ? (
            <EmptyState
              icon={Building2Icon}
              title="組織単位がまだありません"
              description="CLI か MCP で組織単位を登録すると、ここに出ます。"
            />
          ) : (
            <Chart current={current} organizationId={organizationId} />
          )
        }
      </Loaded>
    </>
  )
}

/** 組織図と、選んだ組織単位を左右に並べる。基準日を選ぶと、その日の木に替える。 */
function Chart(props: { current: ReadonlyArray<OrganizationTreeNode>; organizationId: string }) {
  const today = todayOnCompanyCalendar()
  const [asOf, setAsOf] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const pastMode = asOf !== "" && asOf !== today
  const past = useCompanyJson<CompanyResourceList>(
    pastMode ? `/company/organization-snapshots?effective_on=${asOf}` : null,
    props.organizationId,
  )
  const snapshot = pastMode && past.kind === "ok" ? past.data : null
  const pastNodes = snapshot === null ? [] : pastOrganizationTree(snapshot.resources, props.current)

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section aria-labelledby="organization-chart">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="organization-chart">
                {pastMode ? `${formatCalendarDate(asOf)}の組織図` : "今の組織図"}
              </h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <AsOfPicker
              value={asOf}
              today={today}
              onChange={(value) => {
                setAsOf(value)
                setSelected(null)
              }}
              description="過去の日を選ぶと、その日の組織を表示します。"
            />
            <Separator />
            {pastMode ? (
              <Loaded state={past} fallback={<Skeleton className="h-64 w-full" />}>
                {(data) =>
                  pastNodes.length === 0 ? (
                    <p>この日には組織単位がありません。もっと後の日を選んでください。</p>
                  ) : (
                    <PastTree
                      nodes={pastNodes}
                      added={addedSince(data.resources, props.current)}
                      selected={selected}
                      onSelect={setSelected}
                    />
                  )
                }
              </Loaded>
            ) : (
              <FlatTree
                label="組織図"
                nodes={props.current}
                selected={selected}
                onSelect={setSelected}
                renderRow={(node) => (
                  <>
                    <span className="min-w-0 truncate">{node.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {node.member_count}人
                    </span>
                  </>
                )}
              />
            )}
          </CardContent>
        </Card>
      </section>
      {pastMode ? (
        <SelectedPastUnit nodes={pastNodes} selected={selected} />
      ) : (
        <SelectedUnit current={props.current} selected={selected} />
      )}
    </div>
  )
}

function SelectHint() {
  return (
    <EmptyState
      icon={MousePointerClickIcon}
      title="組織単位を選んでください"
      description="組織図から部署を選ぶと、ここに責任者と所属する人を表示します。"
    />
  )
}

type TreeShape = { code: string; name: string; children: ReadonlyArray<TreeShape> }

function toItems(nodes: ReadonlyArray<TreeShape>): TreeItemData[] {
  return nodes.map((node) => ({
    value: node.code,
    label: node.name,
    ...(node.children.length > 0 ? { children: toItems(node.children) } : {}),
  }))
}

function collect<T extends TreeShape>(nodes: ReadonlyArray<T>): T[] {
  return nodes.flatMap((node) => [node, ...collect(node.children as ReadonlyArray<T>)])
}

/**
 * 組織の木。行を平らに並べ、階層は木の側がARIAと字下げで伝える。
 * 入れ子の要素にすると、枝の行の読み上げ名に子の名前が混ざらないことをaxeが誤りとするため。
 */
function FlatTree<T extends TreeShape>(props: {
  label: string
  nodes: ReadonlyArray<T>
  selected: string | null
  onSelect: (code: string | null) => void
  renderRow: (node: T) => ReactNode
}) {
  const items = toItems(props.nodes)
  const byCode = new Map(collect(props.nodes).map((node) => [node.code, node]))
  const [expanded, setExpanded] = useState(() =>
    collect(props.nodes)
      .filter((node) => node.children.length > 0)
      .map((node) => node.code),
  )
  return (
    <Tree
      aria-label={props.label}
      items={items}
      expanded={expanded}
      onExpandedChange={setExpanded}
      value={props.selected}
      onValueChange={(value) => props.onSelect(typeof value === "string" ? value : null)}
      expandOnPress={false}
    >
      {visibleTreeRows(items, expanded).map(({ item }) => (
        <TreeItem key={item.value} value={item.value}>
          <TreeItemLabel>
            <TreeItemIndicator />
            {props.renderRow(byCode.get(item.value)!)}
          </TreeItemLabel>
        </TreeItem>
      ))}
    </Tree>
  )
}

function SelectedUnit(props: {
  current: ReadonlyArray<OrganizationTreeNode>
  selected: string | null
}) {
  const node = flattenTree(props.current).find(({ node }) => node.code === props.selected)?.node
  return node === undefined ? <SelectHint /> : <UnitPanel key={node.code} node={node} />
}

/** 選んだ組織単位の要約と所属する人。 */
function UnitPanel({ node }: { node: OrganizationTreeNode }) {
  const members = useApiJson<OrganizationMember[]>(
    `/company/organization-units/${encodeURIComponent(node.code)}/members`,
  )

  return (
    <section aria-labelledby="selected-unit">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="selected-unit" className="break-words">
              {node.name}
            </h2>
          </CardTitle>
          <CardDescription>
            コード {node.code} · 責任者 {node.manager_employee_code ?? "未設定"} ·{" "}
            {node.member_count}人
          </CardDescription>
          <CardAction>
            <Button
              variant="secondary"
              render={<Link href={`/organization/units/${encodeURIComponent(node.code)}`} />}
            >
              詳しく見る
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <h3 className="font-medium">所属する人</h3>
          <Loaded state={members} fallback={<RowsSkeleton rows={2} />}>
            {(list) =>
              list.length === 0 ? (
                <p>所属する人はいません。</p>
              ) : (
                <ul className="flex flex-col">
                  {list.map((member, index) => (
                    <li key={member.employee_code}>
                      {index > 0 && <ItemSeparator />}
                      <Item size="sm">
                        <ItemContent>
                          <ItemTitle>{member.employee_name}</ItemTitle>
                          <ItemDescription>
                            {member.employee_code}
                            {member.position !== null && ` · ${member.position}`}
                          </ItemDescription>
                        </ItemContent>
                        {member.is_manager && (
                          <ItemActions>
                            <Badge variant="secondary">責任者</Badge>
                          </ItemActions>
                        )}
                      </Item>
                    </li>
                  ))}
                </ul>
              )
            }
          </Loaded>
        </CardContent>
      </Card>
    </section>
  )
}

/** 基準日の組織図。今と違うところに印を付ける。 */
function PastTree(props: {
  nodes: ReadonlyArray<PastTreeNode>
  added: ReadonlyArray<string>
  selected: string | null
  onSelect: (code: string | null) => void
}) {
  return (
    <>
      <FlatTree
        label="基準日の組織図"
        nodes={props.nodes}
        selected={props.selected}
        onSelect={props.onSelect}
        renderRow={(node) => (
          <>
            <span className={`min-w-0 truncate ${node.removed ? "line-through" : ""}`}>
              {node.name}
            </span>
            <PastMarks node={node} />
          </>
        )}
      />
      {props.added.length > 0 && <p>この日より後に作られた組織単位: {props.added.join("、")}</p>}
    </>
  )
}

function SelectedPastUnit(props: { nodes: ReadonlyArray<PastTreeNode>; selected: string | null }) {
  const selected = collect(props.nodes).find((node) => node.code === props.selected)
  if (selected === undefined) return <SelectHint />
  return (
    <section aria-labelledby="selected-past-unit">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="selected-past-unit" className="break-words">
              {selected.name}
            </h2>
          </CardTitle>
          <CardDescription>
            コード {selected.code} · {UNIT_KIND_LABEL[selected.kind]}
          </CardDescription>
          {!selected.removed && (
            <CardAction>
              <Button
                variant="secondary"
                render={<Link href={`/organization/units/${encodeURIComponent(selected.code)}`} />}
              >
                今の姿と変更の履歴を見る
              </Button>
            </CardAction>
          )}
        </CardHeader>
        {marked(selected) && (
          <CardContent className="flex flex-col gap-4">
            <PastMarks node={selected} />
            {selected.removed && <p>この組織単位は今はありません。</p>}
          </CardContent>
        )}
      </Card>
    </section>
  )
}

/** 今の姿と違うところがあるか。 */
function marked(node: PastTreeNode): boolean {
  return node.removed || node.currentName !== null || node.moved
}

function PastMarks({ node }: { node: PastTreeNode }) {
  if (!marked(node)) return null
  return (
    <span className="flex flex-wrap gap-1">
      {node.removed && <ChangeMark>今は無い</ChangeMark>}
      {node.currentName !== null && <ChangeMark>{`今は「${node.currentName}」`}</ChangeMark>}
      {node.moved && <ChangeMark>今は別の上位組織</ChangeMark>}
    </span>
  )
}
