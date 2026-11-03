"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CLUSTER } from "@/lib/config";
import { useI18n, LangToggle } from "@/lib/i18n";
const WalletMultiButton = dynamic(() => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton), { ssr: false, loading: () => <div className="h-11 w-32 rounded-xl bg-raised" /> });

export function Logo() {
  return (<Link href="/" className="flex min-h-[44px] items-center gap-2.5" aria-label="RentBack home">
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden><rect width="28" height="28" rx="8" fill="#2fd6a4" /><path d="M9 18.5V9.5h5.2a3 3 0 0 1 0 6H9m5-0l4.5 3.5" stroke="#04140e" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    <span className="hidden text-[17px] font-semibold tracking-tight min-[420px]:inline">RentBack</span></Link>);
}
export function ThemeToggle() {
  const { lang } = useI18n(); const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const f = (e: MediaQueryListEvent) => { if (!localStorage.getItem("rentback:theme")) { document.documentElement.classList.toggle("dark", e.matches); setDark(e.matches); } };
    mq.addEventListener("change", f); return () => mq.removeEventListener("change", f);
  }, []);
  const flip = () => { const d = !document.documentElement.classList.contains("dark"); document.documentElement.classList.toggle("dark", d); localStorage.setItem("rentback:theme", d ? "dark" : "light"); setDark(d); };
  const label = dark ? (lang === "ja" ? "ライトモードに切り替え" : "Switch to light mode") : (lang === "ja" ? "ダークモードに切り替え" : "Switch to dark mode");
  return (<button onClick={flip} aria-label={label} title={label} data-testid="theme-toggle" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-mute transition-colors hover:bg-raised hover:text-ink">
    {dark === false ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>}
  </button>);
}
export function Header({ wallet = true }: { wallet?: boolean }) {
  return (<header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur">
    <div className="mx-auto flex max-w-5xl items-center lg:max-w-[1168px] justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-6">
      <Logo />
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2"><ThemeToggle /><LangToggle />{wallet ? <WalletMultiButton /> : <Link href="/" className="btn-ghost text-sm">RentBack</Link>}</div>
    </div>
  </header>);
}
export function DevnetBanner() {
  const { t } = useI18n();
  if (CLUSTER === "mainnet-beta") return null;
  return (<div className="border-b border-warn-line bg-warn-bg px-4 py-2 text-center text-xs text-warn-fg" data-testid="devnet-banner">{t("testnet", { c: CLUSTER })}</div>);
}
export function Footer() {
  const { t } = useI18n();
  return (<footer className="mx-auto mt-16 max-w-5xl border-t border-line px-4 py-8 text-sm sm:px-6 lg:mt-24 lg:max-w-[1120px] lg:px-0">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-faint">© RentBack</p>
      <nav className="flex gap-2"><Link href="/info" className="link inline-flex min-h-[44px] items-center px-2">{t("info")}</Link><Link href="/terms" className="link inline-flex min-h-[44px] items-center px-2">{t("terms")}</Link></nav>
    </div></footer>);
}
export function TrustList({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const items = [t("trust1"), t("trust2"), t("trust3")];
  return (<ul className={`space-y-2.5 text-sm text-mute ${className}`}>{items.map((x) =>
    <li key={x} className="flex items-start gap-2.5"><svg className="mt-0.5 shrink-0 text-accent-fg" width="16" height="16" viewBox="0 0 16 16" aria-hidden><circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeOpacity=".5" fill="none" /><path d="M5 8.2l2 2 4-4.2" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg><span>{x}</span></li>)}</ul>);
}
export function Spinner() { return <span className="spin inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent" aria-hidden />; }
