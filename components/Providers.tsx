"use client";
import { useCallback, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { RPC_URL } from "@/lib/config";
import { I18nProvider } from "@/lib/i18n";
import MobileWalletGuard, { isMobileNoProvider } from "@/components/MobileWalletGuard";
export default function Providers({ children }: { children: React.ReactNode }) {
  // Standard wallets (Phantom/Solflare/Backpack in-app & desktop) are auto-detected.
  // On mobile browsers without an injected provider, list Phantom/Solflare so the guard can deep-link.
  const wallets = useMemo(() => (isMobileNoProvider() ? [new PhantomWalletAdapter()] : []), []);
  const onError = useCallback((e: unknown) => { console.warn("wallet error", e); window.dispatchEvent(new Event("rb-wallet-error")); }, []);
  return (<ConnectionProvider endpoint={RPC_URL}><WalletProvider wallets={wallets} autoConnect onError={onError}>
    <WalletModalProvider><I18nProvider>{children}<MobileWalletGuard /></I18nProvider></WalletModalProvider></WalletProvider></ConnectionProvider>);
}
