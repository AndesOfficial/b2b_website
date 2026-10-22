import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { FiGift, FiMenu, FiRefreshCw } from "react-icons/fi";
import { functions } from "../firebase";
import AdminSidebar from "../components/Layout/AdminSidebar";
import DashboardSkeleton from "../components/Shared/DashboardSkeleton";
import { useHostelAuth } from "../context/HostelAuthContext";

// Promo campaigns bought with a one-time payment (Society Diwali Offer).
// Everything goes through admin callables in the customer repo's
// function/index.ts — the campaign collections are closed to direct reads
// and writes, and every change is validated and audited on the server.

const CAMPAIGN_ID = "society_diwali_2026";
const ROUTES = {
  regular: "/admin/regular-orders", investors: "/admin/investors", expenses: "/admin/expenses",
  salaries: "/admin/salaries", calculator: "/admin/calculator", dailyReport: "/admin/daily-report",
  metaleads: "/admin/meta-leads", services: "/admin/services",
};

const rupees = (paise) => `₹${((Number(paise) || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (ms) => (ms ? new Date(ms).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");
const qty = (baseUnit, n) => (baseUnit === "g" ? `${(n / 1000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg` : `${n} ${baseUnit === "pair" ? "pair" : "pc"}`);
// <input type="datetime-local"> works in local time.
const toLocalInput = (ms) => (ms ? new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fromLocalInput = (v) => (v ? new Date(v).getTime() : null);

const STATUS_STYLE = {
  active: "bg-emerald-100 text-emerald-800",
  eligible: "bg-sky-100 text-sky-800",
  payment_pending: "bg-amber-100 text-amber-800",
  payment_failed: "bg-rose-100 text-rose-800",
  expired: "bg-slate-200 text-slate-700",
  refunded: "bg-violet-100 text-violet-800",
  revoked: "bg-slate-800 text-white",
};

function call(name, data) {
  return httpsCallable(functions, name)(data).then((r) => r.data);
}

function Card({ title, children, right }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function SettingsForm({ config, entitlements, canEdit, onSave, saving }) {
  const [form, setForm] = useState(() => ({
    campaignName: config.campaignName || "",
    promoCode: config.promoCode || "",
    startsAt: toLocalInput(config.startsAt),
    endsAt: toLocalInput(config.endsAt),
    initialPaymentAmountPaise: config.initialPaymentAmountPaise || 0,
    advertisedBundleValuePaise: config.advertisedBundleValuePaise || 0,
    entitlementDurationDays: config.entitlementDurationDays || 7,
    limits: Object.fromEntries(entitlements.map((e) => [e.key, e.limit])),
  }));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    onSave({
      campaignName: form.campaignName.trim(),
      promoCode: form.promoCode,
      startsAt: fromLocalInput(form.startsAt),
      endsAt: fromLocalInput(form.endsAt),
      initialPaymentAmountPaise: Math.round(Number(form.initialPaymentAmountPaise)),
      advertisedBundleValuePaise: Math.round(Number(form.advertisedBundleValuePaise)),
      entitlementDurationDays: Math.round(Number(form.entitlementDurationDays)),
      entitlements: entitlements.map((e) => ({ ...e, limit: Math.round(Number(form.limits[e.key])) })),
    });
  };

  const input = "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50";
  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      <label className="text-sm font-semibold text-slate-700">Name
        <input className={input} value={form.campaignName} onChange={set("campaignName")} disabled={!canEdit} />
      </label>
      <label className="text-sm font-semibold text-slate-700">Promo code (case-insensitive)
        <input className={input} value={form.promoCode} onChange={set("promoCode")} disabled={!canEdit} />
      </label>
      <label className="text-sm font-semibold text-slate-700">Starts
        <input type="datetime-local" className={input} value={form.startsAt} onChange={set("startsAt")} disabled={!canEdit} />
      </label>
      <label className="text-sm font-semibold text-slate-700">Ends (no new claims after this)
        <input type="datetime-local" className={input} value={form.endsAt} onChange={set("endsAt")} disabled={!canEdit} />
      </label>
      <label className="text-sm font-semibold text-slate-700">Payment amount (paise) — {rupees(form.initialPaymentAmountPaise)}
        <input type="number" min="1" step="1" className={input} value={form.initialPaymentAmountPaise} onChange={set("initialPaymentAmountPaise")} disabled={!canEdit} />
      </label>
      <label className="text-sm font-semibold text-slate-700">Advertised value (paise, display only) — {rupees(form.advertisedBundleValuePaise)}
        <input type="number" min="0" step="1" className={input} value={form.advertisedBundleValuePaise} onChange={set("advertisedBundleValuePaise")} disabled={!canEdit} />
      </label>
      <label className="text-sm font-semibold text-slate-700">Free period (days after payment)
        <input type="number" min="1" step="1" className={input} value={form.entitlementDurationDays} onChange={set("entitlementDurationDays")} disabled={!canEdit} />
      </label>
      <div className="md:col-span-2">
        <p className="text-sm font-semibold text-slate-700">Free quantities (grams for kg services)</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entitlements.map((e) => (
            <label key={e.key} className="text-sm text-slate-600">
              {e.label} <span className="text-slate-400">({e.catalogNames.join(", ")})</span>
              <input type="number" min="1" step="1" className={input} value={form.limits[e.key]}
                onChange={(ev) => setForm((f) => ({ ...f, limits: { ...f.limits, [e.key]: ev.target.value } }))} disabled={!canEdit} />
            </label>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-500 md:col-span-2">
        Changes apply to new claims only. Customers who already claimed keep the price, quantities and period they were offered.
      </p>
      {canEdit && (
        <div className="md:col-span-2">
          <button type="submit" disabled={saving}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      )}
    </form>
  );
}

export default function AdminCampaigns() {
  const navigate = useNavigate();
  const { client, logout, isViewer } = useHostelAuth();
  const canEdit = !isViewer;
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [view, setView] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 1024;
      setIsSidebarCollapsed(isMobile);
      if (!isMobile) setIsMobileMenuOpen(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const load = useCallback(async () => {
    setError("");
    try {
      setView(await call("adminGetCampaign", { campaignId: CAMPAIGN_ID }));
      setFormKey((k) => k + 1);
    } catch (e) {
      setError(e.message || "Couldn't load the campaign.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (fn, okMessage, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(okMessage);
      await load();
    } catch (e) {
      setError(e.message || "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  const handleSidebarTabChange = useCallback((tab) => {
    setIsMobileMenuOpen(false);
    if (tab === "campaigns") return;
    if (ROUTES[tab]) { navigate(ROUTES[tab]); return; }
    navigate("/admin", { state: { initialTab: tab } });
  }, [navigate]);

  const config = view?.config;
  const entitlements = config?.entitlements || [];
  const labelOf = useMemo(() => Object.fromEntries(entitlements.map((e) => [e.key, e])), [entitlements]);
  const enrollments = (view?.enrollments || []).filter((e) => statusFilter === "all" || e.status === statusFilter);
  const live = config && config.enabled && (!config.startsAt || Date.now() >= config.startsAt) && (!config.endsAt || Date.now() < config.endsAt);

  return (
    <div className="flex min-h-screen bg-[#F1F5F9]" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <AdminSidebar
        activeTab="campaigns"
        setActiveTab={handleSidebarTabChange}
        user={client}
        onLogout={logout}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />

      <main className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ${isSidebarCollapsed ? "lg:ml-[80px]" : "lg:ml-[220px]"} ml-0`}>
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur shadow-sm">
          <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-8">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setIsMobileMenuOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
                aria-label="Open sidebar">
                <FiMenu size={20} />
              </button>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Admin Portal</p>
                <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-slate-950">
                  <FiGift size={20} className="text-orange-500" />
                  {config?.campaignName || "Promo Campaigns"}
                </h1>
              </div>
            </div>
            <button type="button" onClick={load} disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              <FiRefreshCw size={14} /> Refresh
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-6 px-4 py-6 lg:px-8">
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
          {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
          {!view && !error && <DashboardSkeleton />}
          {view && !config && (
            <Card title="Not set up">
              <p className="text-sm text-slate-600">
                There is no <code>campaigns/{CAMPAIGN_ID}</code> document yet. Seed it with
                <code> function/scripts/seed_society_campaign.js</code> (it starts switched off).
              </p>
            </Card>
          )}

          {config && (
            <>
              <Card
                title="Status"
                right={canEdit && (
                  <button type="button" disabled={busy}
                    onClick={() => run(
                      () => call("adminUpdateCampaign", { campaignId: CAMPAIGN_ID, changes: { enabled: !config.enabled } }),
                      config.enabled ? "Campaign switched off." : "Campaign switched on.",
                      config.enabled
                        ? "Switch off? New claims and new payments stop at once. Customers who already paid keep their free services until their period ends."
                        : "Switch on? New customers can claim the code at signup and pay.",
                    )}
                    className={`rounded-xl px-4 py-2 text-sm font-bold text-white shadow ${config.enabled ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"} disabled:opacity-50`}>
                    {config.enabled ? "Switch off" : "Switch on"}
                  </button>
                )}
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">Taking new claims</p>
                    <p className={`text-lg font-extrabold ${live ? "text-emerald-600" : "text-slate-500"}`}>
                      {live ? "Yes" : config.enabled ? "No (outside dates)" : "No (switched off)"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">Code</p>
                    <p className="text-lg font-extrabold text-slate-900">{config.promoCode}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">Verified payments</p>
                    <p className="text-lg font-extrabold text-slate-900">{rupees(view.paidTotalPaise)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">Version · last change</p>
                    <p className="text-sm font-semibold text-slate-700">v{config.campaignVersion || 0} · {when(config.updatedAt)} {config.updatedBy ? `by ${config.updatedBy}` : ""}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {Object.entries(view.counts).map(([s, n]) => (
                    <span key={s} className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[s] || "bg-slate-100 text-slate-700"}`}>{s.replace("_", " ")}: {n}</span>
                  ))}
                  {Object.keys(view.counts).length === 0 && <span className="text-sm text-slate-500">No claims yet.</span>}
                </div>
              </Card>

              {view.refundsDue.length > 0 && (
                <Card title={`Payments to refund (${view.refundsDue.length})`}>
                  <p className="mb-3 text-sm text-slate-600">
                    Refund these in the PhonePe dashboard, then record it here. Recording moves no money.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase text-slate-400"><tr><th className="py-2">Payment</th><th>Customer</th><th>Amount</th><th>Why</th><th /></tr></thead>
                      <tbody>
                        {view.refundsDue.map((r) => (
                          <tr key={r.merchantOrderId} className="border-t border-slate-100">
                            <td className="py-2 font-mono text-xs">{r.merchantOrderId}</td>
                            <td className="font-mono text-xs">{r.userId}</td>
                            <td>{rupees(r.amountPaise)}</td>
                            <td>{r.reason}</td>
                            <td className="whitespace-nowrap text-right">
                              {canEdit && (
                                <>
                                  <button type="button" disabled={busy} className="mr-2 rounded-lg bg-violet-600 px-3 py-1 text-xs font-bold text-white"
                                    onClick={() => {
                                      const note = window.prompt("PhonePe refund reference:");
                                      if (note === null) return;
                                      run(() => call("adminResolveCampaignRefund", { merchantOrderId: r.merchantOrderId, resolution: "refunded", note }), "Refund recorded.");
                                    }}>Refunded</button>
                                  <button type="button" disabled={busy} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700"
                                    onClick={() => {
                                      const note = window.prompt("Why is no refund needed?");
                                      if (note === null) return;
                                      run(() => call("adminResolveCampaignRefund", { merchantOrderId: r.merchantOrderId, resolution: "not_needed", note }), "Marked as not needed.");
                                    }}>Not needed</button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              <Card title="Settings">
                <SettingsForm
                  key={formKey}
                  config={config}
                  entitlements={entitlements}
                  canEdit={canEdit}
                  saving={busy}
                  onSave={(changes) => run(() => call("adminUpdateCampaign", { campaignId: CAMPAIGN_ID, changes }), "Settings saved.")}
                />
              </Card>

              <Card
                title={`Customers (${view.enrollments.length})`}
                right={(
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm">
                    <option value="all">All</option>
                    {Object.keys(STATUS_STYLE).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                )}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-400">
                      <tr><th className="py-2">Phone</th><th>Status</th><th>Paid</th><th>Free until</th><th>Left (used / held)</th><th /></tr>
                    </thead>
                    <tbody>
                      {enrollments.map((e) => (
                        <tr key={e.id} className="border-t border-slate-100 align-top">
                          <td className="py-2">
                            <div className="font-semibold">{e.phone10 || "—"}</div>
                            <div className="font-mono text-[11px] text-slate-400">{e.uid}</div>
                          </td>
                          <td>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[e.status] || ""}`}>{e.status.replace("_", " ")}</span>
                            {e.closeNote && <div className="mt-1 text-xs text-slate-500">{e.closeNote}</div>}
                          </td>
                          <td>{e.paidAmountPaise ? rupees(e.paidAmountPaise) : "—"}</td>
                          <td>{when(e.expiresAtMs)}</td>
                          <td className="text-xs">
                            {Object.keys(e.limits).map((k) => (
                              <div key={k}>
                                {labelOf[k]?.label || k}: <b>{qty(labelOf[k]?.baseUnit, e.remaining[k] || 0)}</b>
                                <span className="text-slate-400"> ({qty(labelOf[k]?.baseUnit, e.redeemed[k] || 0)} / {qty(labelOf[k]?.baseUnit, e.reserved[k] || 0)})</span>
                              </div>
                            ))}
                          </td>
                          <td className="whitespace-nowrap text-right">
                            {canEdit && ["eligible", "payment_failed", "active"].includes(e.status) && (
                              <button type="button" disabled={busy}
                                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700"
                                onClick={() => {
                                  const refunded = e.status === "active";
                                  const note = window.prompt(refunded
                                    ? "Mark refunded (refund the ₹ in PhonePe first). Note:"
                                    : "Revoke this claim. Note:");
                                  if (note === null) return;
                                  run(() => call("adminCloseCampaignEnrollment", { enrollmentId: e.id, status: refunded ? "refunded" : "revoked", note }),
                                    refunded ? "Marked refunded." : "Claim revoked.");
                                }}>
                                {e.status === "active" ? "Mark refunded" : "Revoke"}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {enrollments.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-slate-500">Nobody here.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title={`Orders with free services (${view.orders.length})`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-400">
                      <tr><th className="py-2">Order</th><th>Placed</th><th>Status</th><th>Free</th><th>Saved</th><th>Bill total</th></tr>
                    </thead>
                    <tbody>
                      {view.orders.map((o) => (
                        <tr key={o.id} className="border-t border-slate-100 align-top">
                          <td className="py-2">
                            <div className="font-semibold">{o.orderNumber ? `#${o.orderNumber}` : o.id}</div>
                            <div className="font-mono text-[11px] text-slate-400">{o.id}</div>
                          </td>
                          <td>{when(o.createdAtMs)}</td>
                          <td>{o.status} <span className="text-xs text-slate-400">({o.campaignState})</span></td>
                          <td className="text-xs">{o.lines.map((l) => <div key={l.cartKey}>{l.cartKey.replace(/_regular$/, "")}: {qty(l.baseUnit, l.freeQty)} of {qty(l.baseUnit, l.qty)}</div>)}</td>
                          <td>{rupees(o.discountPaise)}</td>
                          <td>{o.billTotal == null ? "—" : `₹${o.billTotal}`}</td>
                        </tr>
                      ))}
                      {view.orders.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-slate-500">No orders yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title="Audit log">
                <ul className="space-y-2 text-sm">
                  {view.audit.map((a) => (
                    <li key={a.id} className="border-t border-slate-100 pt-2">
                      <span className="font-semibold">{when(a.at)}</span> · {a.by?.email || a.by?.uid} · <b>{a.action.replace(/_/g, " ")}</b>
                      {a.diff && (
                        <span className="text-slate-600"> — {Object.entries(a.diff).map(([k, v]) => `${k}: ${JSON.stringify(v.from)} → ${JSON.stringify(v.to)}`).join("; ")}</span>
                      )}
                      {a.note && <span className="text-slate-600"> — {a.note}</span>}
                      {a.resolution && <span className="text-slate-600"> ({a.resolution}, {a.merchantOrderId})</span>}
                    </li>
                  ))}
                  {view.audit.length === 0 && <li className="text-slate-500">No changes recorded yet.</li>}
                </ul>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
