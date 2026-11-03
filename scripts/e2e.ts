import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { createMint, createAccount, mintTo, freezeAccount, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { listBurnable, buildBurnTxs } from "../lib/burn";
import fs from "fs";
import { listEmpty, buildTxs } from "../lib/rentback";
const conn = new Connection(process.env.RPC || "https://api.devnet.solana.com", "confirmed"); // RPC=http://127.0.0.1:8899 for local validator
const FEE = new PublicKey(JSON.parse(fs.readFileSync("fee-wallet-test.json", "utf8")).publicKey);
const kpPath = "scripts/test-user.json";
const user = fs.existsSync(kpPath) ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(kpPath, "utf8")))) : Keypair.generate();
fs.writeFileSync(kpPath, JSON.stringify(Array.from(user.secretKey)));
async function fund() {
  if ((await conn.getBalance(user.publicKey)) >= 0.3 * LAMPORTS_PER_SOL) return;
  for (let i = 0; i < 6; i++) {
    try { const s = await conn.requestAirdrop(user.publicKey, 1 * LAMPORTS_PER_SOL); await conn.confirmTransaction(s); return; }
    catch (e: any) { console.log("airdrop retry", i, e.message?.slice(0, 80)); await new Promise((r) => setTimeout(r, 4000 * (i + 1))); }
  }
  throw new Error("airdrop failed; fund " + user.publicKey.toBase58() + " via faucet.solana.com");
}
(async () => {
  console.log("user", user.publicKey.toBase58(), "fee", FEE.toBase58());
  await fund();
  // ensure fee wallet is rent-exempt so small transfers succeed
  if ((await conn.getBalance(FEE)) === 0)
    await sendAndConfirmTransaction(conn, new Transaction().add(SystemProgram.transfer({ fromPubkey: user.publicKey, toPubkey: FEE, lamports: 1_000_000 })), [user]);
  for (const pid of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const mint = await createMint(conn, user, user.publicKey, null, 0, undefined, undefined, pid);
    for (let i = 0; i < 3; i++) await createAccount(conn, user, mint, user.publicKey, Keypair.generate(), undefined, pid);
  }
  const accs = await listEmpty(conn, user.publicKey);
  console.log("empty accounts", accs.length);
  const feeBefore = await conn.getBalance(FEE);
  const { txs } = await buildTxs(conn, user.publicKey, FEE, accs);
  let rec = 0, fee = 0;
  for (const t of txs) {
    t.tx.sign(user);
    const sig = await conn.sendRawTransaction(t.tx.serialize());
    await conn.confirmTransaction(sig, "confirmed");
    console.log("tx https://solscan.io/tx/" + sig + "?cluster=devnet");
    rec += t.reclaimed; fee += t.fee;
  }
  const feeAfter = await conn.getBalance(FEE);
  const left = await listEmpty(conn, user.publicKey);
  const closed = (await conn.getMultipleAccountsInfo(accs.map((a) => a.pubkey))).every((x) => x === null);
  console.log({ reclaimed: rec, fee, net: rec - fee, feeReceived: feeAfter - feeBefore, expected: Math.floor(rec * 0.03), allClosed: closed, remaining: left.length });
  if (!closed || feeAfter - feeBefore !== fee || fee !== Math.floor(rec * 300 / 10000)) { console.log("FAIL"); process.exit(1); }
  console.log("close-empty PASS");

  // ---- token burn + close path ----
  const burnMints: string[] = []; let frozenAcc: PublicKey | null = null, nftAcc: PublicKey | null = null;
  for (const pid of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const mint = await createMint(conn, user, user.publicKey, user.publicKey, 6, undefined, undefined, pid);
    burnMints.push(mint.toBase58());
    for (let i = 0; i < 2; i++) {
      const a = await createAccount(conn, user, mint, user.publicKey, Keypair.generate(), undefined, pid);
      await mintTo(conn, user, mint, a, user, 1_234_567 * (i + 1), [], undefined, pid);
    }
    if (pid === TOKEN_PROGRAM_ID) { // frozen account must be skipped
      frozenAcc = await createAccount(conn, user, mint, user.publicKey, Keypair.generate(), undefined, pid);
      await mintTo(conn, user, mint, frozenAcc, user, 5, [], undefined, pid);
      await freezeAccount(conn, user, frozenAcc, mint, user, [], undefined, pid);
    }
  }
  const nftMint = await createMint(conn, user, user.publicKey, null, 0); // NFT-like: decimals 0, supply 1 → excluded
  nftAcc = await createAccount(conn, user, nftMint, user.publicKey, Keypair.generate());
  await mintTo(conn, user, nftMint, nftAcc, user, 1);
  const burnable = await listBurnable(conn, user.publicKey);
  const excludedOk = !burnable.some((b) => b.pubkey.equals(frozenAcc!) || b.pubkey.equals(nftAcc!));
  const sel = burnable.filter((b) => burnMints.includes(b.mint));
  console.log("burnable", burnable.length, "selected", sel.length, "frozen/NFT excluded", excludedOk);
  const fb = await conn.getBalance(FEE);
  const bt = await buildBurnTxs(conn, user.publicKey, FEE, sel);
  let brec = 0, bfee = 0;
  for (const t of bt.txs) {
    t.tx.sign(user); const sig = await conn.sendRawTransaction(t.tx.serialize()); await conn.confirmTransaction(sig, "confirmed");
    console.log("burn tx", sig); brec += t.reclaimed; bfee += t.fee;
  }
  const fa = await conn.getBalance(FEE);
  const bclosed = (await conn.getMultipleAccountsInfo(sel.map((a) => a.pubkey))).every((x) => x === null);
  const frozenStill = (await conn.getAccountInfo(frozenAcc!)) !== null;
  console.log({ burnReclaimed: brec, burnFee: bfee, feeReceived: fa - fb, expected: Math.floor(brec * 300 / 10000), pct: ((fa - fb) / brec * 100).toFixed(4) + "%", allClosed: bclosed, frozenUntouched: frozenStill });
  if (sel.length !== 4 || !excludedOk || !bclosed || !frozenStill || fa - fb !== bfee || bfee !== Math.floor(brec * 300 / 10000)) { console.log("BURN FAIL"); process.exit(1); }
  console.log("PASS");
})();
