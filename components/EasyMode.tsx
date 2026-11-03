"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { explainError } from "@/lib/rentback";
import { scanChecklist, buildChecklistTxs, Item } from "@/lib/checklist";
import Checklist, { SmoothNumber } from "@/components/Checklist";
import ConfirmModal from "@/components/ConfirmModal";
import { FEE_WALLET, FEATURE_STATS } from "@/lib/config";
import { addStats } from "@/lib/stats";
import { useI18n } from "@/lib/i18n";
import CoinPile from "@/components/CoinPile";
import KanteiCounter, { counterDigits } from "@/components/KanteiCounter";
import { RefreshButton, SoundToggle } from "@/components/IconButtons";
import { useSuccessReveal } from "@/lib/successReveal";
import { unlockAudio, playJingle, counterSettleMs } from "@/lib/sound";
const fmt = (l: number) => (l / LAMPORTS_PER_SOL).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
const COINS = Array.from({ length: 14 }, (_, i) => i);

/** Easy mode: one button closes all empty accounts (no burns). */
export default function EasyMode() {
  const { connection } = useConnection(); const { publicKey, signAllTransactions } = useWallet(); const { t, lang } = useI18n() as any;
  const [accs, setAccs] = useState<Item[] | null>(null); const [sel, setSel] = useState<Set<string>>(new Set()); const [scanId, setScanId] = useState(0); const [toggled, setToggled] = useState(false); const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [det, setDet] = useState("");
  const [got, setGot] = useState<number | null>(null); const [anim, setAnim] = useState(false); const [scan, setScan] = useState(false); const [rev, setRev] = useState(false); const [ready, setReady] = useState(false);
  const topRef = useRef<HTMLDivElement>(null); const [topVis, setTopVis] = useState(true); const [tick, setTick] = useState<{ id: number; d: number } | null>(null); const prevTotal = useRef(0);
  useEffect(() => { const el = topRef.current; if (!el) return; const io = new IntersectionObserver(([e]) => setTopVis(e.isIntersecting), { threshold: 0, rootMargin: "-72px 0px 0px 0px" }); io.observe(el); return () => io.disconnect(); }, [!!accs, accs?.length === 0]);
  const load = useCallback(async () => { if (!publicKey) return; setRev(false); setReady(false); setToggled(false); setScan(true); try { const it = await scanChecklist(connection, publicKey); setAccs(it); setSel(new Set(it.filter((i) => i.kind === "empty").map((i) => i.pubkey.toBase58()))); setToggled(false); setRev(false); setReady(false); setScanId((x) => x + 1); } catch (e: any) { setErr(t("loadFail") + e.message); } setScan(false); }, [connection, publicKey]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (process.env.NODE_ENV === "development" && new URLSearchParams(location.search).get("preview") === "success") setGot(10196000);
    if (process.env.NODE_ENV === "development" && new URLSearchParams(location.search).get("preview") === "scan") { const lp = (location.search.match(/lamports=(\d+)/) || [])[1]; setTimeout(() => setAccs([{ lamports: Number(lp || 3002000) } as any, { lamports: 0 } as any]), 300); }
    if (process.env.NODE_ENV === "development" && new URLSearchParams(location.search).get("preview") === "checklist") setTimeout(() => { const it = mockItems(); setAccs(it); setSel(new Set(it.filter((i) => i.kind === "empty").map((i) => i.pubkey.toBase58()))); setRev(false); setReady(false); setScanId((x) => x + 1); }, 300); }, []);
  const chosen = (accs || []).filter((a) => !a.pubkey || sel.has(a.pubkey.toBase58()) || !a.kind);
  const total = chosen.reduce((a, b) => a + b.lamports, 0);
  useEffect(() => { const d = total - prevTotal.current; prevTotal.current = total; if (toggled && d) setTick({ id: Date.now(), d }); }, [total]); // eslint-disable-line
  const revealFromBar = () => { window.scrollTo({ top: 0, behavior: "smooth" }); reveal(); };
  const reveal = () => { unlockAudio(); setToggled(false); setScanId((x) => x + 1); setRev(true); const ms = counterSettleMs(counterDigits(total)); playJingle(ms); setTimeout(() => setReady(true), ms + 250); };
  const burns = chosen.filter((a) => a.kind && a.amount !== "0");
  const claim = async (ok = false) => {
    if (!publicKey || !signAllTransactions || !chosen.length) return;
    if (burns.length && !ok) { setConfirm(true); return; } setConfirm(false);
    unlockAudio(); setBusy(true); setErr(""); setDet("");
    try {
      const { txs, blockhash, lastValidBlockHeight } = await buildChecklistTxs(connection, publicKey, FEE_WALLET, chosen);
      const signed = await signAllTransactions(txs.map((x) => x.tx)); let sum = 0;
      for (let i = 0; i < signed.length; i++) {
        const sim = await connection.simulateTransaction(signed[i]);
        if (sim.value.err) { const x: any = new Error(JSON.stringify(sim.value.err)); x.logs = sim.value.logs || []; throw x; }
        const sig = await connection.sendRawTransaction(signed[i].serialize());
        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
        const net = txs[i].reclaimed - txs[i].fee; sum += net;
        if (FEATURE_STATS) addStats(publicKey.toBase58(), net, txs[i].count);
      }
      setGot(sum); window.dispatchEvent(new Event("rentback-reclaimed")); await load();
    } catch (e: any) { const x = explainError(e); setErr(t(x.key as any)); setDet(x.details); }
    setBusy(false);
  };
  const goRoll = useSuccessReveal(got, counterSettleMs(counterDigits(got || 0)));
  const site = typeof window !== "undefined" ? window.location.origin : "";
  const postUrl = (a: number) => "https://x.com/intent/post?text=" + encodeURIComponent(t("postText", { a: fmt(a) }) + "\n" + site + "/s?a=" + (a / LAMPORTS_PER_SOL).toFixed(6) + (lang === "en" ? "&lang=en" : ""));

  if (got != null) return (<div className="fade-in py-2 text-center" data-testid="easy-success">
    <div className="-mt-12 -mb-2"><CoinPile state="success" lamports={got} /></div>
    <p className="mt-2 text-lg font-semibold">{t("easyDone")}</p>
    <p className="mt-1 text-3xl font-semibold tabular-nums text-accent-fg">{goRoll ? <KanteiCounter lamports={got} testId="count-up" /> : <span data-testid="count-wait">0.000000</span>} <span className="text-base text-mute">SOL</span></p>
    <div className="mt-5 grid gap-3">
      <a href={postUrl(got)} target="_blank" rel="noopener noreferrer" data-testid="post-x" className="btn-primary h-14 w-full text-base">{t("easyPost")}</a>
      <button onClick={() => setGot(null)} className="btn-ghost">{t("easyBack")}</button>
    </div></div>);

  return (<div className="relative py-2 text-center" data-testid="easy-mode">
    <style>{`@keyframes rbring{0%{transform:translate(-50%,-50%) scale(.6);opacity:.55}100%{transform:translate(-50%,-50%) scale(1.9);opacity:0}}
      @keyframes rbdot{0%{transform:translate(-50%,-50%);opacity:1}100%{transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y)));opacity:0}}
      @keyframes rbtick{0%{transform:translateY(6px);opacity:0}20%{opacity:1}100%{transform:translateY(-18px);opacity:0}}
      @keyframes rbpulse{0%{transform:scale(1)}40%{transform:scale(1.04);box-shadow:0 0 28px rgb(var(--accent)/.55)}100%{transform:scale(1)}}`}</style>
    <div className="absolute right-0 top-0 z-10 flex gap-2"><SoundToggle /><RefreshButton onClick={() => { setErr(""); if (process.env.NODE_ENV === "development" && location.search.includes("preview=checklist")) { setRev(false); setReady(false); setToggled(false); setScanId((x) => x + 1); return; } load(); }} loading={scan} disabled={busy} /></div>
    {accs && !accs.length ? <p className="py-10 text-sm text-mute" data-testid="easy-empty">{t("easyEmpty")}</p> : <>
      <CoinPile state={busy ? "claiming" : "idle"} />
      <p className="mt-1 text-sm text-mute">{t("easyTotal")}</p>
      <div ref={topRef}><p className="mt-2 text-[40px] font-semibold leading-none tracking-tight tabular-nums" data-testid="easy-total">{accs ? (!rev ? <span data-testid="easy-hidden">0.000000</span> : toggled ? <SmoothNumber lamports={total} /> : <KanteiCounter key={scanId} lamports={total} />) : "—"} <span className="text-lg text-mute">SOL</span></p>
      {accs && <p className="mt-2 text-xs text-faint">{t("clSel", { n: chosen.length, m: accs.length })}</p>}
      {accs && !ready && <button onClick={reveal} disabled={busy || scan || rev} data-testid="reveal-top" className="btn-primary mt-4 h-14 w-full text-base">{t("easyCheck")}</button>}
      {accs && ready && <button onClick={() => claim()} disabled={busy || !chosen.length} data-testid="claim-top" className="btn-primary mt-4 h-14 w-full text-base">
        {busy ? <><span className="spin inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent" />{t("loading")}</> : t("easyBtn")}</button>}</div>
      {accs && accs[0]?.kind && <Checklist items={accs} sel={sel} onChange={(s2) => { setSel(s2); setToggled(true); }} disabled={busy} />}
      <p className="mt-3 text-xs text-faint">{t("trust1")}</p>
      {accs && <div className="h-28" aria-hidden />}
      {accs && !!accs.length && typeof document !== "undefined" && createPortal(<div data-testid="sticky-bar" className={"fixed inset-x-0 bottom-0 z-40 px-4 pt-3 transition-all duration-300 " + (topVis ? "pointer-events-none translate-y-full opacity-0" : "translate-y-0 opacity-100")} style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
        <div className="relative mx-auto max-w-md">
          {tick && <span key={tick.id} className="pointer-events-none absolute -top-6 right-6 text-sm font-semibold tabular-nums" style={{ color: tick.d > 0 ? "rgb(var(--accent))" : "rgb(var(--mute))", animation: "rbtick .9s ease-out forwards" }}>{tick.d > 0 ? "+" : "−"}{(Math.abs(tick.d) / LAMPORTS_PER_SOL).toFixed(6)}</span>}
          {!ready ? <button onClick={revealFromBar} disabled={busy || scan || rev} className="btn-primary h-14 w-full text-base shadow-2xl">{t("easyCheck")}</button>
            : <button key={tick?.id} onClick={() => claim()} disabled={busy || !chosen.length} data-testid="claim-sticky" className="btn-primary h-14 w-full text-base tabular-nums shadow-2xl" style={tick ? { animation: "rbpulse .45s ease-out" } : undefined}>
              {busy ? <><span className="spin inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent" />{t("loading")}</> : t("easyBtnAmt", { a: (total / LAMPORTS_PER_SOL).toFixed(6) })}</button>}
        </div></div>, document.body)}</>}
    {confirm && <ConfirmModal items={burns.map((b) => ({ label: b.symbol || b.mint.slice(0, 4) + "…" + b.mint.slice(-4), amount: b.ui, usd: b.usd == null ? "?" : "$" + b.usd.toFixed(2) }))} onConfirm={() => claim(true)} onCancel={() => setConfirm(false)} />}
    {err && <div className="mt-4 break-words rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-left text-sm text-danger-fg" role="alert"><span>{err}</span>
      {det && <details className="mt-2 text-xs opacity-80"><summary className="cursor-pointer select-none py-2">{t("details")}</summary><pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono">{det}</pre></details>}</div>}
  </div>);
}


function mockItems(): Item[] {
  const { PublicKey } = require("@solana/web3.js"); const k = (n: number) => new PublicKey(new Uint8Array(32).fill(n));
  const T = k(9); const mk = (n: number, kind: any, sym: string | undefined, ui: string, usd: number | null, lam = 2039280): Item =>
    ({ pubkey: k(n), lamports: lam, programId: T, mint: k(100 + n).toBase58(), amount: kind === "empty" ? "0" : "1000", decimals: 6, ui, kind, usd, symbol: sym });
  return [mk(1, "empty", "USDC", "0", null), mk(2, "empty", undefined, "0", null, 2074080), mk(3, "empty", "BONK", "0", null),
    mk(4, "dust", "NEURALINK", "0.000009", 0.000001), mk(5, "dust", undefined, "12.5", null), mk(6, "dust", "MEOW", "3", 0.004),
    mk(7, "dust", "PEPE2", "0.2", null), mk(8, "valued", "JUP", "4.2", 3.15), mk(9, "valued", "WIF", "10", 14.8)];
}
