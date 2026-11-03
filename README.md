# RentBack

**Reclaim the SOL locked in your empty Solana token accounts.** Live at **https://rentbacksol.app**

Every time you receive a token, Solana creates a token account and locks ~0.002 SOL of rent in it. After you sell or send the token away, the empty account keeps that SOL until it is closed. RentBack finds those empty accounts and closes them so the SOL comes back to your wallet.

## How it works

1. Connect your wallet (Phantom, Solflare, etc.).
2. RentBack reads your token accounts via RPC and lists only the ones with a **zero balance**.
3. It builds a transaction containing only SPL Token **`CloseAccount`** instructions for those empty accounts (rent destination = your wallet), plus one SOL transfer for the service fee.
4. **You review and sign it in your own wallet.** Nothing happens without your signature.

- **Fee:** 3% of the reclaimed SOL, sent to `GbXQhLxNVmbt67pS7uY2FHVamMkTZAEokHNJ63zKoZp8`. The transfer is visible as a separate line in the transaction your wallet shows you.
- **Pro mode (optional):** you can also choose unwanted tokens to burn (SPL `BurnChecked` + `CloseAccount`). Nothing is pre-selected, and burning is irreversible, so a confirmation step is shown first. Easy mode only closes empty accounts.
- **No custom on-chain program.** RentBack only calls the official SPL Token program.

## Safety

- RentBack **never asks for your private key or seed phrase.** Anyone who does is a scam.
- Non-custodial: funds go straight from the closed account to your wallet.
- Accounts holding any tokens are never closed.
- Always check the transaction preview in your wallet before signing.
- Reclaim history is built from public on-chain data only; no user database.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your own RPC URL etc.
npm run dev                  # http://localhost:3100
```

Deploy (Cloudflare Workers): `npm run deploy`. Worker secrets (`ADMIN_PASSWORD`, `ADMIN_RPC_URL`) are set with `npx wrangler secret put` and are never committed.

## License

[MIT](LICENSE) © 2026 RentBack

---

## 日本語

RentBackは、Solanaウォレット内の**空になったトークン口座**を閉じて、預けられたままのSOL（1口座あたり約0.002 SOL）を取り戻すツールです。

- かんたんモードはSPL公式の `CloseAccount` 命令だけを使い、残高ゼロの口座しか閉じません。
- プロモードでは、不要なトークンを自分で選んで焼却（`BurnChecked`）することもできます。焼却は取り消せません。
- 取引はご自身のウォレットで内容を確認して署名します。
- **秘密鍵・シードフレーズは一切不要です。** 求められたら詐欺です。
- 手数料は回収額の3%で、取引内に送金先 `GbXQhLxNVmbt67pS7uY2FHVamMkTZAEokHNJ63zKoZp8` として表示されます。
