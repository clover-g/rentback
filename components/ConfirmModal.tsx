"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";
export const MANY = 10;
/** Final confirmation listing exactly what will be burned. >10 items → extra second confirmation step. */
export default function ConfirmModal({ items, onConfirm, onCancel }: { items: { label: string; amount: string; usd?: string }[]; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useI18n(); const [step, setStep] = useState(1);
  const many = items.length > MANY;
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = "hidden"; const k = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", k); return () => { document.body.style.overflow = o; window.removeEventListener("keydown", k); }; }, [onCancel]);
  return createPortal(<div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(var(--scrim)/0.6)] backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" data-testid="confirm-modal" onClick={onCancel}>
    <div className="fade-in flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-2xl border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-fg" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg></span>
        <h2 className="text-lg font-semibold">{step === 1 ? t("confirmTitle") : t("manyTitle", { n: items.length })}</h2></div>
      {step === 1 ? <>
        <p className="mt-3 text-sm text-mute">{t("confirmList")}</p>
        <ul className="mt-3 min-h-0 flex-1 divide-y divide-line overflow-auto rounded-xl border border-line text-sm">{items.map((i, k) =>
          <li key={k} className="flex items-center justify-between gap-3 px-3 py-2.5"><span className="min-w-0 flex-1 truncate font-mono">{i.label}</span><span className="shrink-0 tabular-nums font-medium">{i.amount}</span>{i.usd !== undefined && <span className="w-16 shrink-0 text-right text-xs text-faint tabular-nums">{i.usd}</span>}</li>)}</ul>
      </> : <p className="mt-3 text-sm leading-relaxed text-mute">{t("manyBody", { n: items.length })}</p>}
      <p className="mt-3 text-xs text-faint">{t("trust1")} · <a href="/terms" target="_blank" className="link inline-flex min-h-[44px] items-center">{t("terms")}</a></p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <button onClick={onCancel} className="btn-ghost">{t("cancel")}</button>
        <button data-testid="confirm-burn" onClick={() => (many && step === 1 ? setStep(2) : onConfirm())} className="btn-danger">
          {many && step === 1 ? t("next") : t("doBurn")}</button>
      </div>
    </div></div>, document.body);
}
