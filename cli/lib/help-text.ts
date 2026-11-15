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
  step-up                                     高リスク操作の直前の本人確認 (--password-stdin | --external-identity-token-stdin)
  employees search                            社員検索 (--q --dept --status)
  employees register                          社員を登録
  employees show <code>                       社員の詳細
  employees update <code>                     社員情報を更新
  employees adoption                          確認済みの既存従業員履歴を公開正本へ接続
  employees timeline                          入社・配属・異動・退職の履歴
  employees state                             基準日現在の人事状態
  personnel-actions list                      人事発令の確定履歴を参照
  personnel-actions request                   人事変更を承認申請
  personnel-actions apply                     人事発令を直接確定
  personnel-actions correct                   確定済み発令を追記訂正
  personnel-actions events                    確定した人事発令を追記順に読む
  personnel-actions requests                  人事変更の申請一覧
  application-requests templates              申請テンプレート一覧 (--category)
  application-requests template <code>        申請テンプレート詳細
  application-requests submit <code>          申請を提出 (--data <file>)
  application-requests inbox                  自分宛の承認待ち一覧
  application-requests mine                   自分の申請一覧 (--status)
  application-requests me                     自分が作成した申請 (--limit --offset)
  application-requests admin                  全社の申請一覧（application:read:all）
  application-requests show <id>              申請の詳細
  application-requests decide <id>            判断の画面のURLを表示（承認・却下はブラウザーで行う）
  application-requests workflow-repair list   修復が必要な承認フロー一覧
  application-requests workflow-repair reassign <id>  承認候補を再割当 (--candidates <id,id,...> --reason <text>)
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
  notifications send-accounts                 任意のAccountへ通知を配信 (--data)
  notifications delete <id>                   通知を削除
  work-items                                  作業の依頼・受領・成果確認・責任の引き継ぎ
  reviews                                     評価期間・目標・自己評価・判断の画面・履歴
  work-execution                              業務定義とAgentの実行履歴
  client-project                              受託案件・工数の記録と予実
  customer                                    顧客台帳
  offering                                    商品・サービス台帳
  batch                                       バッチ状況
  roles                                       Roleと権限の定義（引数なしで一覧）
  accounts                                    Account・Identity・Role Binding・従業員との対応（引数なしで一覧）
  principals                                  Agent・Service・ConnectorのPrincipalと機械credential
  company                                     Companyの正本・履歴・会社の設定
  audit                                       監査イベントと開示条件
  connectors                                  外部接続の定義・交換・照合・配送
  attachments                                 添付の預け入れ・取り出し・保全
  records                                     個人情報の消去・保全記録・案件の版
  dashboard                                   ダッシュボード集計

options:
  --help, -h                  ヘルプを表示

詳細: base <command> --help`
