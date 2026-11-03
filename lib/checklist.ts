import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { createBurnCheckedInstruction, createCloseAccountInstruction } from "@solana/spl-token";
import { listEmpty, calcFee, RbError, TX_FEE_RESERVE } from "./rentback";
import { listBurnable } from "./burn";
import { fetchUsdPrices } from "./price";
import { RPC_URL } from "./config";

export type Kind = "empty" | "dust" | "valued";
export type Item = { pubkey: PublicKey; lamports: number; programId: PublicKey; mint: string; amount: string; decimals: number; ui: string;
  kind: Kind; usd: number | null; symbol?: string; image?: string };
export const DUST_USD = 0.01;

/** Token symbol/icon via Helius DAS getAssetBatch (same RPC). Failure → {} (UI shows short mint). */
export async function fetchMeta(mints: string[]): Promise<Record<string, { symbol?: string; image?: string }>> {
  const out: Record<string, { symbol?: string; image?: string }> = {};
  for (let k = 0; k < mints.length; k += 100) {
    try {
      const r = await fetch(RPC_URL, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "m", method: "getAssetBatch", params: { ids: mints.slice(k, k + 100) } }) });
      const j = await r.json();
      for (const a of j?.result || []) if (a?.id) out[a.id] = { symbol: a.content?.metadata?.symbol || a.token_info?.symbol || undefined,
        image: a.content?.links?.image || a.content?.files?.[0]?.cdn_uri || undefined };
    } catch { /* no DAS */ }
  }
  return out;
}

export async function scanChecklist(conn: Connection, owner: PublicKey): Promise<Item[]> {
  const [empty, burn] = await Promise.all([listEmpty(conn, owner), listBurnable(conn, owner)]); // burnable excludes NFTs & frozen
  const mints = [...new Set([...empty, ...burn].map((a) => a.mint))];
  const [prices, meta] = await Promise.all([fetchUsdPrices([...new Set(burn.map((b) => b.mint))]), fetchMeta(mints)]);
  const items: Item[] = empty.map((a) => ({ ...a, amount: "0", decimals: 0, ui: "0", kind: "empty" as Kind, usd: null, ...meta[a.mint] }));
  for (const b of burn) {
    const p = prices[b.mint]; const usd = p == null ? null : p * Number(b.ui);
    items.push({ ...b, kind: usd != null && usd >= DUST_USD ? "valued" : "dust", usd, ...meta[b.mint] });
  }
  return items;
}

const W_LIMIT = 20; // empty close = 1, burn+close = 2.5 (keeps tx < 1232 bytes)
const weight = (i: Item) => (i.amount === "0" ? 1 : 2.5);

/** Close empties / burn+close non-empty. Closes credit owner first, fee transfer last; same fee & rent guards as buildTxs. */
export async function buildChecklistTxs(conn: Connection, owner: PublicKey, feeWallet: PublicKey, sel: Item[]) {
  const [{ blockhash, lastValidBlockHeight }, rentMin, infos] = await Promise.all([
    conn.getLatestBlockhash("confirmed"), conn.getMinimumBalanceForRentExemption(0, "confirmed"), conn.getMultipleAccountsInfo([owner, feeWallet], "confirmed")]);
  let ownerBal = infos[0]?.lamports ?? 0; let feeBal = infos[1]?.lamports ?? 0;
  const groups: Item[][] = []; let cur: Item[] = []; let w = 0;
  for (const i of sel) { if (w + weight(i) > W_LIMIT && cur.length) { groups.push(cur); cur = []; w = 0; } cur.push(i); w += weight(i); }
  if (cur.length) groups.push(cur);
  // Fee payer is charged up front and must stay rent-exempt after the fee (reclaimed rent in the same tx doesn't count).
  // Later txs are funded by rent reclaimed in earlier ones, so: rent-exempt min + one tx's fees, and at least the fee reserve per tx.
  const needSol = Math.max(TX_FEE_RESERVE * Math.max(1, groups.length), rentMin + TX_FEE_RESERVE);
  if (ownerBal < needSol) throw new RbError("LOW_SOL", `owner balance ${ownerBal} < ${needSol} lamports needed (rent-exempt minimum + network fees)`);
  const txs: { tx: Transaction; reclaimed: number; fee: number; count: number }[] = [];
  for (const g of groups) {
    const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight }); let got = 0;
    for (const a of g) {
      if (a.amount !== "0") tx.add(createBurnCheckedInstruction(a.pubkey, new PublicKey(a.mint), owner, BigInt(a.amount), a.decimals, [], a.programId));
      tx.add(createCloseAccountInstruction(a.pubkey, owner, owner, [], a.programId)); got += a.lamports;
    }
    let fee = calcFee(got);
    if (fee > 0 && feeBal + fee < rentMin) fee = 0;
    if (fee > 0 && !feeWallet.equals(owner)) { tx.add(SystemProgram.transfer({ fromPubkey: owner, toPubkey: feeWallet, lamports: fee })); feeBal += fee; } else fee = 0;
    ownerBal += got - fee - 5000;
    if (ownerBal < rentMin) throw new RbError("OWNER_RENT", `owner would end at ${ownerBal} < rent-exempt ${rentMin}`);
    txs.push({ tx, reclaimed: got, fee, count: g.length });
  }
  return { txs, blockhash, lastValidBlockHeight };
}
