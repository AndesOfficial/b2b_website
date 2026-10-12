import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { FiMenu, FiMove, FiPlus, FiSearch, FiTag } from "react-icons/fi";
import { db } from "../firebase";
import AdminSidebar from "../components/Layout/AdminSidebar";
import ServiceEditor from "../components/Services/ServiceEditor";
import DashboardSkeleton from "../components/Shared/DashboardSkeleton";
import { useHostelAuth } from "../context/HostelAuthContext";
import { SERVICE_CATEGORIES, SERVICE_STATUSES, canonicalCategory, instantUnitOf } from "../constants/serviceCatalog";
import { describeCatalogError, reorderServices, resolveCatalogFlag, serviceStatusOf, setServiceStatus } from "../utils/serviceCatalog";

const VALID_UNITS = ["kg", "piece", "pair"];

const STATUS_BY_VALUE = Object.fromEntries(SERVICE_STATUSES.map((s) => [s.value, s]));
const CATEGORY_LABEL = Object.fromEntries(SERVICE_CATEGORIES.map((c) => [c.value, c.label]));

const priceSummary = (s) => {
  const parts = [];
  if (!VALID_UNITS.includes(s.unit)) parts.push("⚠ no unit");
  if (Number(s.rateByKg) > 0) parts.push(`₹${s.rateByKg}/kg`);
  if (Number(s.rateByPair) > 0) parts.push(`₹${s.rateByPair}/pair`);
  else if (Number(s.rateByPiece) > 0) parts.push(`₹${s.rateByPiece}/pc`);
  const iu = instantUnitOf(s.serviceName);
  if (iu === "kg" && Number(s.instantRateByKg) > 0) parts.push(`Instant ₹${s.instantRateByKg}/kg`);
  else if (iu === "piece" && Number(s.instantRateByPiece) > 0) parts.push(`Instant ₹${s.instantRateByPiece}/pc`);
  else if (iu) parts.push("Instant 2× regular");
  if (Array.isArray(s.subServices) && s.subServices.length) parts.push(`${s.subServices.length} sub`);
  return parts.join(" · ") || "—";
};

export default function AdminServices() {
  const navigate = useNavigate();
  const { client, logout, isViewer } = useHostelAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [services, setServices] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(undefined); // undefined: closed, null: new
  const [dragId, setDragId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [flags, setFlags] = useState([]);

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

  // Live: edits from another admin (or the console) show up immediately.
  useEffect(
    () =>
      onSnapshot(
        collection(db, "prices"),
        (snap) => setServices(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            // Empty docs left over from the Firebase console are not services.
            .filter((s) => String(s.serviceName || "").trim()),
        ),
        (err) => setLoadError(err.message),
      ),
    [],
  );

  // Services a rider added with a unit they chose, because none was set here.
  useEffect(
    () =>
      onSnapshot(
        collection(db, "catalog_flags"),
        (snap) => setFlags(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => setFlags([]), // viewers can't read flags
      ),
    [],
  );

  const missingUnit = useMemo(
    () => (services || []).filter((s) => serviceStatusOf(s) !== "archived" && !VALID_UNITS.includes(s.unit)),
    [services],
  );

  const handleSidebarTabChange = useCallback((tab) => {
    setIsMobileMenuOpen(false);
    if (tab === "services") return;
    if (tab === "regular") { navigate("/admin/regular-orders"); return; }
    if (tab === "investors") { navigate("/admin/investors"); return; }
    if (tab === "expenses") { navigate("/admin/expenses"); return; }
    if (tab === "salaries") { navigate("/admin/salaries"); return; }
    if (tab === "calculator") { navigate("/admin/calculator"); return; }
    if (tab === "dailyReport") { navigate("/admin/daily-report"); return; }
    if (tab === "metaleads") { navigate("/admin/meta-leads"); return; }
    navigate("/admin", { state: { initialTab: tab } });
  }, [navigate]);

  const counts = useMemo(() => {
    const c = { active: 0, hidden: 0, archived: 0 };
    for (const s of services || []) c[serviceStatusOf(s)] += 1;
    return c;
  }, [services]);

  // Category → services, in display order.
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map();
    for (const s of services || []) {
      if (serviceStatusOf(s) !== statusFilter) continue;
      if (q && !String(s.serviceName || "").toLowerCase().includes(q)) continue;
      const cat = canonicalCategory(s.category);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(s);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (Number(a.displayOrder) || 999) - (Number(b.displayOrder) || 999) ||
        String(a.serviceName).localeCompare(String(b.serviceName)));
    }
    const order = SERVICE_CATEGORIES.map((c) => c.value);
    return [...map.entries()].sort(([a], [b]) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
  }, [services, statusFilter, query]);

  // Mirrors the app's Instant section (instant_catalog.dart): the first active
  // service per Instant name that has a regular rate in its unit.
  const instantServices = useMemo(() => {
    if (statusFilter !== "active") return [];
    const q = query.trim().toLowerCase();
    const seen = new Set();
    const out = [];
    for (const s of services || []) {
      const unit = instantUnitOf(s.serviceName);
      if (!unit || serviceStatusOf(s) !== "active") continue;
      if (!(Number(unit === "kg" ? s.rateByKg : s.rateByPiece) > 0)) continue;
      const key = String(s.serviceName).trim().toLowerCase();
      if (seen.has(key)) continue;
      if (q && !key.includes(q)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }, [services, statusFilter, query]);

  const run = async (fn) => {
    setActionError("");
    try { await fn(); } catch (err) { setActionError(describeCatalogError(err)); }
  };

  const handleDrop = (list, targetId) => {
    const from = list.findIndex((s) => s.id === dragId);
    const to = list.findIndex((s) => s.id === targetId);
    setDragId(null);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    run(() => reorderServices(next));
  };

  const canReorder = !isViewer && !query.trim();

  return (
    <div className="flex min-h-screen bg-[#F1F5F9]" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <AdminSidebar
        activeTab="services"
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
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
                aria-label="Open sidebar"
              >
                <FiMenu size={20} />
              </button>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Admin Portal</p>
                <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-slate-950">
                  <FiTag size={20} className="text-blue-500" />
                  Service Catalog
                </h1>
              </div>
            </div>
            {!isViewer && (
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-700"
              >
                <FiPlus size={16} /> New service
              </button>
            )}
          </div>
        </header>

        <div className="space-y-4 p-4 lg:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              {SERVICE_STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  title={s.hint}
                  onClick={() => setStatusFilter(s.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${statusFilter === s.value ? s.tone : "border-slate-200 bg-white text-slate-500"}`}
                >
                  {s.label} <span className="opacity-60">{counts[s.value]}</span>
                </button>
              ))}
            </div>
            <div className="relative sm:w-72">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500">{STATUS_BY_VALUE[statusFilter].hint}. {canReorder && "Drag rows to change the order customers see."}</p>

          {(loadError || actionError) && (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>{loadError || actionError}</span>
              {actionError && !loadError && (
                <button type="button" onClick={() => setActionError("")} className="font-semibold text-red-500 hover:text-red-700">Dismiss</button>
              )}
            </div>
          )}

          {(missingUnit.length > 0 || flags.length > 0) && (
            <section className="overflow-hidden rounded-xl border border-amber-300 bg-white shadow-sm">
              <h2 className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-amber-700">
                Needs attention <span className="text-amber-500">· {missingUnit.length + flags.length}</span>
                <span className="ml-2 normal-case tracking-normal font-medium text-amber-600">Set a unit so riders and customers see the right price</span>
              </h2>
              <ul className="divide-y divide-slate-100">
                {missingUnit.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => setEditing(s)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50">
                      <span className="text-sm font-bold text-slate-800">{s.serviceName}</span>
                      <span className="text-xs text-amber-700">No unit set</span>
                    </button>
                  </li>
                ))}
                {flags.map((f) => {
                  const svc = (services || []).find((s) => String(s.serviceName || "").trim().toLowerCase() === String(f.serviceName || "").trim().toLowerCase());
                  return (
                    <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <button type="button" disabled={!svc} onClick={() => svc && setEditing(svc)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-bold text-slate-800">{f.serviceName}</p>
                        <p className="truncate text-xs text-slate-500">Rider billed it per {f.unit} on order {f.orderId}</p>
                      </button>
                      {!isViewer && (
                        <button type="button" onClick={() => run(() => resolveCatalogFlag(f.id))} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                          Done
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {services === null ? (
            <DashboardSkeleton />
          ) : grouped.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              No {STATUS_BY_VALUE[statusFilter].label.toLowerCase()} services{query ? ` matching "${query}"` : ""}.
            </div>
          ) : (
            grouped.map(([category, list]) => (
              <section key={category} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <h2 className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                  {CATEGORY_LABEL[category] || `${category} · not shown in the app`} <span className="text-slate-400">· {list.length}</span>
                </h2>
                <ul className="divide-y divide-slate-100">
                  {list.map((s) => (
                    <li
                      key={s.id}
                      draggable={canReorder}
                      onDragStart={() => setDragId(s.id)}
                      onDragOver={(e) => canReorder && e.preventDefault()}
                      onDrop={() => handleDrop(list, s.id)}
                      className={`flex items-center gap-3 px-4 py-3 ${dragId === s.id ? "opacity-40" : ""}`}
                    >
                      {canReorder && <FiMove className="cursor-grab text-slate-300" size={16} />}
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-[9px] text-slate-400">
                        {s.imageUrl ? <img src={s.imageUrl} alt="" className="h-full w-full object-cover" /> : (s.imageId || "—")}
                      </div>
                      <button type="button" onClick={() => setEditing(s)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-bold text-slate-800">{s.serviceName || "(no name)"}</p>
                        <p className="truncate text-xs text-slate-500">
                          {priceSummary(s)}
                        </p>
                      </button>
                      {!isViewer && (
                        <select
                          aria-label="Status"
                          value={serviceStatusOf(s)}
                          onChange={(e) => run(() => setServiceStatus(s, e.target.value))}
                          className={`rounded-lg border px-2 py-1 text-xs font-semibold ${STATUS_BY_VALUE[serviceStatusOf(s)].tone}`}
                        >
                          {SERVICE_STATUSES.map((st) => <option key={st.value} value={st.value}>{st.label}</option>)}
                        </select>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}

          {instantServices.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm">
              <h2 className="border-b border-violet-100 bg-violet-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-violet-600">
                Andes Instant <span className="text-violet-400">· {instantServices.length}</span>
                <span className="ml-2 normal-case tracking-normal font-medium text-violet-500">Instant price set on the service, or 2× regular when empty</span>
              </h2>
              <ul className="divide-y divide-slate-100">
                {instantServices.map((s) => {
                  const kg = instantUnitOf(s.serviceName) === "kg";
                  const rate = Number(kg ? s.instantRateByKg : s.instantRateByPiece);
                  const base = Number(kg ? s.rateByKg : s.rateByPiece);
                  return (
                    <li key={s.id}>
                      <button type="button" onClick={() => setEditing(s)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50">
                        <span className="text-sm font-bold text-slate-800">{s.serviceName}</span>
                        <span className="text-xs text-slate-500">
                          ₹{rate > 0 ? rate : base * 2}/{kg ? "kg" : "pc"}{rate > 0 ? "" : " (2× regular)"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </main>

      {editing !== undefined && (
        <ServiceEditor
          key={editing?.id || "new"}
          service={editing}
          allServices={services || []}
          readOnly={isViewer}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
