"use client";
import { createContext, useContext, useEffect, useState } from "react";
export type Lang = "ja" | "en";
const dict = {
  ja: {
    heroTitle: "使っていないトークン口座から、SOLを取り戻す", heroSub: "空のトークン口座を閉じると、口座の保証金（レント）があなたのウォレットに戻ります。",
    howTitle: "使い方", how1t: "ウォレットを接続", how1: "閉じられる空口座を自動で探します。", how2t: "内容を確認して承認", how2: "取引はすべてあなたのウォレットで確認・署名します。", how3t: "SOLが戻る", how3: "口座1つにつき約0.002 SOLの保証金が戻ります。",
    trust1: "すべての取引はあなたのウォレットで承認します", trust2: "シードフレーズや秘密鍵を求めることは一切ありません", trust3: "資産を預かりません（ノンカストディアル）",
    connectTitle: "ウォレットを接続して始める", connectSub: "対応ウォレット：Phantom", burnWarn: "焼却は取り消せません。選んだものだけが焼却されます。", viewTx: "取引を見る", nav: "メニュー",
    tagline: "空のトークン口座を閉じて、保証金(SOL)を取り戻す", testnet: "テスト用ネットワーク（{c}）で動作中",
    connect: "Phantomウォレットを接続してください。", loading: "処理中…", loadFail: "読み込み失敗: ",
    tabClose: "空口座を閉じる", tabBurn: "トークン焼却",
    emptyCount: "閉じられる空口座：", items: "件", reclaim: "回収できる額", fee: "手数料（3%）", net: "受け取り額",
    closeBtn: "{n}件を閉じて回収する", noneClose: "閉じられる口座はありません",
    sign: "ウォレットで署名してください…", done: "完了しました", err: "エラー: ",
    errGeneric: "取引を完了できませんでした。資産は動いていません。時間をおいて再度お試しください。", errRent: "手数料の受取口座または残高の条件により取引が成立しませんでした。資産は動いていません。再読み込みして再度お試しください。",
    errLowSol: "ネットワーク手数料を払うためのSOLが足りません。ウォレットに少額（0.001 SOL程度）のSOLを入れてから再度お試しください。",
    errRejected: "ウォレットで取引がキャンセルされました。", errExpired: "承認までに時間がかかり、取引の有効期限が切れました。もう一度お試しください。",
    errNotEmpty: "残高のある口座が含まれていたため中止しました。再読み込みしてください。", errNetwork: "ネットワークに接続できませんでした。時間をおいて再度お試しください。", details: "詳細",
    burnIntro: "残高のあるトークン口座です。焼却したいものだけ選んでください（NFT・凍結口座は除外）。",
    burnBtn: "選んだ{n}件を焼却して回収する", selectSome: "焼却するトークンを選んでください", noneBurn: "焼却できるトークンはありません",
    confirmTitle: "本当に焼却しますか？", confirmList: "以下を焼却して口座を閉じます：",
    cancel: "キャンセル", doBurn: "焼却する", next: "次へ", manyTitle: "{n}件をまとめて焼却します", manyBody: "10件を超える大量の焼却です。もう一度だけ確認してください。本当に{n}件すべてを焼却しますか？",
    maxValue: "表示する上限額：${v}以下", hiddenN: "上限より高い{n}件は非表示", priced: "価格あり", unknownTab: "価格不明", unknown: "不明",
    stats: "これまでの実績（このブラウザ）", statsSol: "回収したSOL", statsAcc: "閉じた口座",
    footer: "手数料：回収額の3%（{w}… へ送金）。ネットワーク手数料（約0.000005 SOL/取引）はご自身のウォレットが支払います。",
    modeEasy: "かんたん", modePro: "プロ", easyTotal: "回収できるSOL", easyBtn: "SOLを回収する", easyCheck: "回収できるSOLを調べる", easyBtnAmt: "{a} SOLを回収する", easyEmpty: "いま受け取れるSOLはありません。閉じられる空口座は見つかりませんでした。",
    easyDone: "回収が完了しました", easyGot: "{a} SOL を回収しました", easyBack: "戻る", easyPost: "Xでポストする", easyAccs: "空口座 {n}件", clSel: "{m}件中 {n}件を選択", clEmpty: "空口座", clEmptySub: "残高ゼロ・閉じても損なし", clDust: "少額・価値不明トークン", clDustSub: "焼却して口座を閉じます", clValued: "価値ありトークン", clValuedSub: "チェックすると焼却されます", clBadge: "価値あり", clAll: "全選択", clNone: "全解除", clMore: "残り{n}件を表示", clLess: "閉じる", clRent: "戻るSOL", clUnknown: "価値不明", clWarnT: "このトークンは価値があります", clWarn: "{s}（約{u}）は焼却され、二度と戻りません。本当に選びますか？", clYes: "焼却対象にする",
    postText: "RentBackで空のトークン口座を閉じて {a} SOL を回収しました #Solana", info: "このサービスについて",
    infoBody: "RentBackは、使い終わって空になったトークン口座を閉じて、口座の保証金（SOL）を取り戻すツールです。かんたんモードは空口座を閉じるだけ、プロモードでは不要なトークンの焼却もできます。",
    infoFee: "手数料：回収したSOLの3%", infoNet: "ネットワーク手数料（約0.000005 SOL/取引）はご自身のウォレットが支払います。",
    terms: "利用規約・免責事項", back: "戻る",
    histTitle: "回収履歴", histTotal: "合計 {a} SOL（{n}回）", histLoading: "読み込み中…", histEmpty: "まだ回収履歴はありません", histErr: "履歴を読み込めませんでした。時間をおいて再度お試しください。", histAccs: "{n}件の口座を閉じました", histGross: "回収 {g} SOL・手数料 {f} SOL を含む", histPost: "Xでシェア", histMore: "さらに読み込む", histNote: "ブロックチェーン上の取引から表示しています（最新20件ずつ）。",
  },
  en: {
    heroTitle: "Get SOL back from token accounts you no longer use", heroSub: "Closing an empty token account returns its rent deposit to your wallet.",
    howTitle: "How it works", how1t: "Connect your wallet", how1: "We find empty token accounts that can be closed.", how2t: "Review and approve", how2: "You review and sign every transaction in your own wallet.", how3t: "Rent returns", how3: "About 0.002 SOL comes back per closed account.",
    trust1: "You approve every transaction in your wallet", trust2: "We never ask for your seed phrase or private key", trust3: "Non-custodial: we never hold your assets",
    connectTitle: "Connect a wallet to get started", connectSub: "Supported wallet: Phantom", burnWarn: "Burning cannot be undone. Only what you select is burned.", viewTx: "View transaction", nav: "Menu",
    tagline: "Close empty token accounts and get your SOL rent back", testnet: "Running on test network ({c})",
    connect: "Please connect your Phantom wallet.", loading: "Working…", loadFail: "Load failed: ",
    tabClose: "Close empty", tabBurn: "Burn tokens",
    emptyCount: "Empty accounts: ", items: "", reclaim: "Reclaimable", fee: "Fee (3%)", net: "You receive",
    closeBtn: "Close {n} accounts & reclaim", noneClose: "No accounts to close",
    sign: "Please sign in your wallet…", done: "Done", err: "Error: ",
    errGeneric: "The transaction couldn't be completed. Nothing was moved. Please try again later.", errRent: "The transaction was rejected by a rent-balance rule. Nothing was moved. Please reload and try again.",
    errLowSol: "Not enough SOL to pay the network fee. Add a small amount (about 0.001 SOL) to your wallet and try again.",
    errRejected: "The transaction was cancelled in your wallet.", errExpired: "The transaction expired before approval. Please try again.",
    errNotEmpty: "Stopped because an account with a balance was included. Please reload.", errNetwork: "Couldn't reach the network. Please try again later.", details: "Details",
    burnIntro: "Token accounts with a balance. Select only what you want to burn (NFTs and frozen accounts excluded).",
    burnBtn: "Burn {n} selected & reclaim", selectSome: "Select tokens to burn", noneBurn: "No burnable tokens",
    confirmTitle: "Really burn these?", confirmList: "The following will be burned and closed:",
    cancel: "Cancel", doBurn: "Burn", next: "Next", manyTitle: "Burning {n} tokens at once", manyBody: "This is a large burn (more than 10). Please confirm once more: really burn all {n}?",
    maxValue: "Show tokens worth ≤ ${v}", hiddenN: "{n} worth more are hidden", priced: "Priced", unknownTab: "Unknown price", unknown: "unknown",
    stats: "Your totals (this browser)", statsSol: "SOL reclaimed", statsAcc: "Accounts closed",
    footer: "Fee: 3% of reclaimed rent (sent to {w}…). Network fees (~0.000005 SOL/tx) are paid by your wallet.",
    modeEasy: "Easy", modePro: "Pro", easyTotal: "Reclaimable SOL", easyBtn: "Reclaim SOL", easyCheck: "Check reclaimable SOL", easyBtnAmt: "Reclaim {a} SOL", easyEmpty: "Nothing to claim right now. No empty accounts were found.",
    easyDone: "Reclaim complete", easyGot: "You reclaimed {a} SOL", easyBack: "Back", easyPost: "Post on X", easyAccs: "{n} empty accounts", clSel: "{n} of {m} selected", clEmpty: "Empty accounts", clEmptySub: "Zero balance, nothing lost", clDust: "Dust / unknown-value tokens", clDustSub: "Burned, then closed", clValued: "Tokens with value", clValuedSub: "Checking burns them", clBadge: "Has value", clAll: "All", clNone: "None", clMore: "Show {n} more", clLess: "Show less", clRent: "SOL back", clUnknown: "Value unknown", clWarnT: "This token has value", clWarn: "{s} (about {u}) will be burned forever. Select it anyway?", clYes: "Mark for burning",
    postText: "Closed my empty token accounts with RentBack and reclaimed {a} SOL #Solana", info: "About",
    infoBody: "RentBack closes token accounts you no longer use and returns their rent deposit (SOL). Easy mode only closes empty accounts; Pro mode can also burn unwanted tokens.",
    infoFee: "Fee: 3% of the SOL reclaimed", infoNet: "Network fees (~0.000005 SOL/tx) are paid by your wallet.",
    terms: "Terms & Disclaimer", back: "Back",
    histTitle: "Reclaim history", histTotal: "Total {a} SOL ({n} reclaims)", histLoading: "Loading…", histEmpty: "No reclaims yet", histErr: "Couldn't load history. Please try again later.", histAccs: "Accounts closed: {n}", histGross: "Gross {g} SOL, incl. {f} SOL fee", histPost: "Share on X", histMore: "Load more", histNote: "Read from on-chain transactions (20 at a time).",
  },
};
export type Key = keyof typeof dict.ja;
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key, v?: Record<string, string | number>) => string }>(null as any);
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setL] = useState<Lang>("ja");
  useEffect(() => { const s = localStorage.getItem("rentback:lang"); if (s === "en" || s === "ja") setL(s); }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = (l: Lang) => { setL(l); localStorage.setItem("rentback:lang", l); };
  const t = (k: Key, v: Record<string, string | number> = {}) => dict[lang][k].replace(/\{(\w+)\}/g, (_, x) => String(v[x] ?? ""));
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (<div className="seg" role="group" aria-label="Language">
    {(["ja", "en"] as Lang[]).map((l) => <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={`seg-btn whitespace-nowrap px-2.5 text-xs sm:px-3 ${lang === l ? "seg-on" : ""}`}>{l === "ja" ? "日本語" : "EN"}</button>)}
  </div>);
}
