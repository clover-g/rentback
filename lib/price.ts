// USD prices from Jupiter Price API v3 (free, no key). Missing/unavailable → null ("unknown").
export async function fetchUsdPrices(mints: string[]): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {}; mints.forEach((m) => (out[m] = null));
  for (let k = 0; k < mints.length; k += 50) {
    try {
      const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mints.slice(k, k + 50).join(",")}`);
      if (!r.ok) continue; const j = await r.json();
      for (const [m, v] of Object.entries<any>(j)) if (typeof v?.usdPrice === "number") out[m] = v.usdPrice;
    } catch { /* offline → unknown */ }
  }
  return out;
}
