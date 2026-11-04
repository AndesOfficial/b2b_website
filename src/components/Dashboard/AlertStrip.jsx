import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { DEFAULT_ALERT_RULES } from "../../metrics";
import { logAudit } from "../../api/auditLog";
import { useLiveQuery } from "../../hooks/useDashboardData";

const TONE = {
  critical: "bg-rose-50 text-rose-800 border-rose-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
};

/** Open and acknowledged alerts from the server (alerts/{rule}_{day}); staff ack or resolve them. */
export default function AlertStrip({ canAct }) {
  const q = useMemo(() => query(collection(db, "alerts"), where("status", "in", ["open", "acknowledged"])), []);
  const alerts = useLiveQuery(q).sort((a, b) => (a.severity === "critical" ? -1 : 1) - (b.severity === "critical" ? -1 : 1));
  if (!alerts.length) return null;

  const act = async (a, status) => {
    const who = auth.currentUser?.email || null;
    const patch = status === "acknowledged"
      ? { status, ackBy: who, ackAt: serverTimestamp() }
      : { status, resolvedBy: who, resolvedAt: serverTimestamp() };
    try {
      await updateDoc(doc(db, "alerts", a.id), patch);
      logAudit(`alert.${status}`, { collection: "alerts", id: a.id }, { before: { status: a.status } });
    } catch (e) {
      alert(`Could not update the alert: ${e.message}`);
    }
  };

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <div key={a.id} className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg border text-[13px] ${TONE[a.severity] || TONE.warning}`}>
          <span>
            <b className="uppercase text-[11px] mr-2">{a.severity}</b>
            {a.message}
            {a.status === "acknowledged" && <span className="ml-2 text-[11px] opacity-70">acknowledged by {a.ackBy}</span>}
          </span>
          {canAct && (
            <span className="flex gap-3 text-[12px] font-bold">
              {a.status === "open" && <button onClick={() => act(a, "acknowledged")}>Acknowledge</button>}
              <button onClick={() => act(a, "resolved")}>Resolve</button>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Admin-only thresholds (alert_rules/{rule}); missing docs use the defaults. */
export function AlertRulesEditor() {
  const [saved, setSaved] = useState({});
  const [draft, setDraft] = useState({});
  useEffect(() => onSnapshot(collection(db, "alert_rules"), (s) => {
    setSaved(Object.fromEntries(s.docs.map((d) => [d.id, d.data()])));
  }, (e) => console.error("alert_rules:", e)), []);

  const value = (rule, key) => draft[rule]?.[key] ?? saved[rule]?.[key] ?? DEFAULT_ALERT_RULES[rule][key];
  const set = (rule, key, v) => setDraft((d) => ({ ...d, [rule]: { ...d[rule], [key]: v } }));
  const save = async (rule) => {
    const next = { enabled: !!value(rule, "enabled"), threshold: Number(value(rule, "threshold")) || 0, severity: value(rule, "severity") };
    try {
      await setDoc(doc(db, "alert_rules", rule), { ...next, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.email || null });
      logAudit("alert_rule.save", { collection: "alert_rules", id: rule }, { before: saved[rule] || null, after: next });
      setDraft((d) => ({ ...d, [rule]: undefined }));
    } catch (e) {
      alert(`Could not save: ${e.message}`);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
      <h3 className="text-[15px] font-bold text-[#0F172A] mb-1">Alert rules</h3>
      <p className="text-[12px] text-[#64748B] mb-3">Checked every 30 minutes; an alert clears itself when the condition no longer holds.</p>
      <div className="space-y-2">
        {Object.entries(DEFAULT_ALERT_RULES).map(([rule, def]) => (
          <div key={rule} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 text-[13px]">
            <input type="checkbox" checked={!!value(rule, "enabled")} onChange={(e) => set(rule, "enabled", e.target.checked)} />
            <span>{def.label}</span>
            <input className="w-24 px-2 py-1 border border-gray-200 rounded" type="number" value={value(rule, "threshold")}
              onChange={(e) => set(rule, "threshold", e.target.value)} aria-label={`${def.label} threshold (${def.unit})`} />
            <select className="px-2 py-1 border border-gray-200 rounded" value={value(rule, "severity")} onChange={(e) => set(rule, "severity", e.target.value)}>
              <option value="warning">warning</option>
              <option value="critical">critical</option>
            </select>
            <button className="text-[12px] font-bold text-blue-600 disabled:text-gray-300" disabled={!draft[rule]} onClick={() => save(rule)}>Save</button>
          </div>
        ))}
      </div>
    </section>
  );
}
