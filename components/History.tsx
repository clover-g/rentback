"use client";
import { useCallback, useEffect, useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { fetchHistory, HistItem } from "@/lib/history";
import { solscan } from "@/lib/rentback";
import { CLUSTER, FEE_WALLET } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { RefreshButton } from "@/components/IconButtons";

const SITE = "https://rentbacksol.app";
const fmt = (l: number) => (l / LAMPORTS_PER_SOL).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
// Dev-only mock (?preview=history[&hist=empty]) — real mainnet reclaims of a RentBack user, used for screenshots.
const MOCK: HistItem[] = [
  { sig: "2s5j8dd6deMDecux2KN7repfK5VPBQSqimDdVX97nUqCK53xo4Kc6BwLSTb7zvp6QwAAp3Pn4zsvsXfar9T5WBTq", time: 1793704632, net: 5769062, gross: 6029960, fee: 180898, txFee: 80000, closed: 4 },
  { sig: "3K8fCo9rfNRi3ueox7AzrtF8qindgKZa3K3wkK9hQTe1ravqUyeVbuLzDEYMFXNK1VRSAdLpmaYdgQBVpCknzJ4b", time: 1793704620, net: 1491905, gross: 1620520, fee: 48615, txFee: 80000, closed: 1 },
  { sig: "3tkR1oJH9E5urVfQbnXqMgXvWzJF3hyThB4C1138wkKHJDdTtKNDriqfxwHpFbYCwwxpdNYdYKQXuQP88iEsNTTr", time: 1793385876, net: 1388425, gross: 1513840, fee: 45415, txFee: 80000, closed: 1 },
  { sig: "2PJ4XoZScKFCKJEzFQuJULUcXfihQPq32kGAEMyRgUaxt3M1pPDtHt6x5BHYFXn2onrqEh8KuzotkYqNBdeicXMX", time: 1793380775, net: 2901198, gross: 3073400, fee: 92202, txFee: 80000, closed: 2 },
];
const previewMode = () => process.env.NODE_ENV === "development" && typeof location !== "undefined" && new URLSearchParams(location.search).get("preview") === "history"
  ? (new URLSearchParams(location.search).get("hist") || "mock") : null;

/** 回収履歴 / Reclaim history — on-chain only (wallet signatures → txs with a fee transfer to FEE_WALLET + CloseAccount). */
export default function History() {
  const { connection } = useConnection(); const { publicKey } = useWallet(); const { t, lang } = useI18n() as any;
  const [items, setItems] = useState<HistItem[] | null>(null); const [before, setBefore] = useState<string | undefined>(); const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(false);
  const [pv, setPv] = useState<string | null>(null); useEffect(() => setPv(previewMode()), []);
  const load = useCallback(async (more = false) => {
    if (pv) { setItems(pv === "empty" ? [] : MOCK); setDone(true); return; }
    if (!publicKey) return; setBusy(true); setErr(false);
    try { const p = await fetchHistory(connection, publicKey, FEE_WALLET, { limit: 20, before: more ? before : undefined });
      setItems((x) => (more && x ? [...x, ...p.items] : p.items)); setBefore(p.before); setDone(p.done);
    } catch { setErr(true); if (!more) setItems((x) => x ?? []); }
    setBusy(false);
  }, [connection, publicKey, before, pv]);
  useEffect(() => { setItems(null); setBefore(undefined); setDone(false); load(); }, [publicKey?.toBase58(), pv]); // eslint-disable-line
  useEffect(() => { const h = () => setTimeout(() => load(), 2500); window.addEventListener("rentback-reclaimed", h); return () => window.removeEventListener("rentback-reclaimed", h); }, [load]);
  if (!publicKey && !pv) return null;
  const locale = lang === "en" ? "en-US" : "ja-JP";
  const when = (s: number | null) => s ? new Date(s * 1000).toLocaleString(locale, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
  const postUrl = (l: number) => "https://x.com/intent/post?text=" + encodeURIComponent(t("postText", { a: fmt(l) }) + "\n" + SITE + "/s?a=" + (l / LAMPORTS_PER_SOL).toFixed(6) + (lang === "en" ? "&lang=en" : ""));
  const total = (items || []).reduce((a, b) => a + Math.max(0, b.net), 0);
  return (<section className="card mt-4 p-5 sm:p-6" data-testid="history">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0"><h2 className="text-base font-semibold">{t("histTitle")}</h2>
        {items && items.length > 0 && <p className="mt-0.5 text-xs text-mute tabular-nums" data-testid="hist-total">{t("histTotal", { a: fmt(total), n: items.length })}</p>}</div>
      <RefreshButton onClick={() => load()} loading={busy} disabled={busy} />
    </div>
    {items == null ? <p className="py-6 text-center text-sm text-mute">{t("histLoading")}</p>
      : items.length === 0 ? <p className="py-6 text-center text-sm text-mute" data-testid="hist-empty">{err ? t("histErr") : t("histEmpty")}</p>
      : <ul className="mt-3 divide-y divide-line">{items.map((it) => (
        <li key={it.sig} className="py-3" data-testid="hist-row">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-mute tabular-nums">{when(it.time)}</span>
            <span className="text-xs text-faint">{t("histAccs", { n: it.closed })}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <span className="text-xl font-semibold tabular-nums text-accent-fg">+{fmt(it.net)} <span className="text-sm text-mute">SOL</span></span>
            <a href={solscan(it.sig, CLUSTER)} target="_blank" rel="noopener noreferrer" className="link inline-flex min-h-[44px] items-center text-xs">Solscan ↗</a>
          </div>
          <p className="text-[11px] text-faint tabular-nums">{t("histGross", { g: fmt(it.gross), f: fmt(it.fee) })}</p>
          <a href={postUrl(Math.max(0, it.net))} target="_blank" rel="noopener noreferrer" data-testid="hist-post-x" className="btn-ghost mt-2 h-10 w-full text-sm">{t("histPost")}</a>
        </li>))}</ul>}
    {err && items && items.length > 0 && <p className="mt-2 text-xs text-mute">{t("histErr")}</p>}
    {items && items.length > 0 && !done && <button onClick={() => load(true)} disabled={busy} className="mt-2 min-h-[44px] w-full text-sm text-mute underline">{busy ? t("histLoading") : t("histMore")}</button>}
    <p className="mt-2 text-[11px] text-faint">{t("histNote")}</p>
  </section>);
}
