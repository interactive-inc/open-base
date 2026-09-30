/** Company 権限の表示メタデータ。 */
export const COMPANY_PERMISSION_ENTRIES = [
  {
    key: "org:read",
    category: "org",
    appliesTo: "org",
    name: "会社参照",
    description:
      "法人向け画面（法人ホーム・サマリーなど）の入口を開きます。各画面内のデータを閲覧するには、その画面が扱うデータの参照権限が別途必要になります。",
  },
  {
    key: "org:write",
    category: "org",
    appliesTo: "org",
    name: "会社運営",
    description: "会社情報と組織構成を登録・編集できます。",
  },
  {
    key: "master:org:write",
    category: "org",
    appliesTo: "org",
    name: "会社マスタ編集",
    description: "会社全体で使用する組織マスタを編集できます。",
  },
  {
    key: "master:grade:write",
    category: "org",
    appliesTo: "org",
    name: "等級定義管理",
    description:
      "会社の等級定義を参照し、作成・改訂・取消できます。他の会社情報の変更資格は含みません。",
  },
  {
    key: "master:position:write",
    category: "org",
    appliesTo: "org",
    name: "役職定義管理",
    description:
      "会社の役職定義を参照し、作成・改訂・取消できます。他の会社情報の変更資格は含みません。",
  },
  {
    key: "employee:read",
    category: "hr",
    appliesTo: "org",
    name: "従業員名簿参照",
    description:
      "会社内の全従業員について、基本情報と資格を閲覧できます。等級や給与などの労務情報は含みません。",
  },
  {
    key: "employee:attributes:read",
    category: "hr",
    appliesTo: "org",
    name: "労務属性参照",
    description: "会社内の全従業員について、等級、号俸、基本給などの労務情報を閲覧できます。",
  },
  {
    key: "employee:write",
    category: "hr",
    appliesTo: "org",
    name: "従業員編集",
    description: "会社内の全従業員について、基本情報と労務情報を編集できます。",
  },
  {
    key: "employee:write:basic",
    category: "hr",
    appliesTo: "org",
    name: "従業員基本情報編集",
    description: "会社内の全従業員について、氏名や連絡先などの基本情報を編集できます。",
  },
  {
    key: "employee:write:attributes",
    category: "hr",
    appliesTo: "org",
    name: "労務属性編集",
    description: "会社内の全従業員について、等級、号俸、基本給などの労務情報を編集できます。",
  },
] as const
