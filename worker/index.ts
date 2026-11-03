import { ImageResponse } from "workers-og";
import { handleAdmin, AdminEnv } from "./admin";
interface Env extends AdminEnv { ASSETS: { fetch: (r: Request | string) => Promise<Response> } }
const parseA = (v: string | null) => {
  if (!v || !/^\d{1,6}(\.\d{1,9})?$/.test(v)) return null;
  const n = Number(v); if (!isFinite(n) || n <= 0 || n > 100000) return null; return n;
};
const T = { ja: { done: "回収が完了しました", desc: (a: string) => `空のトークン口座を閉じて ${a} SOL を回収しました`, title: (a: string) => `${a} SOL を回収しました | RentBack` },
  en: { done: "Reclaim complete", desc: (a: string) => `Closed empty token accounts and reclaimed ${a} SOL`, title: (a: string) => `Reclaimed ${a} SOL | RentBack` } };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
async function font(text: string, w: number) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${w}&text=${encodeURIComponent(text)}`, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534" } })).text();
  const u = css.match(/src: url\((.+?)\) format/)?.[1]; if (!u) throw new Error("font"); return (await fetch(u)).arrayBuffer();
}
export default {
  async fetch(req: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/admin" || url.pathname === "/admin/") return handleAdmin(req, env, ctx);
    const lang = url.searchParams.get("lang") === "en" ? "en" : "ja"; const L = T[lang];
    if (url.pathname === "/s" || url.pathname === "/og") {
      const n = parseA(url.searchParams.get("a"));
      const a = n == null ? null : n.toFixed(6);
      if (url.pathname === "/s") {
        const img = `${url.origin}/og?a=${a ?? ""}&lang=${lang}`; const title = a ? L.title(a) : "RentBack"; const desc = a ? L.desc(a) : "RentBack";
        const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta property="og:type" content="website"><meta property="og:site_name" content="RentBack"><meta property="og:url" content="${esc(url.href)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=/"><script>location.replace("/")</script></head><body><a href="/">RentBack</a></body></html>`;
        return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
      }
      const cache = (globalThis as any).caches?.default; const key = new Request(`${url.origin}/og?a=${a}&lang=${lang}&v=4`);
      const hit = cache && await cache.match(key); if (hit) return hit;
      const pile = await env.ASSETS.fetch(new Request(`${url.origin}/og-pile.png`)); const b = new Uint8Array(await pile.arrayBuffer());
      let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
      const pileUri = "data:image/png;base64," + btoa(s);
      const amt = a ?? "—"; const text = L.done + amt + "SOLRentBackrentbacksol.app";
      const [f7, f9] = await Promise.all([font(text, 700), font(text, 900)]);
      const html = `<div style="display:flex;width:1200px;height:630px;background:#0f1216;color:#f3f4f6;font-family:'Noto Sans JP';position:relative;align-items:center">
  <div style="display:flex;position:absolute;left:-90px;top:-40px;width:860px;height:860px;border-radius:430px;background:radial-gradient(circle, rgba(250,204,21,0.38) 0%, rgba(250,204,21,0) 65%)"></div>
  <img src="${pileUri}" width="680" height="540" style="position:absolute;left:-10px;top:84px" />
  <div style="display:flex;flex-direction:column;position:absolute;left:670px;top:0;width:500px;height:630px;justify-content:center">
    <div style="display:flex;font-size:44px;font-weight:700">${esc(L.done)}</div>
    <div style="display:flex;align-items:baseline;margin-top:18px"><span style="font-size:${amt.length > 9 ? 76 : 92}px;font-weight:900;color:#34d399">${esc(amt)}</span><span style="font-size:40px;font-weight:700;color:#9ca3af;margin-left:16px">SOL</span></div>
  </div>
  <div style="display:flex;position:absolute;left:56px;top:44px;align-items:center"><div style="display:flex;width:56px;height:56px;border-radius:14px;background:#34d399;color:#0f1216;font-size:36px;font-weight:900;align-items:center;justify-content:center">R</div><span style="font-size:36px;font-weight:700;margin-left:18px">RentBack</span></div>
  <div style="display:flex;position:absolute;right:56px;bottom:40px;font-size:26px;color:#6b7280">rentbacksol.app</div>
</div>`;
      const res = new ImageResponse(html, { width: 1200, height: 630, fonts: [{ name: "Noto Sans JP", data: f7, weight: 700, style: "normal" }, { name: "Noto Sans JP", data: f9, weight: 900, style: "normal" }] });
      const out = new Response(res.body, { headers: { "content-type": "image/png", "cache-control": "public, max-age=604800, immutable" } });
      if (cache) ctx.waitUntil(cache.put(key, out.clone())); return out;
    }
    return env.ASSETS.fetch(req);
  },
};
