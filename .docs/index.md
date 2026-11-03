# Open Base

この索引は、機能の所有者と実装状況を確認し、追加する機能の境界を検討するための入口です。

## 方針

- SystemとCompanyを共通基盤として保ち、業務を別contextで所有する。
- 主な利用入口はMCPとし、認可と不変条件はAPI側で強制する。
- 承認はSystem、会社上の資格はCompany、目標と評価は評価contextが所有する。
- 社内固有の設定・秘密値・実データを公開sourceへ含めない。

## 機能の全体像

- [網羅性と保守リスク](coverage.md)で、現状で支えられる運用と未対応領域を確認する。
- [System](layers/system.md)で、認証・認可・承認・監査などの共通機構を確認する。
- [Company](layers/company.md)で、法人・従業員・雇用・組織と判断資格の正本を確認する。
- [業務context](layers/business.md)で、実装済みの業務と追加候補の境界を確認する。

## 機能仕様と調査

- [目標管理と評価](features/performance-review.md)は、実装済み機能の仕様と操作手順。
- [顧客と商品・サービス](features/catalogs.md)は、独立した台帳の仕様。
- [クライアント案件](features/client-project.md)は、受託案件・工数と時間予実の仕様。
- [AI業務実行台帳](features/work-execution-design.md)は、業務登録と実行履歴の仕様。
- [勤怠と休暇](research/attendance-and-leave.md)は、日本で導入する場合のリスク、データ設計、実装境界の調査。

## 開発と運用

- 起動・検証・配備は[README](../README.md)を参照する。
- 実装規約と所有境界は[AGENTS.md](../AGENTS.md)を参照する。
