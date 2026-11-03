"use client";
import { useEffect, useRef, useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { COUNTER_LEAD, counterStep } from "@/lib/sound";
export const counterDigits = (lamports: number, decimals = 6) => ((lamports / LAMPORTS_PER_SOL).toFixed(decimals).match(/\d/g) || []).length;

/** Appraisal-style reveal: undetermined digits flicker, then settle one by one from the lowest place upward. */
export default function KanteiCounter({ lamports, decimals = 6, className = "", testId }: { lamports: number; decimals?: number; className?: string; testId?: string }) {
  const final = (lamports / LAMPORTS_PER_SOL).toFixed(decimals);
  const idx = [...final].map((c, i) => (/\d/.test(c) ? i : -1)).filter((i) => i >= 0).reverse(); // lowest place first
  const firstSig = [...final].findIndex((c) => /[1-9]/.test(c)); // leading zeros never spin (keeps magnitude ≤ target)
  const isLead = (i: number) => firstSig < 0 || i < firstSig;
  const [shown, setShown] = useState(final);
  const [settled, setSettled] = useState<number>(idx.length);
  const [pop, setPop] = useState(-1);
  const [done, setDone] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(final); setSettled(idx.length); return; }
    const n = idx.length; const lead = COUNTER_LEAD; const step = counterStep(n);
    const t0 = performance.now(); let last = -1; let lastFlick = 0;
    setSettled(0); setDone(0);
    const tick = (now: number) => {
      const el = now - t0; const k = Math.max(0, Math.min(n, Math.floor((el - lead) / step) + 1));
      if (k !== last) { last = k; setSettled(k); if (k > 0) setPop(idx[k - 1]); }
      if (now - lastFlick > 45 || k === n) {
        lastFlick = now;
        const fixed = new Set(idx.slice(0, k));
        setShown([...final].map((c, i) => (/\d/.test(c) && !fixed.has(i) && !isLead(i) ? String((Math.random() * 10) | 0) : c)).join(""));
      }
      if (k < n) raf.current = requestAnimationFrame(tick); else { setPop(-1); setDone((d) => d + 1); }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [final]); // eslint-disable-line
  const fixed = new Set(idx.slice(0, settled));
  return (<span className={"kantei relative inline-block tabular-nums " + (done ? "kantei-done " : "") + className} data-testid={testId} aria-label={final} key={done ? "d" + done : "a"}>
    <span aria-hidden>{[...shown].map((c, i) => {
      const digit = /\d/.test(c); const isFixed = !digit || fixed.has(i) || isLead(i);
      return <span key={i + (pop === i ? "p" : "")} className={"inline-block " + (digit ? (isFixed ? "kd-set" : "kd-roll") : "") + (pop === i ? " kd-pop" : "")} style={{ width: digit ? "1ch" : undefined }}>{c}</span>;
    })}</span>
    {done > 0 && <span aria-hidden className="kantei-flash pointer-events-none absolute inset-0" />}
    {done > 0 && [0, 1, 2, 3, 4, 5, 6, 7].map((i) => <span key={i} aria-hidden className="kantei-spark pointer-events-none absolute"
      style={{ left: `${8 + i * 12}%`, top: i % 2 ? "-6px" : "85%", animationDelay: `${i * 0.05}s` }} />)}
  </span>);
}
