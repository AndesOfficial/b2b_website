// Where new paying customers came from, and what each source cost.

export const ACQUISITION_SOURCES = [
  "Referral", "Paid Advertising", "Instagram", "WhatsApp", "Google Search", "Google Maps",
  "Word of Mouth", "Website", "App", "Walk-in", "Other / Unknown",
] as const;
export const UNKNOWN_SOURCE = "Other / Unknown";

/** Referee ₹100 on sign-up + referrer ₹100 on the first delivered order. */
export const REFERRAL_COST_PER_CUSTOMER = 200;

/** Free text ("insta", "meta ad", "friend") → a source from the list, or null. */
export function matchSource(raw: unknown): string | null {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return null;
  const exact = ACQUISITION_SOURCES.find((x) => x.toLowerCase() === s);
  if (exact) return exact;
  if (s.includes("refer")) return "Referral";
  if (s.includes("whatsapp") || s === "wa") return "WhatsApp";
  if (s.includes("insta")) return "Instagram";
  if (s.includes("map")) return "Google Maps";
  if (s.includes("google") || s.includes("search")) return "Google Search";
  if (s.includes("meta") || s.includes("facebook") || /\bads?\b/.test(s) || s.includes("campaign")) return "Paid Advertising";
  if (s.includes("friend") || s.includes("mouth")) return "Word of Mouth";
  if (s.includes("walk") || s.includes("store")) return "Walk-in";
  if (s.includes("web")) return "Website";
  if (s.includes("app")) return "App";
  return null;
}

/**
 * First-touch source, strongest evidence first: a referral code, an ad
 * campaign the app recorded, what the customer told us at sign-up, a manual
 * tag from the Admin site (customer_sources), else unknown.
 */
export function firstTouchSource(user: any, manualTag?: unknown): string {
  if (user?.referredBy || user?.referralCode) return "Referral";
  if (user?.acquisitionCampaign) return "Paid Advertising";
  return matchSource(user?.selfReportedSource) || matchSource(manualTag) || UNKNOWN_SOURCE;
}

export interface AcquisitionRow {
  source: string;
  newPaying: number;
  spend: number;
  /** spend ÷ new paying customers; null (show "N/A — no new customers") when none. */
  cac: number | null;
  firstOrderRevenue: number;
  spendEstimated: boolean;
}

/**
 * @param newCustomers   customerFirsts rows in the period: { source, firstOrderRevenue }
 * @param marketingSpend Marketing expenses in the period: { amount, campaignId }
 */
export function acquisitionTable(newCustomers: any[], marketingSpend: any[]): AcquisitionRow[] {
  const rows: Record<string, AcquisitionRow> = {};
  const row = (source: string) =>
    (rows[source] ||= { source, newPaying: 0, spend: 0, cac: null, firstOrderRevenue: 0, spendEstimated: false });
  for (const c of newCustomers) {
    const r = row(c.source || UNKNOWN_SOURCE);
    r.newPaying++;
    r.firstOrderRevenue += Number(c.firstOrderRevenue) || 0;
  }
  for (const e of marketingSpend) row(matchSource(e.campaignId) || "Paid Advertising").spend += Number(e.amount) || 0;
  const ref = rows["Referral"];
  if (ref) {
    ref.spend += ref.newPaying * REFERRAL_COST_PER_CUSTOMER;
    ref.spendEstimated = true;
  }
  return Object.values(rows)
    .map((r) => ({ ...r, cac: r.newPaying ? Math.round(r.spend / r.newPaying) : null }))
    .sort((a, b) => b.newPaying - a.newPaying || b.spend - a.spend);
}
