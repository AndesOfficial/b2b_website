// Data for the Dashboard tab, each read scoped to the period (no app-wide listeners).
import { useCallback, useEffect, useState } from "react";
import { collection, documentId, getDocs, onSnapshot, query, Timestamp, where } from "firebase/firestore";
import { db } from "../firebase";
import { OPEN_STATUSES, opsMetrics } from "../metrics";

const istStartMs = (day) => Date.parse(`${day}T00:00:00+05:30`);
const istEndMs = (day) => istStartMs(day) + 86400000 - 1;

/** Live snapshot of a query; `q` must be memoised by the caller. */
export function useLiveQuery(q) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!q) return undefined;
    return onSnapshot(q, (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error("useLiveQuery:", e));
  }, [q]);
  return rows;
}

async function getByIds(name, ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 30) {
    const snap = await getDocs(query(collection(db, name), where(documentId(), "in", ids.slice(i, i + 30))));
    snap.docs.forEach((d) => (out[d.id] = d.data()));
  }
  return out;
}

/** Orders & pickups for [from, to] from orderEvents + every open order. */
export function useOpsMetrics(from, to) {
  const [state, setState] = useState({ loading: true, error: null, ops: null, events: [], orders: {} });
  const load = useCallback(async () => {
    if (!from || !to) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const fromMs = istStartMs(from);
      const toMs = istEndMs(to);
      const [evSnap, openSnap] = await Promise.all([
        getDocs(query(collection(db, "orderEvents"),
          where("at", ">=", Timestamp.fromMillis(fromMs)), where("at", "<=", Timestamp.fromMillis(toMs)))),
        getDocs(query(collection(db, "cartdetails"), where("status", "in", OPEN_STATUSES))),
      ]);
      const events = evSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const orders = Object.fromEntries(openSnap.docs.map((d) => [d.id, d.data()]));
      const missing = [...new Set(events.filter((e) => e.collection !== "hostels_orders").map((e) => e.orderId))].filter((id) => !orders[id]);
      Object.assign(orders, await getByIds("cartdetails", missing));
      const ops = opsMetrics(events, orders, { fromMs, toMs, now: Date.now() });
      setState({ loading: false, error: null, ops, events, orders });
    } catch (err) {
      console.error("useOpsMetrics:", err);
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);
  return { ...state, refresh: load };
}

/** customerFirsts whose first verified day is in [from, to]. */
export function useNewCustomers(from, to) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!from || !to) return;
    getDocs(query(collection(db, "customerFirsts"), where("firstDay", ">=", from), where("firstDay", "<=", to)))
      .then((s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch((e) => console.error("useNewCustomers:", e));
  }, [from, to]);
  return rows;
}
