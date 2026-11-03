/**
 * RentBack 回収テスト (devnet / local validator)
 * Uses the SAME code the site uses: scanChecklist + buildChecklistTxs (lib/checklist.ts),
 * explainError (lib/rentback.ts). Site code is imported, not reimplemented.
 * Run: npm run test:devnet     (PAUSE=0 for no pauses, LOCAL=1 to force local validator)
 */
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createMint, createAccount, createAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { spawn, ChildProcess, execSync } from "child_process";
import fs from "fs"; import path from "path";
import { scanChecklist, buildChecklistTxs, Item } from "../lib/checklist";
import { explainError, calcFee, RbError } from "../lib/rentback";

const C = { r: "\x1b[31m", g: "\x1b[32m", y: "\x1b[33m", b: "\x1b[36m", m: "\x1b[35m", d: "\x1b[2m", B: "\x1b[1m", x: "\x1b[0m" };
const PAUSE = Number(process.env.PAUSE ?? 700);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const step = async (s: string) => { console.log(`  ${C.b}▶${C.x} ${s}`); await sleep(PAUSE); };
const info = (s: string) => console.log(`    ${C.d}${s}${C.x}`);
const sol = (l: number) => (l / LAMPORTS_PER_SOL).toFixed(6) + " SOL";
const FEE = new PublicKey(process.env.FEE_WALLET || "GbXQhLxNVmbt67pS7uY2FHVamMkTZAEokHNJ63zKoZp8");
const KEYS = path.join(__dirname, ".keys"); fs.mkdirSync(KEYS, { recursive: true });
const SOLBIN = path.join(process.env.HOME || "", ".local/share/solana/install/active_release/bin");

function loadKp(name: string) { // secret keys stay on disk only; never printed
  const p = path.join(KEYS, name + ".json");
  if (fs.existsSync(p)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8"))));
  const k = Keypair.generate(); fs.writeFileSync(p, JSON.stringify(Array.from(k.secretKey)), { mode: 0o600 }); return k;
}

let conn!: Connection; let funder!: Keypair; let validator = null as ChildProcess | null; let NET = "devnet";
const results: { n: string; name: string; ok: boolean; note: string }[] = [];

async function setup() {
  funder = loadKp("funder");
  const need = 1.5 * LAMPORTS_PER_SOL;
  if (!process.env.LOCAL) {
    conn = new Connection(process.env.RPC || "https://api.devnet.solana.com", "confirmed");
    console.log(`${C.B}① devnet の資金用ウォレットを準備${C.x}  ${C.d}${funder.publicKey.toBase58()}${C.x}`);
    for (let i = 0; i < 4 && (await conn.getBalance(funder.publicKey).catch(() => 0)) < need; i++) {
      try { const s = await conn.requestAirdrop(funder.publicKey, 2 * LAMPORTS_PER_SOL); await conn.confirmTransaction(s, "confirmed"); }
      catch (e: any) { info(`エアドロップ失敗 (${i + 1}/4): ${String(e.message).slice(0, 70)}`); if (/410|disabled/i.test(e.message)) break; await sleep(3000 * (i + 1)); }
    }
    if ((await conn.getBalance(funder.publicKey).catch(() => 0)) >= need) return;
    console.log(`${C.y}⚠ devnet のエアドロップが制限中。ローカルの練習用チェーン(solana-test-validator)に切り替えます。${C.x}`);
    info(`devnet で回したい時は faucet.solana.com で ${funder.publicKey.toBase58()} に入金して再実行`);
  }
  NET = "local validator";
  try { execSync("pkill -f solana-test-validator", { stdio: "ignore" }); } catch {}
  validator = spawn(path.join(SOLBIN, "solana-test-validator"), ["--reset", "--quiet", "--ledger", path.join(__dirname, ".ledger")], { stdio: "ignore" });
  conn = new Connection("http://127.0.0.1:8899", "confirmed");
  info("ローカルチェーン起動中…");
  for (let i = 0; i < 120; i++) { try { if ((await conn.getSlot()) > 2) break; } catch {} await sleep(1000); }
  await conn.confirmTransaction(await conn.requestAirdrop(funder.publicKey, 100 * LAMPORTS_PER_SOL), "confirmed");
}

async function newWallet(name: string, lamports: number) {
  const k = Keypair.generate(); // fresh each run; saved to .keys for inspection
  fs.writeFileSync(path.join(KEYS, `${name}.json`), JSON.stringify(Array.from(k.secretKey)), { mode: 0o600 });
  if (lamports > 0) await sendAndConfirmTransaction(conn, new Transaction().add(SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: k.publicKey, lamports })), [funder]);
  return k;
}
async function emptyAccounts(owner: PublicKey, n: number, pid = TOKEN_PROGRAM_ID) {
  const mint = await createMint(conn, funder, funder.publicKey, null, 0, undefined, undefined, pid);
  const out: PublicKey[] = [];
  for (let i = 0; i < n; i++) out.push(await createAccount(conn, funder, mint, owner, Keypair.generate(), undefined, pid));
  return { mint, out };
}
const exists = async (ps: PublicKey[]) => (await conn.getMultipleAccountsInfo(ps)).map((a) => a !== null);

/** Mirrors components/EasyMode.tsx: default selection = kind "empty", build, sign all, send each. */
async function claim(owner: Keypair, sel?: Item[]) {
  const items = sel ?? (await scanChecklist(conn, owner.publicKey)).filter((i) => i.kind === "empty");
  const ub = await conn.getBalance(owner.publicKey); const fb = await conn.getBalance(FEE);
  const { txs } = await buildChecklistTxs(conn, owner.publicKey, FEE, items);
  let net = 0, rec = 0, fee = 0;
  for (const t of txs) {
    t.tx.sign(owner); const sig = await conn.sendRawTransaction(t.tx.serialize());
    await conn.confirmTransaction(sig, "confirmed");
    const tr = await conn.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    net += tr?.meta?.fee ?? 0; rec += t.reclaimed; fee += t.fee;
    info(`tx: ${t.count}口座を閉じる / 回収 ${sol(t.reclaimed)} / 手数料3% ${sol(t.fee)}  ${sig.slice(0, 20)}…`);
  }
  const userDelta = (await conn.getBalance(owner.publicKey)) - ub; const feeDelta = (await conn.getBalance(FEE)) - fb;
  return { items, txs, rec, fee, net, userDelta, feeDelta };
}

async function run(n: string, name: string, fn: () => Promise<string>) {
  console.log(`\n${C.B}${C.m}━━ テスト${n}: ${name} ━━${C.x}`); await sleep(PAUSE);
  try { const note = await fn(); results.push({ n, name, ok: true, note }); console.log(`  ${C.g}${C.B}✅ PASS${C.x} ${note}`); }
  catch (e: any) { results.push({ n, name, ok: false, note: String(e.message).slice(0, 160) }); console.log(`  ${C.r}${C.B}❌ FAIL${C.x} ${e.message}`); }
  await sleep(PAUSE);
}
function must(c: any, msg: string) { if (!c) throw new Error(msg); }
function checkMoney(r: Awaited<ReturnType<typeof claim>>) {
  info(`回収 ${sol(r.rec)} → ユーザー +${sol(r.userDelta)} (ネットワーク手数料 ${sol(r.net)}) / 手数料ウォレット +${sol(r.feeDelta)}`);
  must(r.fee === calcFee(r.rec), `手数料が3%と一致しない: ${r.fee} vs ${calcFee(r.rec)}`);
  must(r.feeDelta === r.fee, `手数料ウォレットの増加 ${r.feeDelta} ≠ ${r.fee}`);
  must(r.userDelta === r.rec - r.fee - r.net, `ユーザーの増加 ${r.userDelta} ≠ 回収-3%-ネット手数料 ${r.rec - r.fee - r.net}`);
}

(async () => {
  const t0 = Date.now();
  console.log(`${C.B}${C.b}\n🧪 RentBack 回収テスト（本物のお金は使いません）${C.x}\n`);
  await setup();
  console.log(`${C.g}接続先: ${NET}${C.x}  手数料ウォレット: ${FEE.toBase58()}`);
  if ((await conn.getBalance(FEE)) < 1_000_000) { // unfunded fee wallet → site waives small fees; pre-fund so 3% path is exercised
    await sendAndConfirmTransaction(conn, new Transaction().add(SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: FEE, lamports: 1_000_000 })), [funder]);
    info("手数料ウォレットに 0.001 SOL 入金（テスト用チェーン上のみ）");
  }

  await run("1", "空の口座 0個", async () => {
    const w = await newWallet("case1", 0.01 * LAMPORTS_PER_SOL);
    await step("スキャン中…"); const it = await scanChecklist(conn, w.publicKey);
    must(it.length === 0, `何も無いはずが ${it.length} 件見つかった`);
    return "何も見つからず、取引も作られない（サイトはボタンを押しても何もしない）";
  });

  await run("2", "空のSPL口座 1個", async () => {
    const w = await newWallet("case2", 0.01 * LAMPORTS_PER_SOL);
    await step("空の口座を1個つくる"); await emptyAccounts(w.publicKey, 1);
    await step("スキャン → 取引を作成 → 署名 → 送信"); const r = await claim(w);
    must(r.items.length === 1 && r.txs.length === 1, "1件/1取引のはず"); checkMoney(r);
    must((await scanChecklist(conn, w.publicKey)).length === 0, "閉じた後も口座が残っている");
    return `ユーザーに ${sol(r.rec - r.fee)}、手数料ウォレットにちょうど3% (${sol(r.fee)})`;
  });

  await run("3", "空の口座 26個（まとめて処理）", async () => {
    const w = await newWallet("case3", 0.01 * LAMPORTS_PER_SOL);
    await step("空の口座を26個つくる（少し時間がかかります）"); const { out } = await emptyAccounts(w.publicKey, 26);
    await step("回収"); const r = await claim(w);
    must(r.txs.length === 2, `26個なら2回の取引に分かれるはず: ${r.txs.length}`); checkMoney(r);
    must((await exists(out)).every((e) => !e), "閉じ残しあり");
    return `${r.txs.length}回の取引に分けて26個すべて閉じた。手数料合計 ${sol(r.fee)} = 3%`;
  });

  await run("4", "Token-2022 の空口座（拡張つき含む）", async () => {
    const w = await newWallet("case4", 0.01 * LAMPORTS_PER_SOL);
    await step("Token-2022 の口座を2個 + ImmutableOwner拡張つきATAを1個つくる");
    const { mint, out } = await emptyAccounts(w.publicKey, 2, TOKEN_2022_PROGRAM_ID);
    const ata = await createAssociatedTokenAccount(conn, funder, mint, w.publicKey, undefined, TOKEN_2022_PROGRAM_ID);
    const r = await claim(w);
    must(r.items.length === 3 && r.items.every((i) => i.programId.equals(TOKEN_2022_PROGRAM_ID)), "Token-2022 3件のはず"); checkMoney(r);
    must((await exists([...out, ata])).every((e) => !e), "閉じ残しあり");
    return "Token-2022 3個（拡張つき含む）を閉じ、3%も正しい";
  });

  await run("5", "残高ありのコイン・NFT は閉じない", async () => {
    const w = await newWallet("case5", 0.01 * LAMPORTS_PER_SOL);
    await step("残高ありコイン、NFT、空口座をそれぞれ1個つくる");
    const coin = await createMint(conn, funder, funder.publicKey, null, 6);
    const coinAcc = await createAccount(conn, funder, coin, w.publicKey, Keypair.generate()); await mintTo(conn, funder, coin, coinAcc, funder, 1_000_000);
    const nft = await createMint(conn, funder, funder.publicKey, null, 0);
    const nftAcc = await createAccount(conn, funder, nft, w.publicKey, Keypair.generate()); await mintTo(conn, funder, nft, nftAcc, funder, 1);
    const { out } = await emptyAccounts(w.publicKey, 1);
    const all = await scanChecklist(conn, w.publicKey);
    info(`スキャン結果: ${all.map((i) => i.kind).join(", ")}`);
    must(!all.some((i) => i.pubkey.equals(nftAcc)), "NFT がリストに出ている");
    const r = await claim(w);
    must(r.items.length === 1 && r.items[0].pubkey.equals(out[0]), "空口座だけが選ばれるはず");
    const [c, n, e] = await exists([coinAcc, nftAcc, out[0]]);
    must(c && n && !e, "コイン/NFTが閉じられた、または空口座が残った");
    must((await conn.getTokenAccountBalance(coinAcc)).value.amount === "1000000", "コインの残高が変わった");
    return "空口座だけ閉じ、コインとNFTはそのまま（NFTは一覧にも出ない）";
  });

  await run("6a", "SOLほぼゼロのウォレット (最小額 + 手数料分)", async () => {
    const rentMin = await conn.getMinimumBalanceForRentExemption(0);
    const w = await newWallet("case6a", rentMin + 20_000); // a system wallet cannot hold less than rentMin (except 0)
    await emptyAccounts(w.publicKey, 1);
    await step("ネットワーク手数料ぎりぎりで回収"); const r = await claim(w); checkMoney(r);
    return `ほぼゼロでも回収できた（残高 ${sol(await conn.getBalance(w.publicKey))}）`;
  });

  await run("6a2", "ちょうど最小額 0.00089088 SOL のウォレット", async () => {
    const w = await newWallet("case6a2", await conn.getMinimumBalanceForRentExemption(0));
    const { out } = await emptyAccounts(w.publicKey, 1);
    const ub = await conn.getBalance(w.publicKey);
    try { await claim(w); throw new Error("エラーになるはずが送信された"); }
    catch (e: any) {
      must(e instanceof RbError, `送信前に止まらなかった: ${String(e.message).split("\n")[0]}`);
      const x = explainError(e); info(`サイトの表示キー: ${x.key} / ${x.details}`);
      must(x.key === "errLowSol", `表示が errLowSol でない: ${x.key}`);
    }
    must((await exists(out))[0] && (await conn.getBalance(w.publicKey)) === ub, "口座かSOLが動いた");
    return "送信前に「SOLが足りない」案内で止まり、口座もSOLもそのまま";
  });

  await run("6b", "SOLが完全にゼロのウォレット", async () => {
    const w = await newWallet("case6b", 0);
    const { out } = await emptyAccounts(w.publicKey, 1);
    try { await claim(w); throw new Error("エラーになるはずが成功した"); }
    catch (e: any) {
      if (!(e instanceof RbError) && !/insufficient|debit/i.test(e.message)) throw e;
      const x = explainError(e); info(`サイトの表示キー: ${x.key} / ${x.details.split("\n")[0]}`);
      must(x.key === "errLowSol", `表示が errLowSol でない: ${x.key}`);
    }
    must((await exists(out))[0], "口座が消えている");
    return "送信前に「SOLが足りない」案内で止まり、何も壊れない";
  });

  await run("7", "承認キャンセル / 失敗した取引", async () => {
    const w = await newWallet("case7", 0.01 * LAMPORTS_PER_SOL);
    const { mint, out } = await emptyAccounts(w.publicKey, 3);
    // (a) user rejects: tx built but never signed
    await step("(a) 取引を作ってキャンセル（署名しない）");
    const items = (await scanChecklist(conn, w.publicKey)).filter((i) => i.kind === "empty");
    await buildChecklistTxs(conn, w.publicKey, FEE, items);
    const rej = explainError(Object.assign(new Error("User rejected the request."), { name: "WalletSignTransactionError" }));
    must(rej.key === "errRejected", `キャンセル表示が違う: ${rej.key}`);
    must((await exists(out)).every(Boolean), "キャンセルしたのに口座が消えた");
    info("キャンセル → 「キャンセルされました」表示、口座はそのまま");
    // (b) failed tx: one account gets a token after building
    await step("(b) 作成後に1口座へコインが入り、取引が失敗するケース");
    const ub = await conn.getBalance(w.publicKey), fb = await conn.getBalance(FEE);
    const { txs } = await buildChecklistTxs(conn, w.publicKey, FEE, items);
    // re-make mint with authority so we can mint into out[0]
    void mint;
    const m2 = await createMint(conn, funder, funder.publicKey, null, 0);
    const extra = await createAccount(conn, funder, m2, w.publicKey, Keypair.generate());
    const { txs: t2 } = await buildChecklistTxs(conn, w.publicKey, FEE, [...items, ...(await scanChecklist(conn, w.publicKey)).filter((i) => i.pubkey.equals(extra))]);
    await mintTo(conn, funder, m2, extra, funder, 5); // now non-empty → close must fail
    let err: any = null;
    try { t2[0].tx.sign(w); await conn.sendRawTransaction(t2[0].tx.serialize()); } catch (e) { err = e; }
    must(err, "失敗するはずが成功した");
    const x = explainError(err); info(`サイトの表示キー: ${x.key}`);
    must(x.key === "errNotEmpty", `表示キーが違う: ${x.key}`);
    must((await exists([...out, extra])).every(Boolean), "失敗したのに一部の口座が閉じた");
    must((await conn.getBalance(FEE)) === fb && (await conn.getBalance(w.publicKey)) === ub, "失敗したのにSOLが動いた");
    void txs;
    await step("(c) もう一度スキャンして回収 → 正常に戻るか");
    const r = await claim(w); checkMoney(r);
    must(r.items.length === 3 && (await exists([extra]))[0], "やり直しで空3個だけ閉じるはず");
    return "キャンセル・失敗ではSOLも口座も動かず、やり直しで正常に回収できた";
  });

  const sec = Math.round((Date.now() - t0) / 1000);
  console.log(`\n${C.B}━━━━━━━━ 結果まとめ (${NET}, ${sec}秒) ━━━━━━━━${C.x}`);
  for (const r of results) console.log(`${r.ok ? C.g + "✅ PASS" : C.r + "❌ FAIL"}${C.x}  ${r.n.padEnd(3)} ${r.name}\n          ${C.d}${r.note}${C.x}`);
  const ng = results.filter((r) => !r.ok).length;
  console.log(`\n${ng ? C.r : C.g}${C.B}${results.length - ng}/${results.length} PASS${C.x}\n`);
  validator?.kill(); process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(C.r + "テスト実行エラー: " + e.message + C.x); validator?.kill(); process.exit(1); });
