import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, createBurnCheckedInstruction, createCloseAccountInstruction } from "@solana/spl-token";
import { calcFee, feeGuard } from "./rentback";

export type BurnAcc = { pubkey: PublicKey; lamports: number; programId: PublicKey; mint: string; amount: string; decimals: number; ui: string };
export const BURN_BATCH = 8;

/** Non-empty fungible token accounts that can be burned+closed. Excludes NFTs (decimals 0 & supply 1) and frozen accounts. */
export async function listBurnable(conn: Connection, owner: PublicKey): Promise<BurnAcc[]> {
  const cands: BurnAcc[] = [];
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const res = await conn.getParsedTokenAccountsByOwner(owner, { programId }, "confirmed");
    for (const { pubkey, account } of res.value) {
      const i: any = (account.data as any).parsed?.info;
      if (!i || i.tokenAmount.amount === "0" || i.state === "frozen") continue;
      const ext = (i.extensions || []) as any[];
      if (ext.some((e) => e.extension === "transferFeeAmount" && Number(e.state?.withheldAmount) > 0)) continue;
      if (i.closeAuthority && i.closeAuthority !== owner.toBase58()) continue;
      cands.push({ pubkey, lamports: account.lamports, programId, mint: i.mint, amount: i.tokenAmount.amount,
        decimals: i.tokenAmount.decimals, ui: i.tokenAmount.uiAmountString });
    }
  }
  const mints = [...new Set(cands.filter((c) => c.decimals === 0).map((c) => c.mint))];
  const nft = new Set<string>();
  for (let k = 0; k < mints.length; k += 100) {
    const infos = await conn.getMultipleParsedAccounts(mints.slice(k, k + 100).map((m) => new PublicKey(m)));
    infos.value.forEach((a, j) => { const s = (a?.data as any)?.parsed?.info?.supply; if (s === "1") nft.add(mints[k + j]); });
  }
  return cands.filter((c) => !nft.has(c.mint));
}

export async function buildBurnTxs(conn: Connection, owner: PublicKey, feeWallet: PublicKey, accs: BurnAcc[], batch = BURN_BATCH) {
  const guard = await feeGuard(conn, feeWallet);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const txs: { tx: Transaction; reclaimed: number; fee: number; count: number }[] = [];
  for (let k = 0; k < accs.length; k += batch) {
    const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight });
    let got = 0; const part = accs.slice(k, k + batch);
    for (const a of part) {
      const mint = new PublicKey(a.mint);
      tx.add(createBurnCheckedInstruction(a.pubkey, mint, owner, BigInt(a.amount), a.decimals, [], a.programId));
      tx.add(createCloseAccountInstruction(a.pubkey, owner, owner, [], a.programId));
      got += a.lamports;
    }
    const fee = guard(calcFee(got));
    if (fee > 0) tx.add(SystemProgram.transfer({ fromPubkey: owner, toPubkey: feeWallet, lamports: fee }));
    txs.push({ tx, reclaimed: got, fee, count: part.length });
  }
  return { txs, blockhash, lastValidBlockHeight };
}
