"use client";
import { useEffect, useState } from "react";
import { playJingle } from "@/lib/sound";
const atTop = () => (window.scrollY || document.scrollingElement?.scrollTop || document.documentElement.scrollTop || document.body.scrollTop || 0) < 4;
function toTop(smooth: boolean) {
  try { window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" }); } catch { window.scrollTo(0, 0); }
  if (!smooth) { const s = document.scrollingElement; if (s) s.scrollTop = 0; document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }
}
/** After a successful claim: wait until the page is visible + result rendered, scroll to top (smooth, then forced), then return true so the counter can roll + chime. */
export function useSuccessReveal(key: number | null, settleMs: number) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    setGo(false); if (key == null) return;
    const timers: any[] = []; let started = false; let fired = false;
    const fire = () => { if (fired) return; fired = true; setGo(true); playJingle(settleMs); };
    const run = () => {
      if (started || document.hidden) return; started = true;
      timers.push(setTimeout(() => toTop(true), 150));
      timers.push(setTimeout(() => { if (!atTop()) toTop(false); }, 750));
      timers.push(setTimeout(() => { if (!atTop()) toTop(false); fire(); }, 1000));
      const poll = setInterval(() => { if (atTop() && performance.now() > t0 + 300) { clearInterval(poll); timers.push(setTimeout(fire, 120)); } }, 50); timers.push(poll);
    };
    const t0 = performance.now();
    const vis = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", vis); window.addEventListener("focus", vis);
    requestAnimationFrame(() => requestAnimationFrame(run));
    return () => { document.removeEventListener("visibilitychange", vis); window.removeEventListener("focus", vis); timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); };
  }, [key]); // eslint-disable-line
  return go;
}
