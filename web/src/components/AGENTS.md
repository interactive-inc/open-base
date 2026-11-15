# UI 開発

- 部品は `web/src/components/ui/<name>.tsx` に置いた部品集を使い、画面と `app/` は `@/components/ui/<name>` からimportする。振る舞い（キーボード、focus、ARIA、エージェントからの操作）は部品が持つので、roleやaria属性、キーの処理を自分で書かない。`@ui-sdk/react` を画面から直接importしない。
- `ui/` の部品はshadcnの配布形式で取り込んだもので、手で書き換えない。足すときと更新するときは配布元の手順で取り込み直す。配布元の場所はリポジトリに書かず、`components.json` にも残さない。
- 部品を使う前に、その部品の使い方（配布元の案内の該当頁）を読む。部品集に無い部品を素の要素で手書きしない。素の `<button>`、`<input>`、`<select>`、`<textarea>`、`<label>` を置かない。
- 色は役割のtokenで書く（`bg-sidebar`、`bg-page`、`bg-card`、`bg-muted`、`bg-secondary`、`bg-primary`、`text-foreground`、`text-muted-foreground`、`border-border`、`text-destructive`）。oklchやhex、`gray-100` のような色を部品や画面に書かない。値は `globals.css` だけに書き、明暗は `light-dark()` で一か所に並べる。`dark:` の上書きは要らない。
- 面は外から順に、枠（sidebar。ヘッダーとサイドバー）、ページの地（page）、カード（card）、控えめな面（muted）。順番を飛ばしたり入れ替えたりしない。面の境目は色の差で見せ、枠線は面の中の区切りと入力欄だけに使う。
- 主の操作は一つの面に一つだけ `Button`（既定）。それ以外は `variant="secondary"`、取り消せない操作は `variant="destructive"`。色相を持つのはdestructiveと図表だけ。
- ボタンに見えるリンクは `<Button variant="secondary" render={<Link href="…" />}>`。`asChild` は無い。変化は `onValueChange`、`onCheckedChange`、`onOpenChange` で受ける。
- 同じclassの並びを定数にして複数の画面へ写さない。二つ目が要る時点で `app/` の共通の組み立てにする。`app/` は部品を包み直す層ではなく、画面の組み立て（見出し、空の状態、読み込み中、枠）だけを置く。
- 画面の確認は、モックのアプリ（`bun run --cwd web dev:mock`、サインイン不要）を開き、開発時だけ読み込まれる橋渡し `window.agent` を使う。`agent.snapshot()` で部品の一覧と状態、`agent.query()` で選択肢、`agent.act()` で操作ができる。スクリーンショットは見た目を確かめるときだけ使う。橋渡しは `client/dev-agent.ts` にあり、production buildには入らない。
- 操作できる部品には、画面の中で一意な名前を付ける（`FieldLabel`、`aria-label`、ボタンの文字）。人の確認が要る操作には `data-agent-confirm`、読ませない値には `data-agent-secret` を付ける。
- 新しいページと `app/` の部品には同じ責務のstoryを追加する。状態、操作、失敗とキーボードの動作を確認する。

## 配置

- 画面は三つの領域でできている。上の端から端までのヘッダー、その下の左のサイドバー、右のページ。ヘッダーとサイドバーは同じ面で、スクロールで動くのはページだけ。枠は `app/app-shell.tsx` が描く。
- ヘッダーにはサービス全体のもの（名前、本人のメニュー）、サイドバーには画面の移動だけを置く。その画面だけのものは全てページの中に置く。領域の中の画面を行き来する並びは、サイドバーの子項目（`app-shell.tsx` の `children`）に足す。
- 見出しの行は、名前を左、操作を右の端に置く。右に置くのは操作だけで、分類や外部へのリンクは名前の下の `Badge` にする（`data-view.tsx` の `PageHeader`）。
- ページは見出し（h1と一〜二文の説明）と、その下に積むsection。sectionは `Card` で包み、`CardTitle` の中にh2を置く。sectionに効く操作は `CardAction`、締めの操作は `CardFooter` の右端。
- 同じ形の項目の一覧は、全体を一枚のCardに入れず、見出しを外に出して一件ごとにCard（一行で足りるなら `Item`）にする。行と列で比べる記録は `Table`。Cardを入れ子にせず、中は `Separator` か控えめな面で分ける。
- 間隔は三段。sectionの間は32px（`gap-8`）、sectionの中は16px（`gap-4`）、並んだ部品の間は8px（`gap-2`）。画面の端からは24px（狭い画面は16px）。余白と角丸は部品に任せる。
- 一件も無いときは `Empty`（`data-view.tsx` の `EmptyState`）、読み込み中は `Skeleton`、失敗や注意は `Alert`、状態は `Badge`、経過は `Timeline`、階層は `Tree`。同じ一覧の絞り込みの切り替えは `ViewSwitch`（4つまで。多ければ `Select`）。
- 入力は `Field` と `FieldLabel` で包み、複数なら `FieldGroup` に縦に並べる。エラーは `FieldError` でその入力の中に出す。取り消せない操作の確認は `AlertDialog`。

## 画面の作り

- 画面は `web/src/pages/<領域>/` に置き、同名の `.server.ts` で `ssr = false`、`loader`、`head` を持つ。loaderは最初の表示に要るデータを `pageApiReader` で読み、`initial` で渡す。
- 画面は枠を描かない。ヘッダーとサイドバーの枠は `pages/layout.tsx` が一度だけ描き、画面を移っても作り直さない。本人の情報は `middleware/01.viewer.ts` が共有データに載せ、レイアウトが `useShared()` で読む。サインイン前後の手続きの画面は `export const layout = "bare"` で `_layouts/bare.tsx` を選ぶ。
- 画面の中の移動は `@void/react` の `Link` を使う（再読み込みなしで移る）。素の `<a>` はページ内の移動と外部だけに使う。API へ送る移動は `reloadDocument` を付ける。
- Voidの外（Storybookとモック）では、`StandaloneAppShell` が同じ枠を付ける。Storybookは `.storybook/preview.tsx` の decorator、モックは `mock/main.tsx` が付ける。
- 画面の `initial` は省略可にする。Storybookとモックは `useApiJson` がブラウザーで読む。
- 一覧・詳細・作成の共通の表示は `data-view.tsx`、読み書きは `use-api-json.ts`、段階の帯は `phase-bar.tsx` を使う。領域だけで使う部品は `<領域>-*.tsx` に置く。
- 画面と `components/app` の部品には、同じ階層・同じ名前のstoryを必ず置く。空・読み込み中・失敗・狭い幅・主な操作を持つ。
- 画面は見るだけにする。作成、変更、削除、取消のフォームやボタンを置かない。書き込みはCLIとMCPで行う。空の状態では「CLI か MCP で登録すると、ここに出ます。」のように案内する。画面に残す書き込みは、通知の既読とサインアウト、判断の専用画面だけ。
- 承認・却下・差し戻しは `pages/decisions/<対象>/[id].tsx` の専用画面で行う。`export const layout = "bare"` と `AuthFrame` を使い、判断に要る情報とボタンだけを出す。通常の一覧・詳細には、判断できる人にだけ専用画面への入口を出す。
- 認可はサーバーが正本。画面は権限を自前で判定して隠さず、APIが断った結果を表示する。
