import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"

const meta = {
  title: "ui/Accordion",
  component: Accordion,
} satisfies Meta<typeof Accordion>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Accordion className="w-full max-w-lg">
      <AccordionItem value="item-1">
        <AccordionTrigger>利用開始方法は？</AccordionTrigger>
        <AccordionContent>
          管理者がアカウントを作成し、招待メールを送信します。届いたメールのリンクからパスワードを設定してログインしてください。
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>料金プランについて</AccordionTrigger>
        <AccordionContent>
          従業員数に応じた月額料金です。詳しくはお問い合わせください。
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>サポート体制について</AccordionTrigger>
        <AccordionContent>
          平日 9:00〜18:00 でチャットサポートをご利用いただけます。メールでのお問い合わせは 24
          時間受け付けています。
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}

export const Multiple: Story = {
  render: () => (
    <Accordion multiple className="w-full max-w-lg">
      <AccordionItem value="item-1">
        <AccordionTrigger>利用開始方法は？</AccordionTrigger>
        <AccordionContent>
          管理者がアカウントを作成し、招待メールを送信します。届いたメールのリンクからパスワードを設定してログインしてください。
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>料金プランについて</AccordionTrigger>
        <AccordionContent>
          従業員数に応じた月額料金です。詳しくはお問い合わせください。
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>サポート体制について</AccordionTrigger>
        <AccordionContent>
          平日 9:00〜18:00 でチャットサポートをご利用いただけます。メールでのお問い合わせは 24
          時間受け付けています。
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}

export const SingleItem: Story = {
  render: () => (
    <Accordion className="w-full max-w-lg">
      <AccordionItem value="item-1">
        <AccordionTrigger>詳細を表示</AccordionTrigger>
        <AccordionContent>
          ここに詳細な情報が表示されます。アコーディオンは1つだけでも使用できます。
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}

export const FAQ: Story = {
  render: () => (
    <Accordion className="w-full max-w-lg">
      <AccordionItem value="faq-1">
        <AccordionTrigger>従業員の登録方法を教えてください</AccordionTrigger>
        <AccordionContent>
          「従業員管理」メニューから「新規登録」ボタンをクリックし、必要な情報を入力してください。CSV
          による一括登録にも対応しています。
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="faq-2">
        <AccordionTrigger>勤怠の打刻を修正できますか？</AccordionTrigger>
        <AccordionContent>
          はい。「勤怠」メニューから該当日の打刻を選択し、修正申請を行ってください。上長の承認後に反映されます。
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="faq-3">
        <AccordionTrigger>休暇申請の承認フローはどうなっていますか？</AccordionTrigger>
        <AccordionContent>
          申請者 → 直属の上長 → 人事部
          の順で承認されます。承認・却下はメールとシステム内通知でお知らせします。
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="faq-4">
        <AccordionTrigger>経費精算の対象範囲を教えてください</AccordionTrigger>
        <AccordionContent>
          交通費、備品購入、接待費などが対象です。申請時に領収書の画像を添付してください。詳細は社内規定をご確認ください。
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="faq-5">
        <AccordionTrigger>パスワードを忘れた場合はどうすればよいですか？</AccordionTrigger>
        <AccordionContent>
          ログイン画面の「パスワードを忘れた方」リンクからリセットできます。登録メールアドレスにリセット用のリンクが送信されます。
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}
