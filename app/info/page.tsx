"use client";
import Link from "next/link";
import { useI18n, Key } from "@/lib/i18n";
import Faq from "@/components/Faq";
import { Header, Footer, DevnetBanner, TrustList } from "@/components/Chrome";
export default function Info() {
  const { t } = useI18n();
  const steps: [Key, Key][] = [["how1t", "how1"], ["how2t", "how2"], ["how3t", "how3"]];
  return (<><Header /><DevnetBanner />
    <main className="fade-in mx-auto max-w-2xl px-4 pt-10 sm:px-6 sm:pt-14 lg:max-w-[1168px] lg:pt-16">
      <div className="lg:grid lg:grid-cols-[1fr_440px] lg:gap-16"><div>
      <Link href="/" className="link inline-flex min-h-[44px] items-center text-sm">← {t("back")}</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight lg:text-5xl">{t("info")}</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-mute lg:mt-6 lg:text-lg">{t("infoBody")}</p>
      <div className="card mt-8 p-5" data-testid="fee-info"><p className="text-base font-semibold">{t("infoFee")}</p><p className="mt-2 text-sm text-mute">{t("infoNet")}</p></div>
      </div><div className="lg:pt-[60px]">
      <ol className="mt-8 space-y-3 lg:mt-0">{steps.map(([h, b], i) => <li key={h} className="card flex gap-4 p-5"><span className="text-xs text-faint lg:w-5 lg:shrink-0 lg:leading-5 lg:tabular-nums">0{i + 1}</span><div><p className="text-sm font-medium">{t(h)}</p><p className="mt-1 text-sm text-mute">{t(b)}</p></div></li>)}</ol>
      <TrustList className="mt-8" /></div></div>
      <Faq className="mt-10 lg:mx-auto lg:mt-24 lg:max-w-[760px]" />
      <p className="mt-8 lg:mx-auto lg:max-w-[760px]"><Link href="/terms" className="link inline-flex min-h-[44px] items-center text-sm">{t("terms")} →</Link></p>
    </main><Footer /></>);
}
