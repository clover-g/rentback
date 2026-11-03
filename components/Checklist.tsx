"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useI18n } from "@/lib/i18n";
import { Item, Kind } from "@/lib/checklist";
import { playCheck, playUncheck } from "@/lib/checkSound";

/** Quick ease to the new value (no 鑑定団 replay). */
export function SmoothNumber({ lamports }: { lamports: number }) {
  const [v, setV] = useState(lamports); const from = useRef(lamports); const raf = useRef(0);
  useEffect(() => {
    const a = from.current, b = lamports; if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(b); from.current = b; return; }
    const t0 = performance.now(); const step = (n: number) => { const p = Math.min(1, (n - t0) / 320); const e = 1 - Math.pow(1 - p, 3);
      const x = a + (b - a) * e; setV(x); from.current = x; if (p < 1) raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step); return () => cancelAnimationFrame(raf.current);
  }, [lamports]);
  return <span className="tabular-nums" data-testid="smooth-total" aria-label={(lamports / LAMPORTS_PER_SOL).toFixed(6)}>{(v / LAMPORTS_PER_SOL).toFixed(6)}</span>;
}

const short = (m: string) => m.slice(0, 4) + "…" + m.slice(-4);
const COLLAPSE = 5;

export default function Checklist({ items, sel, onChange, disabled }: { items: Item[]; sel: Set<string>; onChange: (s: Set<string>) => void; disabled?: boolean }) {
  const { t } = useI18n(); const [warn, setWarn] = useState<Item | null>(null);
  const id = (i: Item) => i.pubkey.toBase58();
  const set = (list: Item[], on: boolean, sound = true) => { const s = new Set(sel); let ch = false;
    list.forEach((i) => { if (on !== s.has(id(i))) { ch = true; on ? s.add(id(i)) : s.delete(id(i)); } });
    if (!ch) return; if (sound) (on ? playCheck : playUncheck)(); onChange(s); };
  const toggle = (i: Item) => { const on = !sel.has(id(i)); if (on && i.kind === "valued") return setWarn(i); set([i], on); };
  const groups: { k: Kind; title: string; sub: string }[] = [
    { k: "empty", title: t("clEmpty"), sub: t("clEmptySub") }, { k: "dust", title: t("clDust"), sub: t("clDustSub") }, { k: "valued", title: t("clValued"), sub: t("clValuedSub") }];
  return (<div className="mt-6 space-y-4 text-left" data-testid="checklist">
    {groups.map((g) => { const list = items.filter((i) => i.kind === g.k); if (!list.length) return null;
      return <Group key={g.k} g={g} list={list} sel={sel} id={id} toggle={toggle} disabled={disabled}
        onAll={() => set(list.filter((i) => i.kind !== "valued"), true)} onNone={() => set(list, false)} />; })}
    {warn && <Warn item={warn} onCancel={() => setWarn(null)} onOk={() => { set([warn], true); setWarn(null); }} />}
  </div>);
}

function Group({ g, list, sel, id, toggle, onAll, onNone, disabled }: any) {
  const { t } = useI18n(); const [open, setOpen] = useState(false); const hidden = list.length - COLLAPSE;
  return (<section className="rounded-2xl border border-line bg-raised/40" data-testid={"cl-" + g.k}>
    <header className="flex items-center gap-2 px-3 pt-3">
      <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{g.title} <span className="text-faint">({list.length})</span></h3><p className="text-xs text-faint">{g.sub}</p></div>
      {g.k !== "valued" && <button onClick={onAll} disabled={disabled} className="min-h-[36px] rounded-full border border-line px-3 text-xs hover:bg-raised">{t("clAll")}</button>}
      <button onClick={onNone} disabled={disabled} className="min-h-[36px] rounded-full border border-line px-3 text-xs hover:bg-raised">{t("clNone")}</button>
    </header>
    <ul className="mt-2 divide-y divide-line">{list.map((i: Item, n: number) => { const on = sel.has(id(i));
      return <li key={id(i)} className={n >= COLLAPSE && !open ? "max-sm:hidden" : ""}>
        <label className="flex min-h-[52px] cursor-pointer items-center gap-3 px-3 py-2">
          <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(i)} className="h-5 w-5 shrink-0 accent-[rgb(var(--accent))]" data-testid="cl-check" />
          {i.image ? <img src={i.image} alt="" className="h-7 w-7 shrink-0 rounded-full bg-line object-cover" loading="lazy" onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} />
            : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-line text-[10px] font-semibold text-mute">{(i.symbol || i.mint).slice(0, 2).toUpperCase()}</span>}
          <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5"><span className={"truncate text-sm font-medium " + (i.symbol ? "" : "font-mono")}>{i.symbol || short(i.mint)}</span>
            {i.kind === "valued" && <span className="shrink-0 rounded-full bg-[rgb(var(--accent)/0.15)] px-2 py-0.5 text-[10px] font-semibold text-accent-fg">{t("clBadge")}</span>}</span>
            <span className="block truncate text-xs text-faint tabular-nums">{i.kind === "empty" ? "0" : i.ui}{i.kind !== "empty" && (i.usd == null ? " · " + t("clUnknown") : " · $" + (i.usd < 0.01 ? "<0.01" : i.usd.toFixed(2)))}</span></span>
          <span className="shrink-0 text-right"><span className="block text-sm tabular-nums">+{(i.lamports / LAMPORTS_PER_SOL).toFixed(6)}</span><span className="block text-[10px] text-faint">{t("clRent")}</span></span>
        </label></li>; })}</ul>
    {hidden > 0 && <button onClick={() => setOpen(!open)} className="w-full min-h-[44px] border-t border-line text-xs text-mute sm:hidden" data-testid="cl-more">{open ? t("clLess") : t("clMore", { n: hidden })}</button>}
  </section>);
}

function Warn({ item, onOk, onCancel }: { item: Item; onOk: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  return createPortal(<div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(var(--scrim)/0.6)] backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" onClick={onCancel} data-testid="cl-warn">
    <div className="fade-in w-full max-w-sm rounded-t-2xl border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
      <h2 className="text-lg font-semibold text-danger-fg">{t("clWarnT")}</h2>
      <p className="mt-2 text-sm text-mute">{t("clWarn", { s: item.symbol || short(item.mint), u: "$" + (item.usd ?? 0).toFixed(2) })}</p>
      <div className="mt-5 grid grid-cols-2 gap-3"><button onClick={onCancel} className="btn-ghost">{t("cancel")}</button><button onClick={onOk} className="btn-danger" data-testid="cl-warn-ok">{t("clYes")}</button></div>
    </div></div>, document.body);
}
