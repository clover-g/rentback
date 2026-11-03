"use client";
import { useI18n } from "@/lib/i18n";
const QA = {
  ja: [
    ["戻ってくるSOLって何？", "トークンを入れる「口座」を作ると、Solanaでは少しのSOLを預け金（敷金のようなもの）として置いておく決まりがあります。中身が空になった口座を閉じると、その敷金があなたのウォレットに戻ってきます。"],
    ["安全なの？", "シードフレーズや秘密鍵を聞くことは絶対にありません。お金を預かることもありません。取引の中身は署名の前にあなたのウォレットに表示され、あなたが承認したときだけ実行されます。"],
    ["手数料はいくら？", "戻ってきたSOLの3%だけです。たとえば0.002 SOL戻ったら、手数料は0.00006 SOL。ほかにネットワーク手数料（1回約0.000005 SOL）がウォレットからかかります。"],
    ["「0件」と出た。壊れてる？", "壊れていません。閉じられるのは中身が空の口座だけです。空の口座がない、またはトークンがまだ残っている場合は0件になります。"],
    ["1口座でどのくらい戻る？", "その口座に入っている預け金がまるごと戻ります。古い口座ならだいたい約0.002 SOL、2026年9月のルール変更後に作った口座は約0.0015 SOLです。"],
    ["使えるウォレットは？", "Phantomです。パソコンの拡張機能や、ウォレットアプリ内のブラウザから開くと、Backpackなど他のウォレットも自動で見つかることがあります。"],
    ["かんたんとプロの違いは？", "かんたんは空の口座を閉じるだけなので、トークンは減りません。プロでは、いらないトークンやNFTを焼却して口座を閉じることもできます。焼却は取り消せないので、選ぶものをよく確認してください。"],
  ],
  en: [
    ["What is the SOL I get back?", "Every token account on Solana holds a small SOL deposit, a bit like a rental deposit. When you close an empty account, that deposit comes back to your wallet."],
    ["Is it safe?", "We never ask for your seed phrase or private key, and we never hold your funds. Your wallet shows every transaction before you sign, and nothing happens unless you approve it."],
    ["What is the fee?", "Only 3% of the SOL you get back. For example, if 0.002 SOL comes back, the fee is 0.00006 SOL. Your wallet also pays the network fee (about 0.000005 SOL per transaction)."],
    ["It says 0 accounts. Is it broken?", "No. Only empty accounts can be closed. If you have no empty accounts, or they still hold tokens, you will see 0."],
    ["How much per account?", "You get the account's whole deposit back: about 0.002 SOL for older accounts, and about 0.0015 SOL for accounts created after the September 2026 rent change."],
    ["Which wallets work?", "Phantom. Other wallets such as Backpack may also be detected automatically in a desktop extension or a wallet's in-app browser."],
    ["Easy vs Pro?", "Easy only closes empty accounts, so no tokens are lost. Pro can also burn unwanted tokens or NFTs and close their accounts. Burning cannot be undone, so check your selection carefully."],
  ],
};
// ▼ FAQのPCレイアウト切り替え
//   "two" = PCで2列・全幅（使い方の3枚と同じ幅）
//   "one" = 元の1列・中央760px（前のレイアウト）
//   1列に戻したいときは、下の "two" を "one" に書き換えるだけでOK。スマホはどちらでも同じ見た目。
const FAQ_LAYOUT: "two" | "one" = "two";
const FAQ_WRAP = {
  two: "lg:max-w-none",                 // 2列版：全幅
  one: "lg:max-w-[760px]",              // 1列版（元のまま）
};
const FAQ_LIST = {
  two: "mt-3 space-y-2 lg:mt-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6 lg:gap-y-3 lg:space-y-0", // 2列版
  one: "mt-3 space-y-2 lg:mt-6",                                                                         // 1列版（元のまま）
};
export default function Faq({ className = "" }: { className?: string }) {
  const { lang } = useI18n();
  return (<section className={`${className} ${FAQ_WRAP[FAQ_LAYOUT]}`} data-testid="faq">
    <h2 className="px-1 text-lg font-semibold tracking-tight lg:text-center lg:text-2xl">Q&amp;A</h2>
    <div className={FAQ_LIST[FAQ_LAYOUT]}>{QA[lang].map(([q, a]) =>
      <details key={q} className="card group px-4 py-1">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span>{q}</span><span className="shrink-0 text-faint transition-transform group-open:rotate-45" aria-hidden>+</span></summary>
        <p className="pb-3 text-sm leading-relaxed text-mute">{a}</p>
      </details>)}</div>
  </section>);
}
