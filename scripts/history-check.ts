import { Connection, PublicKey } from "@solana/web3.js";
import { fetchHistory } from "../lib/history";
const conn = new Connection(process.env.NEXT_PUBLIC_RPC_URL!, { commitment: "confirmed", httpHeaders: { Origin: "https://rentbacksol.app" } });
const FW = new PublicKey("GbXQhLxNVmbt67pS7uY2FHVamMkTZAEokHNJ63zKoZp8");
(async () => {
  const sigs = await conn.getSignaturesForAddress(FW, { limit: 100 });
  const senders = new Map<string, number>();
  for (const s of sigs) { if (s.err) continue; const tx = await conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 }); const k = tx?.transaction.message.accountKeys[0].pubkey.toBase58(); if (k && k !== FW.toBase58()) senders.set(k, (senders.get(k) || 0) + 1); }
  console.log("fee-wallet sigs", sigs.length, "senders", [...senders].map(([k, n]) => k.slice(0, 4) + "…" + k.slice(-4) + ":" + n));
  for (const k of [...senders.keys()].slice(0, 4)) {
    const t0 = Date.now(); const p = await fetchHistory(conn, new PublicKey(k), FW, { limit: 20 });
    console.log(k, "items", p.items.length, "done", p.done, (Date.now() - t0) + "ms");
    for (const it of p.items) console.log("  ", new Date(it.time! * 1000).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }), "net", it.net / 1e9, "gross", it.gross / 1e9, "fee", it.fee / 1e9, "closed", it.closed, it.sig.slice(0, 8));
  }
})();
