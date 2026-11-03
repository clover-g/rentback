// Reclaim history, built only from on-chain data (no server DB).
// 1) getSignaturesForAddress(owner)  2) fetch parsed txs  3) keep txs with a SOL transfer owner -> FEE_WALLET
//    (RentBack's 3% fee) and count the CloseAccount instructions in the same tx.
import { Connection, PublicKey, ParsedTransactionWithMeta, ParsedInstruction, PartiallyDecodedInstruction } from "@solana/web3.js";

export type HistItem = { sig: string; time: number | null; net: number; gross: number; fee: number; txFee: number; closed: number };
const CONC = 4;
export type HistPage = { items: HistItem[]; before?: string; done: boolean };

const TOKEN_PROGRAMS = new Set(["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAbS1N9mLNYVpxCaJpuHqF5Kn"]);
const isParsed = (ix: ParsedInstruction | PartiallyDecodedInstruction): ix is ParsedInstruction => "parsed" in ix;

/** Pure: extract a history item from one parsed tx, or null if it is not a RentBack reclaim. */
export function toItem(tx: ParsedTransactionWithMeta | null, sig: string, owner: PublicKey, feeWallet: PublicKey): HistItem | null {
  if (!tx?.meta || tx.meta.err) return null;
  const o = owner.toBase58(), fw = feeWallet.toBase58();
  const all = [...tx.transaction.message.instructions, ...(tx.meta.innerInstructions || []).flatMap((x) => x.instructions)];
  let fee = 0, closed = 0;
  for (const ix of all) {
    if (!isParsed(ix)) continue;
    const p: any = ix.parsed;
    if (ix.program === "system" && p?.type === "transfer" && p.info?.source === o && p.info?.destination === fw) fee += Number(p.info.lamports) || 0;
    if ((ix.program === "spl-token" || TOKEN_PROGRAMS.has(ix.programId.toBase58())) && p?.type === "closeAccount") closed++;
  }
  if (fee <= 0 || closed === 0) return null; // must be a fee transfer alongside CloseAccount(s)
  const idx = tx.transaction.message.accountKeys.findIndex((k) => k.pubkey.toBase58() === o);
  if (idx < 0) return null;
  const net = tx.meta.postBalances[idx] - tx.meta.preBalances[idx];
  const txFee = idx === 0 ? tx.meta.fee : 0; // owner is fee payer in RentBack txs
  return { sig, time: tx.blockTime ?? null, net, gross: net + fee + txFee, fee, txFee, closed };
}

/** Scan up to `scan` recent signatures (from `before`) and return up to `limit` reclaim items. */
export async function fetchHistory(conn: Connection, owner: PublicKey, feeWallet: PublicKey, opts: { limit?: number; before?: string; scan?: number } = {}): Promise<HistPage> {
  const limit = opts.limit ?? 20, scan = opts.scan ?? 100; const items: HistItem[] = [];
  let before = opts.before, seen = 0;
  while (items.length < limit && seen < scan) {
    const sigs = await conn.getSignaturesForAddress(owner, { before, limit: Math.min(50, scan - seen) }, "confirmed");
    if (!sigs.length) return { items, done: true };
    seen += sigs.length;
    const ok = sigs.filter((s) => !s.err);
    for (let i = 0; i < ok.length && items.length < limit; i += CONC) {
      const chunk = ok.slice(i, i + CONC);
      // one request per tx (no JSON-RPC batch: not all RPC plans allow it), a few in parallel to stay under rate limits
      const txs = await Promise.all(chunk.map((s) => conn.getParsedTransaction(s.signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }).catch(() => null)));
      for (let j = 0; j < chunk.length; j++) {
        const it = toItem(txs[j], chunk[j].signature, owner, feeWallet);
        if (it) { items.push(it); if (items.length >= limit) { return { items, before: chunk[j].signature, done: false }; } }
      }
    }
    before = sigs[sigs.length - 1].signature;
    if (sigs.length < 50 && seen < scan) return { items, done: true };
  }
  return { items, before, done: false };
}
