import { useCallback, useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { eachDay, kpisFromTotals, mergeTotals } from "../metrics";

/**
 * KPIs for [from, to] (IST, inclusive) from the server's dailyMetrics/{day}
 * totals (refreshed every 30 minutes) — one small doc per day instead of every
 * order. Days the server has not computed yet are listed in `missingDays`.
 */
export function useDailyMetrics(from, to) {
  const [state, setState] = useState({ loading: true, error: null, kpis: null, missingDays: [], computedAt: null });

  const load = useCallback(async () => {
    if (!from || !to || from > to) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const snap = await getDocs(query(collection(db, "dailyMetrics"), where("day", ">=", from), where("day", "<=", to)));
      const docs = snap.docs.map((d) => d.data());
      const have = new Set(docs.map((d) => d.day));
      const computed = docs.map((d) => d.computedAt?.toDate?.()).filter(Boolean);
      setState({
        loading: false,
        error: null,
        kpis: kpisFromTotals(mergeTotals(docs)),
        missingDays: eachDay(from, to).filter((d) => !have.has(d)),
        // The oldest day's refresh time: every figure is at least this fresh.
        computedAt: computed.length ? new Date(Math.min(...computed.map((d) => d.getTime()))) : null,
      });
    } catch (err) {
      console.error("useDailyMetrics:", err);
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  return { ...state, refresh: load };
}
