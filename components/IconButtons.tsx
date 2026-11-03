"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { soundOn, setSoundOn, unlockAudio } from "@/lib/sound";
const cls = "inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-raised text-mute transition hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed";
export function RefreshButton({ onClick, loading, disabled }: { onClick: () => void; loading: boolean; disabled?: boolean }) {
  const { lang } = useI18n();
  return <button type="button" onClick={onClick} disabled={disabled || loading} className={cls} data-testid="rescan" aria-busy={loading}
    aria-label={lang === "ja" ? "空き口座を再スキャン" : "Rescan empty accounts"} title={lang === "ja" ? "再スキャン" : "Rescan"}>
    <svg viewBox="0 0 24 24" className={"h-5 w-5 " + (loading ? "spin" : "")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg></button>;
}
export function SoundToggle() {
  const { lang } = useI18n(); const [on, setOn] = useState(true);
  useEffect(() => { const f = () => setOn(soundOn()); f(); window.addEventListener("rb-sound", f); return () => window.removeEventListener("rb-sound", f); }, []);
  const label = lang === "ja" ? (on ? "効果音をオフにする" : "効果音をオンにする") : (on ? "Turn sound off" : "Turn sound on");
  return <button type="button" onClick={() => { setSoundOn(!on); if (!on) unlockAudio(); }} className={cls} aria-pressed={on} aria-label={label} title={label} data-testid="sound-toggle">
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" />
      {on ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></> : <><path d="m16 9 5 6" /><path d="m21 9-5 6" /></>}</svg></button>;
}
