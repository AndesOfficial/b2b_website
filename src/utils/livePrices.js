import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// Current selling prices from the `prices` collection (the same one the apps use),
// keyed by lower-cased service name. Loaded once per page visit.
let cache = null;

const norm = (s) => String(s || "").toLowerCase().replace(/_regular$/i, "").replace(/\s+/g, " ").trim();

export async function loadLivePrices() {
  if (cache) return cache;
  const snap = await getDocs(collection(db, "prices"));
  const map = {};
  const put = (name, d) => {
    const piece = Number(d.rateByPiece ?? d.rateByPair) || 0;
    const kg = Number(d.rateByKg) || 0;
    if (name && (piece > 0 || kg > 0)) map[norm(name)] = { piece, kg };
  };
  snap.docs.forEach((doc) => {
    const d = doc.data();
    put(d.serviceName, d);
    (Array.isArray(d.subServices) ? d.subServices : []).forEach((s) => put(s.name, s));
  });
  cache = map;
  return map;
}

/**
 * Fills service lines that have no price yet (order not weighed/billed, nothing
 * stored on the order) with the current catalog rate x pieces. Lines are flagged
 * `estimated` and `fromCatalog`; real amounts are never touched.
 */
export function fillFromCatalog(order, prices) {
  if (!order || !prices || !Array.isArray(order.serviceBreakdown)) return order;
  let changed = false;
  const lines = order.serviceBreakdown.map((line) => {
    if (Number(line.amount) > 0) return line;
    const p = prices[norm(line.name)];
    if (!p) return line;
    const qty = Number(line.quantity) || 0;
    const amount = p.piece > 0 ? p.piece * qty : 0;
    if (!(amount > 0)) return line;
    changed = true;
    return { ...line, amount: Math.round(amount), unitRate: line.unitRate || p.piece, estimated: true, fromCatalog: true };
  });
  return changed ? { ...order, serviceBreakdown: lines } : order;
}
