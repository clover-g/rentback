"use client";
import { playCheck, playUncheck } from "@/lib/checkSound";
import KanteiCounter, { counterDigits } from "@/components/KanteiCounter";
import { RefreshButton, SoundToggle } from "@/components/IconButtons";
import { useSuccessReveal } from "@/lib/successReveal";
import { unlockAudio, playJingle, counterSettleMs } from "@/lib/sound";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Connection, LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { listEmpty, buildTxs, explainError, calcFee, solscan, EmptyAcc, BATCH } from "@/lib/rentback";
import { listBurnable, buildBurnTxs, BURN_BATCH, BurnAcc } from "@/lib/burn";
import { CLUSTER, FEE_WALLET, FEATURE_STATS } from "@/lib/config";
import { useI18n, Key } from "@/lib/i18n";
import { addStats, getStats } from "@/lib/stats";
import EasyMode from "@/components/EasyMode";
import History from "@/components/History";
import ConfirmModal from "@/components/ConfirmModal";
import { fetchUsdPrices } from "@/lib/price";
import { fetchMeta } from "@/lib/checklist";
import Faq from "@/components/Faq";
import CoinPile from "@/components/CoinPile";
import { Header, Footer, DevnetBanner, TrustList, Spinner } from "@/components/Chrome";
const WalletMultiButton = dynamic(() => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton), { ssr: false });
const sol = (l: number) => (l / LAMPORTS_PER_SOL).toFixed(6);
const short = (s: string) => s.slice(0, 4) + "…" + s.slice(-4);
type Meta = Record<string, { symbol?: string; image?: string }>;
const isPreviewPro = () => process.env.NODE_ENV === "development" && typeof location !== "undefined" && new URLSearchParams(location.search).get("preview") === "pro";
const PV_MINTS = ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", "Ad9bXq7pV3kLmN2rT8sYwZc4uHfGjE1oPiQxKbENsf"];
const PV_META: Meta = { [PV_MINTS[0]]: { symbol: "USDC" }, [PV_MINTS[1]]: { symbol: "BONK" } };
function useMeta(mints: string[]) {
  const [m, setM] = useState<Meta>({}); const key = [...new Set(mints)].sort().join(",");
  useEffect(() => { if (!key) return; if (isPreviewPro()) { setM(PV_META); return; } let ok = true; fetchMeta(key.split(",")).then((r) => ok && setM(r)); return () => { ok = false; }; }, [key]);
  return m;
}
function TokenLabel({ mint, meta, sub }: { mint: string; meta: Meta; sub?: string }) {
  const x = meta[mint]; const sym = x?.symbol?.trim(); const [bad, setBad] = useState(false);
  return (<span className="flex min-w-0 items-center gap-2.5">
    {x?.image && !bad ? <img src={x.image} alt="" loading="lazy" onError={() => setBad(true)} className="h-7 w-7 shrink-0 rounded-full bg-raised object-cover" />
      : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-raised text-[10px] font-semibold text-mute">{(sym || mint).slice(0, 2).toUpperCase()}</span>}
    <span className="min-w-0"><span className={`block truncate ${sym ? "font-medium text-ink" : "font-mono text-ink"}`}>{sym || short(mint)}</span>
      <span className="block truncate font-mono text-[11px] text-faint">{sym ? short(mint) : ""}{sub ? (sym ? " · " : "") + sub : ""}</span></span></span>);
}
const feeFor = (lams: number[], batch: number) => { let f = 0; for (let i = 0; i < lams.length; i += batch) f += calcFee(lams.slice(i, i + batch).reduce((a, b) => a + b, 0)); return f; };
type Built = { txs: { tx: Transaction; reclaimed: number; fee: number; count?: number }[]; blockhash: string; lastValidBlockHeight: number };

function useSender() {
  const { connection } = useConnection(); const { publicKey, signAllTransactions } = useWallet(); const { t } = useI18n();
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [sigs, setSigs] = useState<string[]>([]); const [got, setGot] = useState<number | null>(null);
  const send = async (build: () => Promise<Built>, after: () => Promise<void>) => {
    if (!publicKey || !signAllTransactions) return;
    unlockAudio(); setBusy(true); setMsg(t("sign")); setSigs([]); setGot(null); let sum = 0;
    try {
      const { txs, blockhash, lastValidBlockHeight } = await build();
      const signed = await signAllTransactions(txs.map((x) => x.tx)); const out: string[] = [];
      for (let i = 0; i < signed.length; i++) {
        const sig = await connection.sendRawTransaction(signed[i].serialize());
        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
        out.push(sig); setSigs([...out]);
        sum += txs[i].reclaimed - txs[i].fee;
        if (FEATURE_STATS) addStats(publicKey.toBase58(), txs[i].reclaimed - txs[i].fee, txs[i].count ?? txs[i].tx.instructions.length - 1);
      }
      setMsg(t("done")); setGot(sum); window.dispatchEvent(new Event("rentback-reclaimed")); await after();
    } catch (e: any) { const x = explainError(e); setMsg(t(x.key as any) + "\n\n" + t("details") + ": " + x.details.slice(0, 600)); }
    setBusy(false);
  };
  return { busy, setBusy, msg, setMsg, sigs, setSigs, send, got, setGot };
}

function Won({ s }: { s: ReturnType<typeof useSender> }) {
  const { t, lang } = useI18n() as any; const go = useSuccessReveal(s.got, counterSettleMs(counterDigits(s.got || 0))); if (s.got == null) return null;
  return (<div className="fade-in mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-4 text-center" data-testid="pro-success">
    <p className="text-sm font-semibold">{t("easyDone")}</p>
    <p className="mt-1 text-3xl font-semibold tabular-nums text-accent-fg">{go ? <KanteiCounter lamports={s.got} testId="pro-count-up" /> : <span>0.000000</span>} <span className="text-base text-mute">SOL</span></p>
    <div className="mt-4 grid gap-2"><a data-testid="post-x" href={"https://x.com/intent/post?text=" + encodeURIComponent(t("postText", { a: (s.got / LAMPORTS_PER_SOL).toFixed(6).replace(/0+$/, "").replace(/\.$/, "") }) + "\n" + location.origin + "/s?a=" + (s.got / LAMPORTS_PER_SOL).toFixed(6) + (lang === "en" ? "&lang=en" : ""))} target="_blank" rel="noopener noreferrer" className="btn-primary h-12 w-full text-base">{t("easyPost")}</a>
      <button onClick={() => s.setGot(null)} className="min-h-[40px] text-sm text-mute underline">{t("easyBack")}</button></div></div>);
}
function Summary({ total }: { total: number; fee: number }) {
  const { t } = useI18n();
  return (<dl className="rounded-xl border border-line bg-bg px-4 py-3 text-sm">
    <div className="flex items-baseline justify-between gap-3"><dt className="text-mute">{t("reclaim")}</dt><dd className="font-semibold tabular-nums text-accent-fg"><KanteiCounter lamports={total} /> SOL</dd></div>
  </dl>);
}
function Result({ s }: { s: ReturnType<typeof useSender> }) {
  return (<>{s.msg && <p className="mt-4 text-sm text-mute break-words" role="status">{s.msg}</p>}
    {s.sigs.map((x) => <a key={x} href={solscan(x, CLUSTER)} target="_blank" rel="noopener noreferrer" className="link mt-1 flex min-h-[44px] items-center truncate text-xs"><span className="min-w-0 truncate font-mono">{x}</span></a>)}</>);
}

function CloseEmpty() {
  const { connection } = useConnection(); const { publicKey } = useWallet(); const { t } = useI18n(); const s = useSender();
  const [accs, setAccs] = useState<EmptyAcc[]>([]); const [scan, setScan] = useState(false);
  const load = useCallback(async () => { if (!publicKey) return; setScan(true); try { setAccs(await listEmpty(connection, publicKey)); } catch (e: any) { s.setMsg(t("loadFail") + e.message); } setScan(false); }, [connection, publicKey]); // eslint-disable-line
  useEffect(() => { if (isPreviewPro() && /won=1/.test(location.search)) setTimeout(() => { window.scrollTo(0, 99999); s.setGot(Number((location.search.match(/lam=(\d+)/) || [])[1] || 13396000)); }, 1500); if (isPreviewPro()) { setAccs(PV_MINTS.map((m, i) => ({ pubkey: new PublicKey(PV_MINTS[(i + 1) % 2]), lamports: 2039280, programId: new PublicKey(PV_MINTS[0]), mint: m })) as any); return; } load(); }, [load]);
  const meta = useMeta(accs.map((a) => a.mint));
  const total = accs.reduce((a, b) => a + b.lamports, 0); const fee = feeFor(accs.map((a) => a.lamports), BATCH);
  return (<>
    <Won s={s} />
    <p className="mb-4 text-sm text-mute">{t("emptyCount")}<b className="font-semibold text-ink">{accs.length}</b> {t("items")} {s.busy && <span className="ml-2 inline-flex items-center gap-1.5"><Spinner />{t("loading")}</span>}</p>
    <div className="mb-2 flex justify-end gap-2"><SoundToggle /><RefreshButton onClick={load} loading={scan} disabled={s.busy} /></div>
    <Summary total={total} fee={fee} />
    <button onClick={() => s.send(() => buildTxs(connection, publicKey!, FEE_WALLET, accs), load)} disabled={s.busy || !accs.length} className="btn-primary mt-5 w-full">
      {accs.length ? t("closeBtn", { n: accs.length }) : t("noneClose")}</button>
    {!!accs.length && <ul className="mt-4 max-h-64 divide-y divide-line overflow-auto rounded-xl border border-line text-sm text-mute">{accs.map((a) => <li key={a.pubkey.toBase58() + a.mint} className="flex items-center justify-between gap-3 px-3 py-2"><TokenLabel mint={a.mint} meta={meta} /><span className="shrink-0 tabular-nums">{sol(a.lamports)}</span></li>)}</ul>}
    <Result s={s} />
  </>);
}

/** Generic selectable burn panel: nothing preselected, USD value slider, final confirm modal (+2nd step if >10). */
function BurnPanel<T>({ list, build, id, label, amount, lamports, batch, intro, btn, none, testid, priceOf, mintOf }: {
  list: (c: Connection, o: PublicKey) => Promise<T[]>; build: (c: Connection, o: PublicKey, f: PublicKey, x: T[]) => Promise<Built>;
  id: (x: T) => string; label: (x: T) => string; amount: (x: T) => string; lamports: (x: T) => number; batch: number; intro: Key; btn: Key; none: Key; testid: string;
  priceOf?: { mint: (x: T) => string; qty: (x: T) => number }; mintOf?: (x: T) => string }) {
  const { connection } = useConnection(); const { publicKey } = useWallet(); const { t } = useI18n(); const s = useSender();
  const [items, setItems] = useState<T[]>([]); const [sel, setSel] = useState<Set<string>>(new Set()); const [confirm, setConfirm] = useState(false);
  const load = useCallback(async () => { if (!publicKey) return; setSel(new Set()); try { setItems(await list(connection, publicKey)); } catch (e: any) { s.setMsg(t("loadFail") + e.message); } }, [connection, publicKey]); // eslint-disable-line
  useEffect(() => { if (isPreviewPro() && /won=1/.test(location.search)) setTimeout(() => { s.setGot(3099000); s.setMsg("done"); s.setSigs(["5".repeat(44) + "x".repeat(44)]); }, 1500); }, []); // eslint-disable-line
  useEffect(() => { if (isPreviewPro()) setItems(PV_MINTS.map((m, i) => ({ pubkey: new PublicKey(PV_MINTS[i % 2]), lamports: 2039280, programId: new PublicKey(PV_MINTS[0]), mint: m, amount: "1", decimals: 0, ui: String(12.5 * (i + 1)) })) as any); }, []);
  const meta = useMeta(mintOf ? items.map(mintOf) : []);
  useEffect(() => { load(); }, [load]);
  const [prices, setPrices] = useState<Record<string, number | null>>({}); const [max, setMax] = useState(1); const [sub, setSub] = useState<"priced" | "unknown">("priced");
  useEffect(() => { if (priceOf && items.length) fetchUsdPrices([...new Set(items.map(priceOf.mint))]).then(setPrices); }, [items]); // eslint-disable-line
  const usd = (x: T): number | null => { if (!priceOf) return null; const p = prices[priceOf.mint(x)]; return p == null ? null : p * priceOf.qty(x); };
  const fmtUsd = (x: T) => { const v = usd(x); return v == null ? t("unknown") : "$" + v.toFixed(2); };
  const pricedAll = priceOf ? items.filter((x) => usd(x) != null) : items;
  const unknownAll = priceOf ? items.filter((x) => usd(x) == null) : [];
  const pricedShown = priceOf ? pricedAll.filter((x) => (usd(x) as number) <= max) : items; // over-limit hidden by default
  const eligible = [...pricedShown, ...unknownAll];
  const shown = priceOf && sub === "unknown" ? unknownAll : pricedShown;
  const chosen = eligible.filter((x) => sel.has(id(x)));
  const total = chosen.reduce((a, x) => a + lamports(x), 0); const fee = feeFor(chosen.map(lamports), batch);
  const toggle = (k: string) => { const on = !sel.has(k); (on ? playCheck : playUncheck)(); setSel((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; }); };
  return (<div data-testid={testid}>
    <Won s={s} />
    <p className="mb-3 text-sm text-mute">{intro && t(intro)} {s.busy && <span className="ml-1 inline-flex items-center gap-1.5"><Spinner />{t("loading")}</span>}</p>
    <p className="mb-4 rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-xs text-danger-fg">{t("burnWarn")}</p>
    {priceOf && <div className="mb-4 text-sm">
      <label className="block text-mute"><span className="tabular-nums">{t("maxValue", { v: max })}</span><input data-testid="max-slider" type="range" min={0.1} max={100} step={0.1} value={max} onChange={(e) => setMax(Number(e.target.value))} className="mt-2 h-11 w-full accent-[rgb(var(--accent))]" /></label>
      {pricedAll.length > pricedShown.length && <p className="text-xs text-faint">{t("hiddenN", { n: pricedAll.length - pricedShown.length })}</p>}
      <div className="seg mt-3">{(["priced", "unknown"] as const).map((k) => <button key={k} onClick={() => setSub(k)}
        className={`seg-btn ${sub === k ? "seg-on" : ""}`}>{t(k === "priced" ? "priced" : "unknownTab")} ({k === "priced" ? pricedShown.length : unknownAll.length})</button>)}</div>
    </div>}
    <ul className="mb-4 max-h-72 divide-y divide-line overflow-auto rounded-xl border border-line text-sm">
      {!shown.length && <li className="p-4 text-faint">{t(none)}</li>}
      {shown.map((x) => <li key={id(x)}><label className="flex min-h-[52px] cursor-pointer items-center gap-3 px-3 py-2 hover:bg-raised">
        <input type="checkbox" checked={sel.has(id(x))} onChange={() => toggle(id(x))} className="h-5 w-5 shrink-0 accent-[rgb(var(--accent))]" />
        {mintOf ? <span className="min-w-0 flex-1"><TokenLabel mint={mintOf(x)} meta={meta} sub={sol(lamports(x)) + " SOL"} /></span> : <span className="min-w-0 flex-1"><span className="block truncate font-mono text-ink">{label(x)}</span><span className="block text-xs text-faint tabular-nums">{sol(lamports(x))} SOL</span></span>}
        <span className="shrink-0 text-right tabular-nums"><span className="block font-medium">{amount(x)}</span>{priceOf && <span className="block text-xs text-faint">{fmtUsd(x)}</span>}</span></label></li>)}
    </ul>
    <Summary total={total} fee={fee} />
    <button onClick={() => setConfirm(true)} disabled={s.busy || !chosen.length} className="btn-danger mt-5 w-full">
      {chosen.length ? t(btn, { n: chosen.length }) : eligible.length ? t("selectSome") : t(none)}</button>
    {confirm && <ConfirmModal items={chosen.map((x) => ({ label: label(x), amount: amount(x), usd: priceOf ? fmtUsd(x) : undefined }))} onCancel={() => setConfirm(false)}
      onConfirm={() => { setConfirm(false); s.send(() => build(connection, publicKey!, FEE_WALLET, chosen), load); }} />}
    <Result s={s} />
  </div>);
}

function StatsPanel() {
  const { publicKey } = useWallet(); const { t } = useI18n(); const [st, setSt] = useState({ lamports: 0, accounts: 0 });
  useEffect(() => { if (!publicKey) return; const u = () => setSt(getStats(publicKey.toBase58())); u(); window.addEventListener("rentback-stats", u); return () => window.removeEventListener("rentback-stats", u); }, [publicKey]);
  if (!publicKey) return null;
  return (<section className="card mt-4 p-5 text-sm" data-testid="stats"><p className="mb-3 text-mute">{t("stats")}</p>
    <div className="flex justify-between py-1"><span className="text-mute">{t("statsSol")}</span><b className="tabular-nums">{sol(st.lamports)} SOL</b></div>
    <div className="flex justify-between py-1"><span className="text-mute">{t("statsAcc")}</span><b className="tabular-nums">{st.accounts}</b></div></section>);
}

export default function Home() {
  const [devPreview, setDevPreview] = useState(false); useEffect(() => { if (process.env.NODE_ENV === "development" && /preview=/.test(location.search)) setDevPreview(true); }, []);
  const { publicKey } = useWallet(); const { t } = useI18n();
  const tabs: [string, Key][] = [["close", "tabClose"], ["burn", "tabBurn"]];
  const [tab, setTab] = useState("close"); useEffect(() => { if (isPreviewPro() && /tab=burn/.test(location.search)) setTab("burn"); }, []); const [mode, setMode] = useState<"easy" | "pro">("easy"); useEffect(() => { if (isPreviewPro()) setMode("pro"); }, []);
  const steps: [Key, Key][] = [["how1t", "how1"], ["how2t", "how2"], ["how3t", "how3"]];
  return (<>
    <Header /><DevnetBanner />
    <main className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-16 lg:max-w-[1168px] lg:pt-20">
      <div className="grid gap-10 lg:grid-cols-[1fr_480px] lg:items-stretch lg:gap-16">
        <div className="fade-in min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-4xl lg:text-[52px] lg:leading-[1.15]">{t("heroTitle")}</h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-mute lg:mt-6 lg:text-lg">{t("heroSub")}</p>
          <div className="pointer-events-none mt-2 hidden h-[300px] max-w-lg justify-center lg:flex" aria-hidden><div className="w-[260px] origin-top scale-[1.6]"><CoinPile state="idle" /></div></div>
          <TrustList className="mt-2 hidden lg:block lg:text-[15px]" />
        </div>
        <div className="fade-in min-w-0 lg:flex lg:flex-col">
          <section className="card p-5 sm:p-6 lg:flex lg:flex-1 lg:flex-col lg:justify-center">
            {!publicKey && !devPreview ? <div className="py-6 text-center" data-testid="connect-card">
              <p className="text-lg font-semibold">{t("connectTitle")}</p><p className="mt-1 text-sm text-mute">{t("connectSub")}</p>
              <div className="mt-6 flex justify-center"><WalletMultiButton /></div>
            </div> : <>
              <div className="mb-5 flex justify-center"><div className="seg" data-testid="mode-toggle">{(["easy", "pro"] as const).map((m) =>
                <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={`seg-btn px-6 ${mode === m ? "seg-on" : ""}`}>{t(m === "easy" ? "modeEasy" : "modePro")}</button>)}</div></div>
              {mode === "easy" ? <EasyMode /> : <>
                <nav className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line">{tabs.map(([k, l]) =>
                  <button key={k} onClick={() => setTab(k)} className={`min-h-[44px] shrink-0 whitespace-nowrap border-b-2 px-3 text-sm ${tab === k ? "border-accent font-medium text-ink" : "border-transparent text-mute hover:text-ink"}`}>{t(l)}</button>)}</nav>
                {tab === "close" && <CloseEmpty />}
                {tab === "burn" && <BurnPanel<BurnAcc> list={listBurnable} build={buildBurnTxs} id={(x) => x.pubkey.toBase58()} label={(x) => x.mint} mintOf={(x) => x.mint}
                  amount={(x) => x.ui} lamports={(x) => x.lamports} batch={BURN_BATCH} intro="burnIntro" btn="burnBtn" none="noneBurn" testid="burn-panel"
                  priceOf={{ mint: (x) => x.mint, qty: (x) => Number(x.ui) }} />}
              </>}</>}
          </section>
          <History />
          {FEATURE_STATS && <StatsPanel />}
          <TrustList className="mt-6 px-1 lg:hidden" />
          <p className="mt-2 flex flex-wrap items-center gap-x-1 px-1 text-xs text-faint"><Link href="/info" className="link inline-flex min-h-[44px] items-center">{t("info")}</Link><span className="mx-1">·</span><Link href="/terms" className="link inline-flex min-h-[44px] items-center">{t("terms")}</Link></p>
        </div>
      </div>
      <h2 className="hidden px-1 text-lg font-semibold tracking-tight lg:mt-24 lg:block">{t("howTitle" as Key)}</h2>
      <ol className="mt-14 grid gap-4 sm:grid-cols-3 lg:mt-4 lg:gap-6">{steps.map(([h, b], i) =>
        <li key={h} className="card p-5 lg:p-7"><span className="text-xs text-faint lg:text-sm lg:font-semibold lg:text-accent-fg">0{i + 1}</span><p className="mt-2 text-sm font-medium">{t(h)}</p><p className="mt-1 text-sm text-mute">{t(b)}</p></li>)}</ol>
      {/* FAQの幅：2列版は「使い方」と同じ全幅。1列に戻すときは components/Faq.tsx の FAQ_LAYOUT を "one" にする（幅もそこで自動で760pxに戻る） */}
      <Faq className="mx-auto mt-14 max-w-2xl lg:mt-24" />
    </main>
    <Footer />
  </>);
}
