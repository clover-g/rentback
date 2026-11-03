import { Connection, PublicKey } from "@solana/web3.js";
const conn = new Connection(process.env.NEXT_PUBLIC_RPC_URL!, { commitment: "confirmed", httpHeaders: { Origin: "https://rentbacksol.app" } });
const FW = "GbXQhLxNVmbt67pS7uY2FHVamMkTZAEokHNJ63zKoZp8";
(async () => { for (const s of await conn.getSignaturesForAddress(new PublicKey(FW), { limit: 50 })) {
  const tx = await conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 }); if (!tx) continue;
  const ixs = [...tx.transaction.message.instructions, ...(tx.meta?.innerInstructions || []).flatMap((x) => x.instructions)] as any[];
  const tr = ixs.filter((i) => i.parsed?.type === "transfer" && i.parsed.info?.destination === FW).map((i) => i.parsed.info.source.slice(0, 4) + "→" + i.parsed.info.lamports);
  console.log(new Date(s.blockTime! * 1000).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }), s.err ? "ERR" : "", tx.transaction.message.accountKeys[0].pubkey.toBase58().slice(0, 4), "close:", ixs.filter((i) => i.parsed?.type === "closeAccount").length, tr.join(","), s.signature.slice(0, 8));
} })();
