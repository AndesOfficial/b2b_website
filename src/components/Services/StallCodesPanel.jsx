import { useCallback, useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { FiCopy, FiPlus, FiRefreshCw } from "react-icons/fi";
import { functions } from "../../firebase";

// Society-stall codes. A customer enters one at signup, which opens the
// subscription plans page. Each code works for 24 hours after it is made, then
// a new one has to be generated. The customer is recorded against the society.

const callFn = (name, data) => httpsCallable(functions, name)(data).then((r) => r.data);

const when = (ms) =>
  ms ? new Date(ms).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

function timeLeft(ms, now) {
  const left = ms - now;
  if (left <= 0) return "Expired";
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export default function StallCodesPanel({ isViewer }) {
  const [society, setSociety] = useState("");
  const [codes, setCodes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState(null);
  const [copied, setCopied] = useState("");
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const r = await callFn("listStallCodes", {});
      setCodes(r.codes || []);
    } catch (e) {
      setCodes([]);
      setError(e?.message || "Couldn't load the codes.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const generate = async () => {
    if (society.trim().length < 2) return setError("Enter the society name.");
    setBusy(true); setError("");
    try {
      const r = await callFn("createStallCode", { society: society.trim() });
      setFresh(r); setSociety("");
      await load();
    } catch (e) { setError(e?.message || "Couldn't generate the code."); }
    finally { setBusy(false); }
  };

  const deactivate = async (code) => {
    if (!window.confirm(`Switch off code ${code} now?`)) return;
    setBusy(true); setError("");
    try { await callFn("deactivateStallCode", { code }); await load(); }
    catch (e) { setError(e?.message || "Couldn't switch the code off."); }
    finally { setBusy(false); }
  };

  const copy = async (code) => {
    try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(""), 1500); }
    catch { /* clipboard blocked: the code is on screen */ }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Society stall codes</h2>
          <p className="mt-1 text-xs text-slate-500">
            A customer enters the code at signup and lands on the subscription plans. Each code works for 24 hours,
            then generate a new one. Plans cost the same as everywhere else.
          </p>
        </div>
        <button type="button" onClick={load} aria-label="Refresh" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
          <FiRefreshCw size={16} />
        </button>
      </div>

      {!isViewer && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={society} onChange={(e) => setSociety(e.target.value)} maxLength={80}
            placeholder="Society name (e.g. Greens Society)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
          <button type="button" onClick={generate} disabled={busy}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50">
            <FiPlus size={16} /> Generate code
          </button>
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-700">{error}</p>}

      {fresh && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">New code for {fresh.society}</p>
          <p className="mt-1 text-3xl font-extrabold tracking-[0.3em] text-emerald-900">{fresh.code}</p>
          <p className="mt-1 text-xs text-emerald-800">Valid until {when(fresh.expiresAtMs)}</p>
          <button type="button" onClick={() => copy(fresh.code)}
            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1 text-xs font-bold text-emerald-800 shadow-sm">
            <FiCopy size={12} /> {copied === fresh.code ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-3">Code</th><th className="pr-3">Society</th><th className="pr-3">Made</th>
              <th className="pr-3">Status</th><th />
            </tr>
          </thead>
          <tbody>
            {codes === null && <tr><td colSpan={5} className="py-3 text-slate-500">Loading…</td></tr>}
            {codes && codes.length === 0 && <tr><td colSpan={5} className="py-3 text-slate-500">No codes yet.</td></tr>}
            {(codes || []).map((c) => {
              const live = c.active && c.expiresAtMs > now;
              return (
                <tr key={c.code} className="border-t border-slate-100">
                  <td className="py-2 pr-3 font-mono font-bold tracking-widest text-slate-900">{c.code}</td>
                  <td className="pr-3 text-slate-700">{c.society}</td>
                  <td className="pr-3 text-slate-500">{when(c.createdAtMs)}</td>
                  <td className="pr-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${live ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                      {!c.active ? "Switched off" : live ? timeLeft(c.expiresAtMs, now) : "Expired"}
                    </span>
                  </td>
                  <td className="text-right">
                    {live && (
                      <>
                        <button type="button" onClick={() => copy(c.code)} className="mr-2 text-xs font-bold text-blue-600">
                          {copied === c.code ? "Copied" : "Copy"}
                        </button>
                        {!isViewer && (
                          <button type="button" onClick={() => deactivate(c.code)} disabled={busy} className="text-xs font-bold text-red-600">
                            Switch off
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
