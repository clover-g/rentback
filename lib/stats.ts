// Stats (feature-flagged: NEXT_PUBLIC_FEATURE_STATS). Stored per-browser in localStorage
// (key rentback:stats:<wallet>) after each confirmed tx. Not global; on-chain aggregation is future work.
export type Stats = { lamports: number; accounts: number };
const key = (w: string) => `rentback:stats:${w}`;
export function getStats(w: string): Stats {
  if (typeof window === "undefined") return { lamports: 0, accounts: 0 };
  try { return JSON.parse(localStorage.getItem(key(w)) || "") as Stats; } catch { return { lamports: 0, accounts: 0 }; }
}
export function addStats(w: string, lamports: number, accounts: number) {
  const s = getStats(w); const n = { lamports: s.lamports + lamports, accounts: s.accounts + accounts };
  localStorage.setItem(key(w), JSON.stringify(n)); window.dispatchEvent(new Event("rentback-stats")); return n;
}
