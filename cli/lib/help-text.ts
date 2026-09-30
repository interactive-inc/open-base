/**
 * base CLI のトップレベルヘルプ。引数なし・ルート直下 --help・未知コマンドの
 * フォールバック表示で使う。コマンド群の網羅は test/lib/help-text.test.ts で検証し、
 * 新しいコマンド群を追加して追記を忘れるとそのテストで落ちてドリフトを検知する。
 */
export const helpText = `base — 社内事務手続きの CLI

usage: base [command]

commands:
  login                                       ログインしてトークンを取得 (--email --password [--base-url])
  bootstrap                                   Systemと会社を初期化 (--email --password --company-data --idempotency-key)
  whoami                                      自分の情報を表示
  employees search                            社員検索 (--q --dept --status)
  employees register                          社員を登録
  employees show <code>                       社員の詳細
  employees update <code>                     社員情報を更新
  employees adoption                          確認済みの既存従業員履歴を公開正本へ接続
  employees timeline                          入社・配属・異動・退職の履歴
  employees state                             基準日現在の人事状態
  employees archive                           退職者を履歴保持してアーカイブ
  personnel-actions list                      人事発令の確定履歴を参照
  personnel-actions request                   人事変更を承認申請
  personnel-actions apply                     人事発令を直接確定
  personnel-actions correct                   確定済み発令を追記訂正
  application-requests templates              申請テンプレート一覧 (--category)
  application-requests template <code>        申請テンプレート詳細
  application-requests submit <code>          申請を提出 (--data <file>)
  application-requests inbox                  自分宛の承認待ち一覧
  application-requests mine                   自分の申請一覧 (--status)
  application-requests show <id>              申請の詳細
  application-requests approve <id>           申請を承認 (--comment)
  application-requests reject <id>            申請を却下 (--comment)
  application-requests workflow-repair list   修復が必要な承認フロー一覧
  application-requests workflow-repair reassign <id>  承認候補を再割当 (--candidates <id,id,...> --reason <text>)
  application-requests mine                   申請一覧
  application-requests show <id>              申請の詳細
  application-requests update <id>            申請を更新
  application-requests withdraw <id>          申請を取り下げ
  grade-definitions list                      等級の公開履歴 (--organization-id [--as-of --organization-revision])
  grade-definitions create                    等級を登録 (--data --idempotency-key)
  grade-definitions update                    等級を訂正 (--data --idempotency-key)
  grade-definitions delete                    等級を取消 (--data --idempotency-key)
  employee-grades list                        等級の割当履歴 (--organization-id --employee-id [--as-of --organization-revision])
  employee-grades create                      等級の割当を記録 (--data --idempotency-key)
  position-definitions list                      役職の公開履歴 (--organization-id [--as-of --organization-revision])
  position-definitions create                    役職を登録 (--data --idempotency-key)
  position-definitions update                    役職を訂正 (--data --idempotency-key)
  position-definitions delete                    役職を取消 (--data --idempotency-key)
  employee-events list                        異動・在籍イベント履歴 (--employee-id --kind)
  departments list                            部署一覧
  departments show                            部署の詳細
  departments create                          部署を作成
  departments update                          部署を更新
  departments delete                          部署を削除
  notifications show <id>                     通知の詳細
  notifications delete <id>                   通知を削除
  work-items                                  作業の依頼・受領・成果確認・責任の引き継ぎ
  batch                                       バッチ状況
  roles                                       ロール一覧（iam:read）
  accounts                                    アカウント一覧（iam:read）
  dashboard                                   ダッシュボード集計

options:
  --help, -h                  ヘルプを表示

詳細: base <command> --help`
