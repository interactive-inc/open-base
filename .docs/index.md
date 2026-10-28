# Open Base

## 方針

- SystemとCompanyを共通基盤として保ち、業務を別contextで所有する。
- 主な利用入口はMCPとし、認可と不変条件はAPI側で強制する。
- 承認はSystem、会社上の資格はCompany、目標と評価は評価contextが所有する。
- 社内固有の設定・秘密値・実データを公開sourceへ含めない。

## 機能

- [目標管理と評価](features/performance-review.md)
- 起動と検証、配備は[README](../README.md)を参照する。
