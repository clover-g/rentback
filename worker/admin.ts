// /admin — owner-only dashboard of all RentBack reclaims, built server-side from on-chain data (fee wallet signatures).
// Gate: HTTP Basic auth against the ADMIN_PASSWORD secret (any username). No secret set => 404.
// RPC: ADMIN_RPC_URL secret (falls back to RPC_URL var). Never sent to the browser.
export interface AdminEnv { ADMIN_PASSWORD?: string; ADMIN_RPC_URL?: string; RPC_URL?: string }
const FW = "GbXQhLxNVmbt67pS7uY2FHVamMkTZAEokHNJ63zKoZp8";
const SITE = "https://rentbacksol.app";
const CACHE_SEC = 60;
type Row = { sig: string; t: number; user: string; closed: number; gross: number; net: number; fee: number };

const eq = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const H = { "x-robots-tag": "noindex, nofollow, noarchive", "cache-control": "private, no-store", "referrer-policy": "no-referrer" };

async function rpc(url: string, body: unknown) {
  // Origin header: the Helius key is domain-restricted to rentbacksol.app
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", origin: SITE }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("rpc " + r.status); return r.json() as Promise<any>;
}
function toRow(tx: any, sig: string): Row | null {
  if (!tx?.meta || tx.meta.err) return null;
  const ixs = [...tx.transaction.message.instructions, ...(tx.meta.innerInstructions || []).flatMap((x: any) => x.instructions)];
  const tr = ixs.filter((i: any) => i.program === "system" && i.parsed?.type === "transfer" && i.parsed.info?.destination === FW);
  const closed = ixs.filter((i: any) => i.program === "spl-token" && i.parsed?.type === "closeAccount").length;
  if (!tr.length || !closed) return null; // plain transfers to the fee wallet are excluded
  const user = tr[0].parsed.info.source; const fee = tr.reduce((a: number, i: any) => a + Number(i.parsed.info.lamports), 0);
  const keys = tx.transaction.message.accountKeys.map((k: any) => k.pubkey ?? k); const idx = keys.indexOf(user); if (idx < 0) return null;
  const net = tx.meta.postBalances[idx] - tx.meta.preBalances[idx];
  return { sig, t: tx.blockTime || 0, user, closed, fee, net, gross: net + fee + (idx === 0 ? tx.meta.fee : 0) };
}
export async function loadRows(url: string): Promise<Row[]> {
  const sigs: string[] = []; let before: string | undefined;
  for (let p = 0; p < 20; p++) { // up to 20k signatures
    const r = await rpc(url, { jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress", params: [FW, { limit: 1000, ...(before ? { before } : {}) }] });
    const s = (r.result || []) as any[]; sigs.push(...s.filter((x) => !x.err).map((x) => x.signature)); if (s.length < 1000) break; before = s[s.length - 1].signature;
  }
  const rows: Row[] = [];
  for (let i = 0; i < sigs.length; i += 100) { // JSON-RPC batch: 1 subrequest per 100 txs
    const chunk = sigs.slice(i, i + 100);
    const res = await rpc(url, chunk.map((sig, j) => ({ jsonrpc: "2.0", id: j, method: "getTransaction", params: [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }] })));
    for (const x of res as any[]) { const r = toRow(x.result, chunk[x.id]); if (r) rows.push(r); }
  }
  return rows.sort((a, b) => b.t - a.t);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const sol = (l: number, d = 6) => (l / 1e9).toFixed(d);
const jst = (t: number) => { const d = new Date((t + 9 * 3600) * 1000); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`; };
const short = (s: string) => s.slice(0, 4) + "…" + s.slice(-4);
function stats(rows: Row[]) { const u = new Set(rows.map((r) => r.user)); return { n: rows.length, users: u.size, closed: rows.reduce((a, r) => a + r.closed, 0), fee: rows.reduce((a, r) => a + r.fee, 0), gross: rows.reduce((a, r) => a + r.gross, 0), net: rows.reduce((a, r) => a + r.net, 0) }; }

function chart(rows: Row[]) {
  const pts = [...rows].sort((a, b) => a.t - b.t); if (pts.length < 2) return "";
  let c = 0; const cum = pts.map((r) => (c += r.fee, { t: r.t, c })); const t0 = cum[0].t, t1 = cum[cum.length - 1].t || t0 + 1, max = c || 1; const W = 340, Hh = 120;
  const xy = (p: { t: number; c: number }) => `${(((p.t - t0) / Math.max(1, t1 - t0)) * W).toFixed(1)},${(Hh - (p.c / max) * (Hh - 8)).toFixed(1)}`;
  const line = cum.map((p, i) => (i ? `H${xy(p).split(",")[0]} V${xy(p).split(",")[1]}` : `M0,${Hh} V${xy(p).split(",")[1]}`)).join(" ");
  return `<div class="card"><div class="lbl">累計手数料 / Cumulative fees</div><svg viewBox="0 0 ${W} ${Hh}" width="100%" preserveAspectRatio="none" style="height:130px;display:block;margin-top:8px">
<path d="${line} L${W},${Hh} Z" fill="rgba(52,211,153,.15)"/><path d="${line}" fill="none" stroke="#34d399" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
<div class="row sub"><span>${jst(t0).slice(0, 10)}</span><span>${sol(max)} SOL</span><span>${jst(t1).slice(0, 10)}</span></div></div>`;
}
export function renderAdmin(rows: Row[], now: number, fetchedAt: number) {
  const dayStart = Math.floor((now + 9 * 3600) / 86400) * 86400 - 9 * 3600; // JST midnight
  const all = stats(rows), today = stats(rows.filter((r) => r.t >= dayStart)), wk = stats(rows.filter((r) => r.t >= now - 7 * 86400));
  const box = (l: string, v: string, s = "") => `<div class="card"><div class="lbl">${l}</div><div class="big">${v}</div>${s ? `<div class="sub">${s}</div>` : ""}</div>`;
  const per = (l: string, s: ReturnType<typeof stats>) => `<div class="card"><div class="lbl">${l}</div><div class="big">${sol(s.fee)} <small>SOL fee</small></div><div class="sub">${s.n} reclaims · ${s.users} users · ${s.closed} accts · gross ${sol(s.gross)}</div></div>`;
  const list = rows.map((r) => `<li><div class="row"><span class="sub">${jst(r.t)}</span><a href="https://solscan.io/tx/${esc(r.sig)}" target="_blank" rel="noopener">tx ↗</a></div>
<div class="row"><span><a class="mono" href="https://solscan.io/account/${esc(r.user)}" target="_blank" rel="noopener">${esc(short(r.user))}</a> <button class="cp" data-a="${esc(r.user)}">copy</button></span><span class="sub">${r.closed} accts</span></div>
<div class="row nums"><span>gross <b>${sol(r.gross)}</b></span><span>net <b class="g">${sol(r.net)}</b></span><span>fee <b>${sol(r.fee)}</b></span></div></li>`).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>RentBack admin</title>
<style>*{box-sizing:border-box}body{margin:0;background:#0f1216;color:#f3f4f6;font:14px/1.45 system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif}main{max-width:760px;margin:0 auto;padding:16px}
h1{font-size:18px;margin:4px 0 12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.card{background:#171b21;border:1px solid #262c35;border-radius:14px;padding:12px;margin-bottom:10px}.grid .card{margin:0}
.lbl{font-size:11px;color:#9ca3af}.big{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums}.big small{font-size:11px;color:#9ca3af;font-weight:500}.sub{font-size:11px;color:#9ca3af}
.row{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.nums{font-variant-numeric:tabular-nums;font-size:12px;margin-top:2px}.g{color:#34d399}
ul{list-style:none;margin:0;padding:0}li{padding:10px 0;border-top:1px solid #262c35}a{color:#93c5fd;text-decoration:none}.mono{font-family:ui-monospace,monospace}
.cp{background:#262c35;color:#d1d5db;border:0;border-radius:6px;font-size:11px;padding:3px 8px;margin-left:4px;min-height:24px}@media(min-width:640px){.grid{grid-template-columns:repeat(4,1fr)}}</style></head><body><main>
<h1>RentBack admin</h1>
<div class="grid">${box("累計手数料 Fees", sol(all.fee) + ` <small>SOL</small>`)}${box("累計回収 Gross", sol(all.gross) + ` <small>SOL</small>`, "net to users " + sol(all.net))}${box("回収回数 Reclaims", String(all.n), all.closed + " accounts closed")}${box("ユーザー Users", String(all.users))}</div>
<div style="height:10px"></div>${per("今日 Today (JST)", today)}${per("直近7日 Last 7 days", wk)}${chart(rows)}
<div class="card"><div class="row"><div class="lbl">全回収 All reclaims (${rows.length})</div><a class="sub" href="/admin?refresh=1">更新 refresh</a></div><ul>${list || `<li class="sub">まだありません</li>`}</ul></div>
<p class="sub">On-chain data via fee wallet ${short(FW)} · updated ${jst(Math.floor(fetchedAt / 1000))} JST · cached ${CACHE_SEC}s</p></main><script>document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.cp');if(!b)return;navigator.clipboard.writeText(b.dataset.a).then(function(){b.textContent='copied';setTimeout(function(){b.textContent='copy'},1200)})})</script></body></html>`;
}

export async function handleAdmin(req: Request, env: AdminEnv, ctx: any): Promise<Response> {
  if (!env.ADMIN_PASSWORD) return new Response("Not found", { status: 404, headers: H });
  const m = (req.headers.get("authorization") || "").match(/^Basic\s+(.+)$/i); let pw = "";
  try { if (m) pw = atob(m[1]).split(":").slice(1).join(":"); } catch {}
  if (!eq(pw, env.ADMIN_PASSWORD)) return new Response("Unauthorized", { status: 401, headers: { ...H, "www-authenticate": 'Basic realm="RentBack admin", charset="UTF-8"' } });
  const url = env.ADMIN_RPC_URL || env.RPC_URL; if (!url) return new Response("ADMIN_RPC_URL not set", { status: 500, headers: H });
  const u = new URL(req.url); const cache = (globalThis as any).caches?.default; const key = new Request("https://rentbacksol.app/__admin-data-v1"); // internal key, only read after auth
  let data: { rows: Row[]; at: number } | null = null;
  if (cache && !u.searchParams.has("refresh")) { const hit = await cache.match(key); if (hit) data = await hit.json(); }
  if (!data) { try { data = { rows: await loadRows(url), at: Date.now() }; } catch (e: any) { return new Response("RPC error: " + esc(String(e?.message || e)), { status: 502, headers: H }); }
    if (cache) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "cache-control": `max-age=${CACHE_SEC}` } }))); }
  return new Response(renderAdmin(data.rows, Math.floor(Date.now() / 1000), data.at), { headers: { ...H, "content-type": "text/html; charset=utf-8" } });
}
