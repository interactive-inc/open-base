import {
  Activity,
  ArrowLeftRight,
  Award,
  Bell,
  BookOpen,
  BookOpenCheck,
  Bot,
  Boxes,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  ClipboardCheck,
  ClipboardList,
  Coins,
  DoorOpen,
  FileClock,
  FileText,
  GitBranch,
  GraduationCap,
  HandHelping,
  HeartHandshake,
  Inbox,
  KeyRound,
  Laptop,
  LayoutDashboard,
  MailWarning,
  MessagesSquare,
  Package,
  PartyPopper,
  Plane,
  Plug,
  ScrollText,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  TriangleAlert,
  UserCog,
  UserMinus,
  Users,
  Wallet,
  Wrench,
} from "lucide-react"
import type {
  FeatureDefinition,
  FeatureGroup,
  FeatureNavigationVisibility,
  FeatureStatus,
  FeatureTier,
} from "@/lib/feature/feature-types"

const everyone: FeatureNavigationVisibility = { kind: "everyone" }

/**
 * Company の読み取り route が要求する権限。
 * api の companyActor middleware がこの 3 つの OR から company:read capability を導出するので、
 * nav もそれに合わせる（片方だけを条件にすると web と api で見え方が食い違う）。
 */
const companyReadVisibility: FeatureNavigationVisibility = {
  kind: "any-permission",
  permissions: ["employee:read", "org:manage", "system:admin"],
}

/**
 * 開発中はユーザ視点の利用レビューが完了していない機能を含む。
 */
export const featureRegistry: ReadonlyArray<FeatureDefinition> = [
  {
    slug: "dashboard",
    tier: "company",
    status: "available",
    group: "overview",
    icon: LayoutDashboard,
    prefetch: null,
    routes: [{ label: "ホーム", href: "/", visibility: everyone }],
  },
  {
    slug: "inbox",
    tier: "company",
    status: "available",
    group: "overview",
    icon: Inbox,
    prefetch: null,
    routes: [{ label: "受信箱", href: "/inbox", visibility: everyone }],
  },
  {
    slug: "notifications",
    tier: "system",
    status: "available",
    group: "overview",
    icon: Bell,
    prefetch: null,
    routes: [{ label: "通知", href: "/notifications", visibility: everyone }],
  },
  {
    slug: "applications",
    tier: "system",
    status: "available",
    group: "requests",
    icon: FileText,
    prefetch: null,
    routes: [
      { label: "申請", href: "/my/applications", visibility: everyone },
      {
        label: "部署の申請",
        href: "/teams/:team/applications",
        visibility: {
          kind: "any-permission",
          permissions: ["application:read:department", "application:read:all"],
        },
      },
      {
        label: "全社の申請",
        href: "/system/applications",
        visibility: { kind: "permission", permission: "application:read:all" },
      },
      {
        label: "申請テンプレート",
        href: "/system/application-templates",
        visibility: { kind: "permission", permission: "application_template:manage" },
      },
      {
        label: "ワークフロー修復",
        href: "/system/workflow-repairs",
        visibility: {
          kind: "all-permissions",
          permissions: ["application:read:all", "application_template:manage"],
        },
      },
    ],
  },
  {
    slug: "approval-delegations",
    tier: "system",
    status: "development",
    group: "requests",
    icon: ClipboardCheck,
    prefetch: null,
    routes: [
      {
        label: "代理承認の設定",
        href: "/teams/approval-delegations",
        visibility: {
          kind: "any-permission",
          permissions: ["employee:read", "application:approve"],
        },
      },
    ],
  },
  {
    slug: "company-profile",
    tier: "company",
    status: "development",
    group: "company-legal-entity",
    icon: Building2,
    prefetch: null,
    routes: [
      {
        label: "会社と法人",
        href: "/company/profile",
        visibility: companyReadVisibility,
      },
    ],
  },
  {
    slug: "employees",
    tier: "company",
    status: "available",
    group: "company-people",
    icon: Users,
    prefetch: null,
    routes: [
      {
        label: "従業員",
        href: "/company/employees",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "company-people",
    tier: "company",
    status: "development",
    group: "company-people",
    icon: Users,
    prefetch: null,
    routes: [
      {
        label: "人",
        href: "/company/people",
        visibility: companyReadVisibility,
      },
    ],
  },
  {
    slug: "company-employments",
    tier: "company",
    status: "development",
    group: "company-people",
    icon: BookOpenCheck,
    prefetch: null,
    routes: [
      {
        label: "雇用",
        href: "/company/employments",
        visibility: companyReadVisibility,
      },
    ],
  },
  {
    slug: "departments",
    tier: "company",
    status: "available",
    group: "company-organization",
    icon: GitBranch,
    prefetch: null,
    routes: [
      {
        label: "組織図",
        href: "/company/departments",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "company-organization-snapshots",
    tier: "company",
    status: "development",
    group: "company-organization",
    icon: FileClock,
    prefetch: null,
    routes: [
      {
        label: "組織の時点断面",
        href: "/company/organization-snapshots",
        visibility: companyReadVisibility,
      },
    ],
  },
  {
    slug: "company-definitions",
    tier: "company",
    status: "development",
    group: "company-responsibility",
    icon: ScrollText,
    prefetch: null,
    routes: [
      {
        label: "職務と責任",
        href: "/company/definitions",
        visibility: companyReadVisibility,
      },
    ],
  },
  {
    slug: "company-account-employee-links",
    tier: "company",
    status: "development",
    group: "company-system-link",
    icon: KeyRound,
    prefetch: null,
    routes: [
      {
        label: "Account の対応",
        href: "/company/account-employee-links",
        visibility: companyReadVisibility,
      },
    ],
  },
  {
    slug: "company-personnel-actions",
    tier: "company",
    status: "development",
    group: "company-employment-fact",
    icon: UserCog,
    prefetch: null,
    routes: [
      {
        label: "人事発令",
        href: "/company/personnel-actions",
        visibility: { kind: "any-permission", permissions: ["employee:read", "system:admin"] },
      },
    ],
  },
  {
    slug: "company-employee-events",
    tier: "company",
    status: "development",
    group: "company-employment-fact",
    icon: FileClock,
    prefetch: null,
    routes: [
      {
        label: "雇用事実",
        href: "/company/employee-events",
        visibility: companyReadVisibility,
      },
    ],
  },
  {
    slug: "direct-reports",
    tier: "company",
    status: "development",
    group: "team",
    icon: Users,
    prefetch: null,
    routes: [
      {
        label: "マイチーム",
        href: "/my/direct-reports",
        visibility: {
          kind: "any-permission",
          permissions: ["employee:read", "application:approve"],
        },
      },
    ],
  },
  {
    slug: "team-management",
    tier: "company",
    status: "development",
    group: "people",
    icon: Users,
    prefetch: null,
    routes: [
      {
        label: "メンバー",
        href: "/teams/:team/members",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "grades",
    tier: "company",
    status: "development",
    group: "company-responsibility",
    icon: Award,
    prefetch: null,
    routes: [
      {
        label: "等級",
        href: "/company/grades",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "positions",
    tier: "company",
    status: "development",
    group: "company-responsibility",
    icon: Briefcase,
    prefetch: null,
    routes: [
      {
        label: "役職",
        href: "/company/positions",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "roles",
    tier: "system",
    status: "available",
    group: "system-authorization",
    icon: KeyRound,
    prefetch: null,
    routes: [
      {
        label: "ロール",
        href: "/system/roles",
        visibility: { kind: "permission", permission: "iam:read" },
      },
    ],
  },
  {
    slug: "permission-definitions",
    tier: "system",
    status: "available",
    group: "system-authorization",
    icon: ShieldCheck,
    prefetch: null,
    routes: [
      {
        label: "権限定義",
        href: "/system/permission-definitions",
        // api の handler は system:admin か iam:write のどちらかを要求する。
        // iam:read では 403 になるので、nav もこの 2 キーの OR に合わせる。
        visibility: { kind: "any-permission", permissions: ["iam:write", "system:admin"] },
      },
    ],
  },
  {
    slug: "accounts",
    tier: "system",
    status: "available",
    group: "system-principal",
    icon: UserCog,
    prefetch: null,
    routes: [
      {
        label: "アカウント",
        href: "/system/accounts",
        visibility: { kind: "permission", permission: "iam:read" },
      },
    ],
  },
  {
    slug: "principals",
    tier: "system",
    status: "available",
    group: "system-principal",
    icon: Bot,
    prefetch: null,
    routes: [
      {
        label: "Principal",
        href: "/system/principals",
        visibility: { kind: "permission", permission: "iam:read" },
      },
    ],
  },
  {
    slug: "audit",
    tier: "system",
    status: "available",
    group: "system-record",
    icon: FileClock,
    prefetch: false,
    routes: [
      {
        label: "監査ログ",
        href: "/system/audit-events",
        visibility: { kind: "permission", permission: "audit:read" },
      },
    ],
  },
  {
    slug: "deliveries",
    tier: "system",
    status: "available",
    group: "system-async",
    icon: Send,
    prefetch: null,
    routes: [
      {
        label: "配信",
        href: "/system/deliveries",
        visibility: { kind: "permission", permission: "batch:view" },
      },
    ],
  },
  {
    slug: "dead-letters",
    tier: "system",
    status: "available",
    group: "system-async",
    icon: MailWarning,
    prefetch: null,
    routes: [
      {
        label: "dead letter",
        href: "/system/dead-letters",
        visibility: { kind: "permission", permission: "batch:view" },
      },
    ],
  },
  {
    slug: "connectors",
    tier: "system",
    status: "available",
    group: "system-integration",
    icon: Plug,
    prefetch: null,
    routes: [
      {
        // api の route は integration:read を要求するが、このキーは権限カタログに無く
        // ロールから付与できない。実際に到達できるのは system:admin だけなので、
        // nav も system:admin にする（integration:read だと誰にも出ない）。
        label: "コネクタ",
        href: "/system/connectors",
        visibility: { kind: "permission", permission: "system:admin" },
      },
    ],
  },
  {
    slug: "integration-exchanges",
    tier: "system",
    status: "available",
    group: "system-integration",
    icon: ArrowLeftRight,
    prefetch: null,
    routes: [
      {
        label: "外部交換",
        href: "/system/integration-exchanges",
        visibility: { kind: "permission", permission: "system:admin" },
      },
    ],
  },
  {
    slug: "health",
    tier: "system",
    status: "available",
    group: "system-operation",
    icon: Activity,
    prefetch: null,
    routes: [
      {
        // api の route は未認証で到達できるが、システムタブは運用者の空間なので
        // 画面と nav は system:admin に絞る。
        label: "health",
        href: "/system/health",
        visibility: { kind: "permission", permission: "system:admin" },
      },
    ],
  },
  {
    slug: "batches",
    tier: "system",
    status: "available",
    group: "system-async",
    icon: Wrench,
    prefetch: null,
    routes: [
      {
        label: "バッチ",
        href: "/system/batches",
        visibility: { kind: "permission", permission: "batch:view" },
      },
    ],
  },
]

export const featureGroupOrder: ReadonlyArray<FeatureGroup> = [
  "overview",
  "team",
  "system-principal",
  "system-authorization",
  "system-case",
  "system-record",
  "system-async",
  "system-integration",
  "system-operation",
  "company-legal-entity",
  "company-people",
  "company-organization",
  "company-responsibility",
  "company-system-link",
  "company-employment-fact",
  "people",
  "time",
  "requests",
  "growth",
  "communication",
  "workplace",
  "governance",
  "system",
]

export const featureGroupLabels: Record<FeatureGroup, string> = {
  overview: "概要",
  team: "部署",
  "system-principal": "主体と認証",
  "system-authorization": "技術的認可",
  "system-case": "案件と判断",
  "system-record": "記録と証拠",
  "system-async": "非同期実行と通知",
  "system-integration": "外部接続",
  "system-operation": "運用",
  "company-legal-entity": "会社と法人",
  "company-people": "人と雇用",
  "company-organization": "組織",
  "company-responsibility": "職務と責任",
  "company-system-link": "System との対応",
  "company-employment-fact": "雇用事実と人事発令",
  people: "人と組織",
  time: "時間と予定",
  requests: "申請と手続き",
  growth: "成長と評価",
  communication: "情報共有",
  workplace: "資産と施設",
  governance: "経営と統制",
  system: "システム運用",
}

export const featureTierLabels: Record<FeatureTier, string> = {
  system: "システム層",
  company: "company",
  "app-default": "app-default",
  "app-opt-in": "app-opt-in",
}

export const featureStatusLabels: Record<FeatureStatus, string> = {
  available: "使用可能",
  development: "開発中",
  "retirement-candidate": "廃止候補",
}
