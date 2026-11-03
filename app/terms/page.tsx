"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Header, Footer, DevnetBanner } from "@/components/Chrome";
const body = {
  ja: [["サービスの性質", "RentBackはノンカストディアル（非預託型）のツールです。秘密鍵や資産を預かることはなく、すべての取引はあなた自身のウォレットで内容を確認・署名して実行されます。"],
    ["手数料", "口座を閉じて回収した保証金（レント）の3%を、同じ取引の中で運営者のウォレットへ送金します。ネットワーク手数料は利用者の負担です。"],
    ["焼却について", "トークンやNFTの焼却は取り消せません。焼却した資産は二度と戻りません。表示される米ドル価格は外部API（Jupiter）の参考値で、正確さは保証されません。選択内容を必ず確認してください。"],
    ["自己責任", "本サービスの利用は自己責任です。誤操作、価値のある資産の焼却、ウォレットやネットワークの不具合等による損失について、運営者は責任を負いません。"],
    ["無保証", "本サービスは現状のまま提供され、動作や結果を保証しません。内容は予告なく変更されることがあります。"]],
  en: [["Non-custodial", "RentBack is a non-custodial tool. We never hold your keys or assets; every transaction is reviewed and signed by you in your own wallet."],
    ["Fee", "3% of the rent reclaimed from closed accounts is sent to the operator's wallet within the same transaction. Network fees are paid by the user."],
    ["Burns", "Burning tokens or NFTs is irreversible. Burned assets can never be recovered. USD values come from an external API (Jupiter) and are estimates only. Always double-check your selection."],
    ["Your responsibility", "You use this service at your own risk. The operator is not liable for losses from mistakes, burning valuable assets, or wallet/network issues."],
    ["No warranty", "The service is provided as-is without warranty and may change without notice."]],
};
export default function Terms() {
  const { lang, t } = useI18n();
  return (<><Header /><DevnetBanner />
    <main className="fade-in mx-auto max-w-2xl px-4 pt-10 sm:px-6 sm:pt-14">
      <Link href="/" className="link inline-flex min-h-[44px] items-center text-sm">← {t("back")}</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{t("terms")}</h1>
      <div className="mt-8 divide-y divide-line">{body[lang].map(([h, p]) => <section key={h} className="py-6 first:pt-0"><h2 className="text-base font-semibold">{h}</h2><p className="mt-2 text-[15px] leading-relaxed text-mute">{p}</p></section>)}</div>
    </main><Footer /></>);
}
