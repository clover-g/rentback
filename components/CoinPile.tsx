"use client";
import { useEffect, useRef, useState } from "react";
/** Original canvas art: SOL-styled gold coins rain down and pile up.
 *  idle = small pile + occasional twinkle · claiming = trickle, pile grows · success = shower, big pile, sparkles.
 *  Coin count capped (≤ 72 resting + ≤ 30 falling); prefers-reduced-motion → static pile. */
export type PileState = "idle" | "claiming" | "success";
const W = 260, H = 190, BASE = 172, CR = 11; // canvas css size, ground y, coin radius
type Slot = { x: number; y: number; tilt: number; gem?: number };
type Fall = { x: number; y: number; vy: number; vx: number; slot: number; spin: number; t: number };
type Tw = { x: number; y: number; t: number; life: number; s: number };
// Mound slots: bottom rows first, centre-out, so the heap grows naturally.
const SLOTS: Slot[] = (() => {
  const out: (Slot & { k: number })[] = []; let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const R = 16, STEP = 7.2;
  for (let r = 0; r < R; r++) {
    const half = Math.max(5, 104 * (1 - r / R)); const n = Math.max(1, Math.round((half * 2) / 14)); // linear taper → cone
    for (let k = 0; k < n; k++) { const x = W / 2 - half + (k + 0.5) * ((half * 2) / n) + (rnd() - 0.5) * 4;
      // cone growth order: centre & low first, the heap widens and rises together
      // key = height + |dx|*slope: every partial set is itself a cone (pointed at any size)
      out.push({ x, y: BASE - r * STEP + (rnd() - 0.5) * 1.5, tilt: (rnd() - 0.5) * 0.5, k: r * STEP + Math.abs(x - W / 2) * 1.45 + rnd() * 3 }); }
  }
  out.sort((a, b) => a.k - b.k);
  return out.slice(0, 96).map(({ x, y, tilt }, i) => ({ x, y, tilt, gem: i > 2 && (i * 7919) % 100 < 13 ? (i * 31) % 5 : -1 }));
})();
// paint back-to-front (higher rows behind lower ones would look wrong; draw by y ascending)
const PAINT = SLOTS.map((s, i) => i).sort((a, b) => SLOTS[a].y - SLOTS[b].y);
const IDLE_N = 18;
export function pileTarget(lamports: number) { const sol = lamports / 1e9; return Math.min(SLOTS.length, Math.round(52 + Math.log10(1 + sol * 100) * 20)); }
const css = (n: string) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(n).trim().split(/\s+/).join(",")})`;
// Gold coin sprite, rendered once (face-on) and drawn squashed/tilted per frame — cheap on mobile.
let SPRITE: HTMLCanvasElement | null = null;
function sprite(): HTMLCanvasElement {
  if (SPRITE) return SPRITE;
  const S = 64, r = 30, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d")!; g.translate(S / 2, S / 2);
  let gr = g.createLinearGradient(-r, -r, r, r); gr.addColorStop(0, "#FFE680"); gr.addColorStop(0.5, "#E0A800"); gr.addColorStop(1, "#8A6208");   // rim
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  gr = g.createRadialGradient(-r * 0.35, -r * 0.4, 2, 0, 0, r * 0.95); gr.addColorStop(0, "#FFF3B0"); gr.addColorStop(0.35, "#FFD54A"); gr.addColorStop(0.75, "#F5B700"); gr.addColorStop(1, "#C99200");
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 0.84, 0, Math.PI * 2); g.fill();                                                                 // face
  g.lineWidth = 1.6; g.strokeStyle = "rgba(255,248,200,.85)"; g.beginPath(); g.arc(0, 0, r * 0.84, Math.PI * 1.05, Math.PI * 1.75); g.stroke();      // embossed rim light
  g.strokeStyle = "rgba(140,96,8,.55)"; g.beginPath(); g.arc(0, 0, r * 0.84, Math.PI * 0.05, Math.PI * 0.75); g.stroke();                             // rim shade
  g.strokeStyle = "rgba(184,134,11,.45)"; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, r * 0.66, 0, Math.PI * 2); g.stroke();
  const bar = (dy: number, dir: number) => { const o = 3.4 * dir, h = 2.6; g.beginPath(); g.moveTo(-11 + o, dy - h); g.lineTo(11 + o, dy - h); g.lineTo(11 - o, dy + h); g.lineTo(-11 - o, dy + h); g.closePath(); };
  for (const [dy, dir] of [[-8, 1], [0, -1], [8, 1]] as const) { g.save(); g.translate(0.8, 1); bar(dy, dir); g.fillStyle = "rgba(255,245,190,.7)"; g.fill(); g.restore();  // emboss light
    bar(dy, dir); g.fillStyle = "#B07F06"; g.fill(); }                                                                                             // darker-gold mark
  g.save(); g.beginPath(); g.arc(0, 0, r * 0.84, 0, Math.PI * 2); g.clip(); g.rotate(-0.7);                                                           // specular streak
  gr = g.createLinearGradient(0, -r, 0, r); gr.addColorStop(0.28, "rgba(255,255,255,0)"); gr.addColorStop(0.36, "rgba(255,255,255,.55)"); gr.addColorStop(0.42, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2); g.restore();
  return (SPRITE = c);
}
function coin(g: CanvasRenderingContext2D, x: number, y: number, tilt: number, squash: number, _c: Record<string, string>, shine = 0) {
  const rx = CR, ry = CR * squash, th = 2.6 * (1 - squash) + 1.2;
  g.save(); g.translate(x, y); g.rotate(tilt);
  const ed = g.createLinearGradient(-rx, 0, rx, 0); ed.addColorStop(0, "#8A6208"); ed.addColorStop(0.5, "#D9A10A"); ed.addColorStop(1, "#7A5506");   // edge thickness
  g.fillStyle = ed; g.beginPath(); g.ellipse(0, th, rx, ry, 0, 0, Math.PI); g.lineTo(-rx, 0); g.ellipse(0, 0, rx, ry, 0, Math.PI, 0, true); g.fill();
  g.scale(1, squash); g.drawImage(sprite(), -rx, -rx, rx * 2, rx * 2);
  if (shine > 0) { g.globalCompositeOperation = "lighter"; g.globalAlpha = shine * 0.6; g.fillStyle = "#FFF6C8"; g.beginPath(); g.arc(0, 0, rx * 0.84, 0, Math.PI * 2); g.fill(); }
  g.restore();
}
// Faceted gems (brilliant cut, side view): ruby, emerald, sapphire, amethyst, diamond. Pre-rendered sprites.
const GEMS: [string, string, string][] = [["#FF6B7A", "#D7263D", "#7A0E1E"], ["#6FF0A8", "#1FAE5B", "#0B5E31"], ["#7DB7FF", "#2B6BE0", "#123A85"], ["#D7A6FF", "#8E44D9", "#4B1C80"], ["#FFFFFF", "#D9ECF7", "#8FB3C9"]];
const GEM_SPR: HTMLCanvasElement[] = [];
function gemSprite(k: number) {
  if (GEM_SPR[k]) return GEM_SPR[k];
  const c = document.createElement("canvas"); c.width = 48; c.height = 44; const g = c.getContext("2d")!; const [hi, mid, lo] = GEMS[k];
  const T = 8, Wd = 22, C = 16, P = 40; // table half-width, girdle half-width, crown y, pavilion tip y
  const poly = (pts: number[], col: string) => { g.beginPath(); g.moveTo(24 + pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(24 + pts[i], pts[i + 1]); g.closePath(); g.fillStyle = col; g.fill(); };
  // crown facets
  poly([-T, 6, T, 6, Wd, C, -Wd, C], mid); poly([-T, 6, -Wd, C, -T * 0.4, C], hi); poly([T, 6, T * 0.4, C, Wd, C], lo); poly([-T, 6, T, 6, 0, C], hi + "cc");
  // pavilion facets
  poly([-Wd, C, 0, P, -Wd * 0.35, C], lo); poly([-Wd * 0.35, C, 0, P, Wd * 0.35, C], mid); poly([Wd * 0.35, C, 0, P, Wd, C], lo + "dd"); poly([-Wd * 0.35, C, 0, P, -Wd * 0.1, C], hi + "88");
  g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1; g.beginPath(); g.moveTo(24 - Wd, C); g.lineTo(24 + Wd, C); g.stroke();
  g.beginPath(); g.moveTo(24 - T, 6); g.lineTo(24 + T, 6); g.stroke();
  g.fillStyle = "rgba(255,255,255,.9)"; g.beginPath(); g.ellipse(24 - 6, 10, 3.5, 1.4, -0.3, 0, Math.PI * 2); g.fill(); // highlight glint
  return (GEM_SPR[k] = c);
}
function gem(g: CanvasRenderingContext2D, x: number, y: number, tilt: number, k: number) {
  g.save(); g.translate(x, y); g.rotate(tilt * 0.6); g.drawImage(gemSprite(k), -9, -10, 18, 16.5); g.restore();
}
function star(g: CanvasRenderingContext2D, x: number, y: number, s: number, a: number, col: string) {
  g.save(); g.globalAlpha = a; g.fillStyle = col; g.translate(x, y); g.beginPath();
  g.moveTo(0, -s); g.quadraticCurveTo(0, 0, s, 0); g.quadraticCurveTo(0, 0, 0, s); g.quadraticCurveTo(0, 0, -s, 0); g.quadraticCurveTo(0, 0, 0, -s); g.fill(); g.restore();
}
export default function CoinPile({ state, lamports = 0 }: { state: PileState; lamports?: number }) {
  const ref = useRef<HTMLCanvasElement>(null); const st = useRef({ state, lamports }); st.current = { state, lamports };
  useEffect(() => {
    const cv = ref.current!; const g = cv.getContext("2d")!; const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; g.scale(dpr, dpr);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let rest = st.current.state === "success" && reduce ? pileTarget(st.current.lamports) : IDLE_N; let claimed = rest; // slots resting / reserved
    const falls: Fall[] = []; const tws: Tw[] = []; let last = performance.now(), acc = 0, raf = 0, prevState = "";
    let colors: Record<string, string> = {}; let colorAt = 0;
    const spawn = () => { if (claimed >= SLOTS.length || falls.length > 30) return; const slot = claimed++; const s = SLOTS[slot];
      falls.push({ x: s.x + (Math.random() - 0.5) * 40, y: -20 - Math.random() * 40, vy: 30 + Math.random() * 40, vx: 0, slot, spin: Math.random() * 6, t: 0 }); };
    const twinkle = (x?: number, y?: number) => { const s = SLOTS[Math.floor(Math.random() * Math.max(1, rest))];
      if (tws.length > 70) return; tws.push({ x: x ?? s.x + (Math.random() - 0.5) * 10, y: y ?? s.y - 4 - Math.random() * 6, t: 0, life: 1.8 + Math.random() * 1.2, s: 2 + Math.random() * 2.8 }); };
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (now - colorAt > 400) { colors = { face: css("--accent"), edge: css("--accent-fg"), ring: "rgba(4,20,14,.18)", mark: "rgba(4,20,14,.55)", star: css("--ink") }; colorAt = now; }
      const { state: S, lamports: L } = st.current;
      if (S !== prevState) { if (S === "idle") { rest = Math.min(rest, IDLE_N); claimed = rest; falls.length = 0; }
        if (S === "success") { acc = 0; for (let i = 0; i < 20; i++) twinkle(W / 2 + (Math.random() - 0.5) * 160, 30 + Math.random() * 80); } prevState = S; }
      // spawning
      acc += dt;
      if (S === "claiming" && acc > 0.28 && claimed < IDLE_N + 14) { acc = 0; spawn(); }
      if (S === "success") { const target = pileTarget(L); const rate = 0.035; while (acc > rate && claimed < target) { acc -= rate; spawn(); } }
      const rate = S === "success" ? 36 : S === "claiming" ? 14 : 7; // sparkles/sec, continuous
      let k2 = rate * dt; while (k2 > 0) { if (Math.random() < Math.min(1, k2)) { Math.random() < 0.2 ? twinkle(W / 2 + (Math.random() - 0.5) * 200, 20 + Math.random() * 110) : twinkle(); } k2 -= 1; }
      // gems glint a bit more often
      if (Math.random() < dt * 4) { const gi = SLOTS.findIndex((q, j) => j < rest && (q.gem ?? -1) >= 0 && Math.random() < 0.3); if (gi >= 0) twinkle(SLOTS[gi].x + 3, SLOTS[gi].y - 6); }
      // physics: fall with gravity toward slot, small bounce then settle
      for (let i = falls.length - 1; i >= 0; i--) { const f = falls[i]; const s = SLOTS[f.slot]; f.t += dt; f.vy += 900 * dt; f.y += f.vy * dt; f.x += (s.x - f.x) * Math.min(1, dt * 5); f.spin += dt * 9;
        if (f.y >= s.y) { if (f.vy > 160) { f.y = s.y; f.vy = -f.vy * 0.22; } else { falls.splice(i, 1); rest = Math.max(rest, f.slot + 1); } } }
      // render
      g.clearRect(0, 0, W, H);
      g.fillStyle = document.documentElement.classList.contains("dark") ? "rgba(0,0,0,.35)" : "rgba(120,80,0,.16)"; g.beginPath(); g.ellipse(W / 2, BASE + 9, 30 + Math.sqrt(rest) * 9, 6, 0, 0, Math.PI * 2); g.fill();
      const restingSet = new Set(falls.map((f) => f.slot));
      const sweep = ((now / 1000) % 3.2) / 1.1; // light sweep across the heap every ~3s
      for (const i of PAINT) { if (i >= rest || restingSet.has(i)) continue; const s = SLOTS[i];
        const d = Math.abs((s.x - s.y * 0.6) / W - (sweep * 1.6 - 0.5)); (s.gem ?? -1) >= 0 ? gem(g, s.x, s.y - 2, s.tilt, s.gem!) : coin(g, s.x, s.y, s.tilt, 0.42, colors, d < 0.08 ? (1 - d / 0.08) : 0); }
      for (const f of falls) { const gk = SLOTS[f.slot].gem ?? -1; gk >= 0 ? gem(g, f.x, f.y, Math.sin(f.spin) * 0.8, gk) : coin(g, f.x, f.y, Math.sin(f.spin) * 0.6, 0.35 + Math.abs(Math.cos(f.spin)) * 0.65, colors); }
      for (let i = tws.length - 1; i >= 0; i--) { const w = tws[i]; w.t += dt; const k = w.t / w.life; if (k >= 1) { tws.splice(i, 1); continue; }
        star(g, w.x, w.y, w.s * Math.sin(k * Math.PI), Math.sin(k * Math.PI) * 0.95, i % 3 ? "#FFE680" : "#FFFDF0"); }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    if (reduce) { prevState = st.current.state; draw(performance.now()); const id = setInterval(() => { prevState = ""; rest = st.current.state === "success" ? pileTarget(st.current.lamports) : IDLE_N; claimed = rest; draw(performance.now()); }, 500); return () => clearInterval(id); }
    raf = requestAnimationFrame(draw); return () => cancelAnimationFrame(raf);
  }, []);
  return (<div className="relative mx-auto h-[190px] w-[260px]" aria-hidden data-testid="coin-pile" data-state={state}>
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 top-4 rounded-full transition-opacity duration-700 ${state === "success" ? "opacity-100" : "opacity-60"}`}
      style={{ background: "radial-gradient(closest-side, rgba(255,200,60,0.20), rgba(255,200,60,0.06) 60%, transparent)" }} />
    <canvas ref={ref} className="relative h-[190px] w-[260px]" />
  </div>);
}
/** Smooth ease-out count-up; instant under reduced motion. */
export function useCountUp(target: number, ms = 1400, delay = 200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf = 0; const t0 = performance.now() + delay;
    const tick = (now: number) => { const k = Math.min(1, Math.max(0, (now - t0) / ms)); setV(target * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}
