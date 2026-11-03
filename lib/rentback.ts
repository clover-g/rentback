import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, createCloseAccountInstruction } from "@solana/spl-token";

export const FEE_BPS = 300; // 3%
export const BATCH = 20;
export type EmptyAcc = { pubkey: PublicKey; lamports: number; programId: PublicKey; mint: string };

export async function listEmpty(conn: Connection, owner: PublicKey): Promise<EmptyAcc[]> {
  const out: EmptyAcc[] = [];
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const res = await conn.getParsedTokenAccountsByOwner(owner, { programId }, "confirmed");
    for (const { pubkey, account } of res.value) {
      const i: any = (account.data as any).parsed?.info;
      if (!i) continue;
      const ext = (i.extensions || []) as any[];
      // Token-2022: withheld transfer fees block closing
      const withheld = ext.some((e) => e.extension === "transferFeeAmount" && Number(e.state?.withheldAmount) > 0);
      if (i.tokenAmount.amount === "0" && i.state !== "frozen" && !withheld &&
          (!i.closeAuthority || i.closeAuthority === owner.toBase58()))
        out.push({ pubkey, lamports: account.lamports, programId, mint: i.mint });
    }
  }
  return out;
}

export function calcFee(lamports: number) { return Math.floor((lamports * FEE_BPS) / 10_000); }

/** Fee-recipient rent guard shared by all builders: returns the fee to actually charge (0 = waived). */
export async function feeGuard(conn: Connection, feeWallet: PublicKey) {
  const [rentMin, bal] = await Promise.all([conn.getMinimumBalanceForRentExemption(0, "confirmed"), conn.getBalance(feeWallet, "confirmed")]);
  let cur = bal;
  return (fee: number) => { if (fee <= 0 || cur + fee < rentMin) return 0; cur += fee; return fee; };
}

export const TX_FEE_RESERVE = 20_000; // base fee + typical wallet-added priority fee, per tx

export class RbError extends Error { constructor(public code: "LOW_SOL" | "OWNER_RENT", msg: string) { super(msg); } }

/**
 * Builds close txs. Instruction order: all closes first (credit the owner), then the fee transfer.
 * Safety:
 *  - fee recipient: a SystemProgram transfer to an account must leave it at 0 or >= rent-exempt minimum.
 *    If the fee wallet is unfunded and the fee is below that minimum, the fee is waived for that tx
 *    (otherwise the whole tx fails with "insufficient funds for rent").
 *  - owner: must be able to pay network fees up front and end >= rent-exempt minimum.
 */
export async function buildTxs(conn: Connection, owner: PublicKey, feeWallet: PublicKey, accs: EmptyAcc[], batch = BATCH) {
  const [{ blockhash, lastValidBlockHeight }, rentMin, infos] = await Promise.all([
    conn.getLatestBlockhash("confirmed"),
    conn.getMinimumBalanceForRentExemption(0, "confirmed"),
    conn.getMultipleAccountsInfo([owner, feeWallet], "confirmed"),
  ]);
  let ownerBal = infos[0]?.lamports ?? 0; let feeBal = infos[1]?.lamports ?? 0;
  const nTx = Math.ceil(accs.length / batch);
  // Fee payer is charged up front and must stay rent-exempt after the fee (reclaimed rent in the same tx doesn't count).
  // Later txs are funded by rent reclaimed in earlier ones, so: rent-exempt min + one tx's fees, and at least the fee reserve per tx.
  const needSol = Math.max(TX_FEE_RESERVE * Math.max(1, nTx), rentMin + TX_FEE_RESERVE);
  if (ownerBal < needSol) throw new RbError("LOW_SOL", `owner balance ${ownerBal} < ${needSol} lamports needed (rent-exempt minimum + network fees)`);
  const txs: { tx: Transaction; reclaimed: number; fee: number }[] = [];
  for (let k = 0; k < accs.length; k += batch) {
    const tx = new Transaction({ feePayer: owner, blockhash, lastValidBlockHeight });
    let got = 0;
    for (const a of accs.slice(k, k + batch)) {
      tx.add(createCloseAccountInstruction(a.pubkey, owner, owner, [], a.programId));
      got += a.lamports;
    }
    let fee = calcFee(got);
    if (fee > 0 && feeBal + fee < rentMin) fee = 0; // recipient would be left below rent-exempt → waive
    if (fee > 0 && !feeWallet.equals(owner)) { tx.add(SystemProgram.transfer({ fromPubkey: owner, toPubkey: feeWallet, lamports: fee })); feeBal += fee; }
    else fee = 0;
    ownerBal += got - fee - 5000;
    if (ownerBal < rentMin) throw new RbError("OWNER_RENT", `owner would end at ${ownerBal} < rent-exempt ${rentMin}`);
    txs.push({ tx, reclaimed: got, fee });
  }
  return { txs, blockhash, lastValidBlockHeight };
}

/** Map any send/simulate error to a friendly i18n key + raw details (logs). */
export function explainError(e: any): { key: string; details: string } {
  const logs: string[] = e?.logs || e?.transactionLogs || e?.cause?.logs || [];
  const raw = [e?.message || String(e), ...logs].join("\n");
  const m = raw.toLowerCase();
  let key = "errGeneric";
  if (e instanceof RbError) key = e.code === "LOW_SOL" ? "errLowSol" : "errRent";
  else if (/user rejected|rejected the request|declined/.test(m)) key = "errRejected";
  else if (/insufficient funds for rent/.test(m)) key = "errRent";
  else if (/insufficient (funds|lamports)|attempt to debit an account but found no record/.test(m)) key = "errLowSol";
  else if (/blockhash not found|block height exceeded|expired/.test(m)) key = "errExpired";
  else if (/non-native account can only be closed if its balance is zero|0x11/.test(m)) key = "errNotEmpty";
  else if (/failed to fetch|network|429|403|timeout/.test(m)) key = "errNetwork";
  return { key, details: raw };
}

export const solscan = (sig: string, cluster = "devnet") =>
  `https://solscan.io/tx/${sig}${cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`}`;
