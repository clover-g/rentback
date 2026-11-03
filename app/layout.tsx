import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import Providers from "@/components/Providers";
export const metadata = { title: "RentBack — 空のトークン口座からSOLを回収", description: "Close empty Solana token accounts and get the rent back to your wallet." };
export const viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6f7f9" }, { media: "(prefers-color-scheme: dark)", color: "#0b0d10" }] };
// Runs before paint: stored choice wins, else OS preference. Prevents a flash of the wrong theme.
const themeScript = `(function(){try{var s=localStorage.getItem("rentback:theme");var d=s?s==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="ja" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body className="min-h-screen bg-bg font-sans text-ink"><Providers>{children}</Providers></body></html>);
}
