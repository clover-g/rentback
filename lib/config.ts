import { PublicKey, clusterApiUrl, Cluster } from "@solana/web3.js";
export const CLUSTER = (process.env.NEXT_PUBLIC_CLUSTER || "devnet") as Cluster;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl(CLUSTER);
export const FEE_WALLET = new PublicKey(process.env.NEXT_PUBLIC_FEE_WALLET || "11111111111111111111111111111111");
// Feature flags (build-time). "true" to show; anything else hides the UI entirely.
export const FEATURE_STATS = process.env.NEXT_PUBLIC_FEATURE_STATS === "true";
