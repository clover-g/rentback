"use client";
// Procedural coin jingle (Web Audio, original synthesis; no external audio).
let ctx: AudioContext | null = null;
const KEY = "rb-sound";
export const soundOn = () => typeof window !== "undefined" && localStorage.getItem(KEY) !== "off";
export const setSoundOn = (v: boolean) => { localStorage.setItem(KEY, v ? "on" : "off"); window.dispatchEvent(new Event("rb-sound")); };
export function unlockAudio() {
  if (typeof window === "undefined" || !soundOn()) return;
  try { const C = (window as any).AudioContext || (window as any).webkitAudioContext; if (!ctx) ctx = new C();
    if (ctx!.state === "suspended") ctx!.resume();
    const b = ctx!.createBuffer(1, 1, 22050); const s = ctx!.createBufferSource(); s.buffer = b; s.connect(ctx!.destination); s.start(0);
  } catch {}
}
/** One metallic clink: inharmonic partials with fast decay + tiny noise transient. */
export function clink(c: BaseAudioContext, out: AudioNode, t: number, base: number, gain: number) {
  const ratios = [1, 2.76, 5.4, 8.93]; const g0 = c.createGain(); g0.gain.value = gain; g0.connect(out);
  ratios.forEach((r, i) => { const o = c.createOscillator(); const g = c.createGain(); o.type = "sine"; o.frequency.value = base * r * (1 + (Math.random() - .5) * .006);
    const d = 0.5 / (1 + i * .9); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 / (i + 1), t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(g0); o.start(t); o.stop(t + d + 0.02); });
  const n = c.createBuffer(1, Math.floor(c.sampleRate * 0.02), c.sampleRate); const dt = n.getChannelData(0); for (let i = 0; i < dt.length; i++) dt[i] = (Math.random() * 2 - 1) * (1 - i / dt.length);
  const s = c.createBufferSource(); s.buffer = n; const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 5000; const ng = c.createGain(); ng.gain.value = 0.15;
  s.connect(hp).connect(ng).connect(g0); s.start(t);
}
/** Synth B voice: harmonic (in-tune) coin chime so stacked notes stay consonant. */
export function chime(c: BaseAudioContext, out: AudioNode, t: number, f: number, gain: number) {
  const g0 = c.createGain(); g0.gain.value = gain; g0.connect(out);
  [[1, .6, .55], [2, .25, .3], [3, .1, .18]].forEach(([r, a, d]) => { const o = c.createOscillator(); const g = c.createGain(); o.type = "sine"; o.frequency.value = f * r;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(g0); o.start(t); o.stop(t + d + 0.02); });
  const n = c.createBuffer(1, Math.floor(c.sampleRate * 0.012), c.sampleRate); const dt = n.getChannelData(0); for (let i = 0; i < dt.length; i++) dt[i] = (Math.random() * 2 - 1) * (1 - i / dt.length);
  const s = c.createBufferSource(); s.buffer = n; const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000; const ng = c.createGain(); ng.gain.value = 0.08; s.connect(hp).connect(ng).connect(g0); s.start(t);
}
/** E major chord tones only: E6 G#6 B6 E7 G#7 B7 E8 */
export const E_MAJ = [1318.51, 1661.22, 1975.53, 2637.02, 3322.44, 3951.07, 5274.04];
/** Counter timing (must match KanteiCounter): first digit locks at LEAD, last at counterSettleMs(n). */
export const COUNTER_LEAD = 450;
export const counterStep = (n: number) => Math.min(260, 1900 / n);
export const counterSettleMs = (n: number) => COUNTER_LEAD + (n - 1) * counterStep(n);
export function jingle(c: BaseAudioContext, out: AudioNode, t0: number, settleMs = 0) {
  const m = c.createGain(); m.gain.value = 0.22; m.connect(out);
  let times = [0, .11, .2, .34, .45, .6, .72, .9, 1.05];
  if (settleMs > 0) { const a = COUNTER_LEAD / 1000, b = settleMs / 1000; times = times.map((x) => a + (x / 1.05) * (b - a)); } const E = E_MAJ, bases = [E[0], E[2], E[1], E[3], E[2], E[4], E[3], E[5], E[6]];
  times.forEach((dt, i) => chime(c, m, t0 + dt + Math.random() * .02, bases[i], i === times.length - 1 ? 1 : 0.6 + Math.random() * .3));
}
/** settleMs: pass counterSettleMs(digits) so the final chime lands when the counter number locks. */
export function playJingle(settleMs = 0) { const c = live(); if (!c) return; try { jingle(c, c.destination, c.currentTime, settleMs); } catch {} }
export function playTick() { if (!soundOn() || !ctx || ctx.state !== "running") return; try { const g = ctx.createGain(); g.gain.value = 0.05; g.connect(ctx.destination); clink(ctx, g, ctx.currentTime, 3000 + Math.random() * 600, 0.5); } catch {} }
// --- iOS unlock: silent switch mutes Web Audio unless audio session is "playback"; also ctx must be created/resumed in a gesture ---
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
let tag: HTMLAudioElement | null = null;
function gestureUnlock() {
  if (!soundOn()) return;
  try { const n: any = navigator; if (n.audioSession) n.audioSession.type = "playback"; } catch {}
  try { if (!tag) { tag = new Audio(SILENT); tag.setAttribute("playsinline", ""); tag.loop = true; tag.volume = 0.01; } tag.play().catch(() => {}); } catch {}
  unlockAudio();
}
if (typeof window !== "undefined") ["pointerdown", "touchend", "click", "keydown"].forEach((e) => window.addEventListener(e, gestureUnlock, { capture: true, passive: true }));
// --- checklist toggle sounds ---
function live() { if (!soundOn()) return null; try { const C = (window as any).AudioContext || (window as any).webkitAudioContext; if (!ctx || ctx.state === "closed") ctx = new C(); if (ctx!.state !== "running") ctx!.resume().catch(() => {}); return ctx; } catch { return null; } }
/** Option A: single short clink (from the claim jingle's voice). */
export function playCheckA() { const c = live(); if (!c) return; const g = c.createGain(); g.gain.value = 0.2; g.connect(c.destination); clink(c, g, c.currentTime + 0.01, 2637, 0.9); }
/** Option B (chosen): synth v2 E-major 3-coin cascade. */
export function playCheckB() { const c = live(); if (!c) return; const g = c.createGain(); g.gain.value = 0.18; g.connect(c.destination);
  [0, .06, .12].forEach((d, i) => chime(c, g, c.currentTime + 0.01 + d, [E_MAJ[3], E_MAJ[4], E_MAJ[5]][i], 0.7 + i * .1)); }
/** Uncheck: short descending "bon" thud (~150ms pitch drop). */
export function playBon() { const c = live(); if (!c) return; const t = c.currentTime + 0.01;
  const o = c.createOscillator(); const g = c.createGain(); o.type = "triangle"; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.15);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.2); }
