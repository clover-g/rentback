import { Connection, PublicKey } from "@solana/web3.js";
const conn = new Connection(process.env.NEXT_PUBLIC_RPC_URL!, { commitment: "confirmed", httpHeaders: { Origin: "https://rentbacksol.app" } });
const FW = "GbXQhLxNVmbt67pS7uY2FHVamMkTZAEokHNJ63zKoZp8";
(async () => { let before: string | undefined; const sigs: any[] = [];
  for (;;) { const s = await conn.getSignaturesForAddress(new PublicKey(FW), { before, limit: 1000 }); sigs.push(...s); if (s.length < 1000) break; before = s[s.length - 1].signature; }
  let n = 0, closed = 0, fee = 0, gross = 0, net = 0; const users = new Set<string>();
  for (const s of sigs) { if (s.err) continue; const tx = await conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 }); if (!tx?.meta) continue;
    const ixs = [...tx.transaction.message.instructions, ...(tx.meta.innerInstructions || []).flatMap((x) => x.instructions)] as any[];
    const tr = ixs.filter((i) => i.program === "system" && i.parsed?.type === "transfer" && i.parsed.info?.destination === FW);
    const c = ixs.filter((i) => i.program === "spl-token" && i.parsed?.type === "closeAccount").length;
    if (!tr.length || !c) continue; const u = tr[0].parsed.info.source; const f = tr.reduce((a, i) => a + Number(i.parsed.info.lamports), 0);
    const idx = tx.transaction.message.accountKeys.findIndex((k) => k.pubkey.toBase58() === u); const d = tx.meta.postBalances[idx] - tx.meta.preBalances[idx];
    n++; closed += c; fee += f; net += d; gross += d + f + (idx === 0 ? tx.meta.fee : 0); users.add(u); }
  console.log({ sigsScanned: sigs.length, reclaims: n, users: users.size, closed, feeSOL: fee / 1e9, grossSOL: gross / 1e9, netToUsersSOL: net / 1e9 }); })();
