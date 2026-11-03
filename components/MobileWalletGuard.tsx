"use client";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useI18n } from "@/lib/i18n";

export function isMobileNoProvider() {
  if (typeof window === "undefined") return false;
  const w = window as any;
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const injected = !!(w.phantom?.solana || w.solana || w.solflare);
  return mobile && !injected;
}
export function openInWallet(kind: "phantom" | "solflare") {
  const u = encodeURIComponent(location.href), r = encodeURIComponent(location.origin);
  location.href = kind === "phantom" ? `https://phantom.app/ul/browse/${u}?ref=${r}` : `https://solflare.com/ul/v1/browse/${u}?ref=${r}`;
}

export default function MobileWalletGuard() {
  const { wallet, select, connected } = useWallet();
  const { lang } = useI18n() as any;
  const [show, setShow] = useState(false);
  const ja = lang !== "en";
  useEffect(() => {
    if (!wallet || connected || !isMobileNoProvider()) return;
    const n = wallet.adapter.name.toLowerCase();
    select(null);
    if (n.includes("phantom")) openInWallet("phantom");
    else if (n.includes("solflare")) openInWallet("solflare");
    else setShow(true);
  }, [wallet, connected, select]);
  useEffect(() => {
    const h = () => { if (isMobileNoProvider()) setShow(true); };
    window.addEventListener("rb-wallet-error", h);
    return () => window.removeEventListener("rb-wallet-error", h);
  }, []);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setShow(false)}>
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-neutral-900/90 p-5 text-white backdrop-blur" onClick={(e) => e.stopPropagation()}>
        <p className="font-bold">{ja ? "ウォレットアプリ内のブラウザで開いてください" : "Please open in your wallet app's browser"}</p>
        <p className="mt-2 text-sm opacity-80">{ja ? "スマホの通常ブラウザからは接続できません。下のボタンでアプリ内ブラウザに移動します。" : "Mobile browsers can't connect directly. Tap below to open this site inside the wallet app."}</p>
        <button className="mt-4 w-full rounded-xl bg-[#ab9ff2] py-3 font-bold text-black" onClick={() => openInWallet("phantom")}>{ja ? "Phantomで開く" : "Open in Phantom"}</button>
        <button className="mt-2 w-full rounded-xl bg-[#fc7227] py-3 font-bold text-black" onClick={() => openInWallet("solflare")}>{ja ? "Solflareで開く" : "Open in Solflare"}</button>
        <button className="mt-2 w-full py-2 text-sm opacity-70" onClick={() => setShow(false)}>{ja ? "閉じる" : "Close"}</button>
      </div>
    </div>
  );
}
