// Service catalog (`prices` collection) — values the admin Services page
// offers. The customer app builds its category chips from these, so a new
// category also needs app work; that is why the list is fixed here.
export const SERVICE_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "dry cleaning", label: "Dry Cleaning" },
  { value: "household", label: "Household" },
  { value: "shoes", label: "Footwear" },
  { value: "bags", label: "Bags" },
];

// active: everywhere · hidden: riders only · archived: nowhere.
/**
 * The app tab value for a stored category. The app lowercases categories, so
 * "Dry Cleaning" and "dry cleaning" are the same tab; "footwear" means shoes.
 * Unknown values come back trimmed and lowercased.
 */
export function canonicalCategory(category) {
  const c = String(category ?? "").trim().toLowerCase();
  if (!c) return "general";
  if (c === "footwear") return "shoes";
  return c;
}

export const SERVICE_STATUSES = [
  { value: "active", label: "Active", hint: "Visible to customers and riders", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "hidden", label: "Hidden", hint: "Hidden from customers; riders can still bill it", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "archived", label: "Archived", hint: "Gone from every app; kept for old orders", tone: "bg-slate-100 text-slate-500 border-slate-200" },
];

export const SERVICE_UNITS = ["piece", "pair", "kg"];

export const MAX_SERVICE_IMAGE_BYTES = 2 * 1024 * 1024;

// The customer app's Instant section offers exactly these services (matched
// by name, see andes_now_user lib/utils/instant_catalog.dart) at the doc's
// Instant rate, or 2× the regular rate when none is set.
const INSTANT_NAMES = {
  piece: ["ironing", "iron"],
  kg: ["wash & iron", "wash and iron", "wash & fold", "wash and fold", "wash & dry"],
};

/** "piece" or "kg" when this service appears in the app's Instant section, else null. */
export function instantUnitOf(serviceName) {
  const n = String(serviceName || "").trim().toLowerCase();
  if (INSTANT_NAMES.piece.includes(n)) return "piece";
  if (INSTANT_NAMES.kg.includes(n)) return "kg";
  return null;
}
