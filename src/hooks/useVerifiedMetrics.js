import { useCallback, useEffect, useState } from "react";
import { collection, getDocs, query, Timestamp, where } from "firebase/firestore";
import { db } from "../firebase";
import { buildRecords, computeKpis } from "../metrics";

// Orders are picked up up to ~60 days after creation (advance bookings), so
// cartdetails is read from that far back and filtered by pickup day.
const LOOKBACK_DAYS = 60;
const shift = (ymd, days) => {
  const d = new Date(`${ymd}T00:00:00+05:30`);
  d.setDate(d.getDate() + days);
  return d;
};
const ymd = (d) => new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * KPIs from src/metrics for [from, to] (IST, inclusive), read with date-scoped
 * queries instead of the app-wide cartdetails listener. One-shot; call refresh().
 */
export function useVerifiedMetrics(from, to) {
  const [state, setState] = useState({ loading: true, error: null, kpis: null, records: [], refreshedAt: null });

  const load = useCallback(async () => {
    if (!from || !to || from > to) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [cartSnap, verSnap, b2bSnap] = await Promise.all([
        getDocs(query(collection(db, "cartdetails"),
          where("createdAt", ">=", Timestamp.fromDate(shift(from, -LOOKBACK_DAYS))),
          where("createdAt", "<", Timestamp.fromDate(shift(to, 2))))),
        getDocs(query(collection(db, "managerVerifications"),
          where("pickupDate", ">=", ymd(shift(from, -LOOKBACK_DAYS))),
          where("pickupDate", "<=", ymd(shift(to, 14))))),
        getDocs(query(collection(db, "managerB2bEntries"), where("date", ">=", from), where("date", "<=", to))),
      ]);
      const records = buildRecords({
        cartdetails: cartSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        verifications: Object.fromEntries(verSnap.docs.map((d) => [d.id, d.data()])),
        b2bEntries: b2bSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      });
      setState({ loading: false, error: null, kpis: computeKpis(records, { from, to }), records, refreshedAt: new Date() });
    } catch (err) {
      console.error("useVerifiedMetrics:", err);
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  return { ...state, refresh: load };
}
