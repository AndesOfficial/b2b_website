import { useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiAlertTriangle, FiPlus, FiX, FiCheck, FiEdit2, FiTrash2, FiLayers, FiUser, FiHome, FiImage, FiExternalLink } from "react-icons/fi";
import EmptyState from "../Shared/EmptyState";
import { formatTimeSlot } from "../../utils/formatUtils";
import { useHostelAuth } from "../../context/HostelAuthContext";

const ISSUE_TYPES = [
  // Manager-entered types
  "Missing Clothes", "Damaged / Torn Clothes", "Wrong Clothes Delivered",
  "Late Delivery", "Poor Washing Quality", "Stains Not Removed", "Wrong Tag / Mixed",
  "Weight Mismatch", "Incorrect Billing", "Staff Behaviour", "Delay in Processing",
  // Admin & Other types
  "Missing Items", "Damage", "Quality Issue", "Stain Issue", "Return Pending", "Weight Dispute", "Bags Pending", "Other",
];

const SEVERITY_ORDER = { critical: 0, high: 1, pending: 2 };
const TYPE_COLORS = {
  "Missing Clothes": "#DC2626", "Missing Items": "#DC2626",
  "Damaged / Torn Clothes": "#D97706", "Damage": "#D97706",
  "Wrong Clothes Delivered": "#0891B2", "Wrong Tag / Mixed": "#0891B2",
  "Late Delivery": "#F59E0B", "Delay in Processing": "#F59E0B",
  "Poor Washing Quality": "#7C3AED", "Quality Issue": "#7C3AED",
  "Stains Not Removed": "#9333EA", "Stain Issue": "#9333EA",
  "Incorrect Billing": "#BE185D", "Weight Mismatch": "#BE185D", "Weight Dispute": "#BE185D",
  "Staff Behaviour": "#6B7280", "Return Pending": "#0891B2", "Bags Pending": "#DC2626", "Other": "#374151",
};

export default function AdminIssuesTab({ orders, onAddIssue, onEditIssue, onDeleteIssue }) {
  const { isViewer } = useHostelAuth();
  const [activeSection, setActiveSection] = useState("manager"); // "manager" | "customer" | "all"
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    id: null, date: "", issueType: "Missing Clothes", description: "",
    linkedHostel: "", assignedTo: "", severity: "pending", resolveStatus: "Unresolved", solution: "",
    originalService: "", source: "manager_issues", scope: "b2b",
  });
  const [statusFilter, setStatusFilter] = useState("All"); // All, Pending, Critical, Resolved
  const [managerScopeFilter, setManagerScopeFilter] = useState("All"); // All, b2b, b2c

  const isResolved = (i) => i.resolveStatus === "Resolved" || i.status === "Resolved" || i.status === "resolved";

  const allIssues = useMemo(() => orders.filter(o => o.category === "ISSUES" || o.type === "issue"), [orders]);

  const managerIssuesAll = useMemo(() => allIssues.filter(i => i.source === "manager_issues"), [allIssues]);
  const customerIssuesAll = useMemo(() => allIssues.filter(i => i.source !== "manager_issues"), [allIssues]);

  // Active list based on selected top section
  const sectionBaseIssues = useMemo(() => {
    if (activeSection === "manager") return managerIssuesAll;
    if (activeSection === "customer") return customerIssuesAll;
    return allIssues;
  }, [activeSection, managerIssuesAll, customerIssuesAll, allIssues]);

  // Filtered issues for display
  const issues = useMemo(() => {
    let list = sectionBaseIssues;

    // Status filter
    if (statusFilter === "Pending") {
      list = list.filter(i => !isResolved(i));
    } else if (statusFilter === "Critical") {
      list = list.filter(i => (i.severity === "critical" || i.severity === "high") && !isResolved(i));
    } else if (statusFilter === "Resolved") {
      list = list.filter(isResolved);
    }

    // Manager Scope filter (if on manager section or all section)
    if (activeSection === "manager" && managerScopeFilter !== "All") {
      list = list.filter(i => i.scope === managerScopeFilter);
    }

    return [...list].sort((a, b) => {
      const aSev = SEVERITY_ORDER[a.severity] ?? 99;
      const bSev = SEVERITY_ORDER[b.severity] ?? 99;
      if (aSev !== bSev) return aSev - bSev;
      const dateA = new Date(a.date || a.createdAtRaw || 0);
      const dateB = new Date(b.date || b.createdAtRaw || 0);
      return dateB - dateA;
    });
  }, [sectionBaseIssues, statusFilter, managerScopeFilter, activeSection]);

  // KPI calculations
  const managerKpis = useMemo(() => ({
    total: managerIssuesAll.length,
    pending: managerIssuesAll.filter(i => !isResolved(i)).length,
    critical: managerIssuesAll.filter(i => (i.severity === "critical" || i.severity === "high") && !isResolved(i)).length,
    resolved: managerIssuesAll.filter(isResolved).length,
    b2b: managerIssuesAll.filter(i => i.scope === "b2b").length,
    b2c: managerIssuesAll.filter(i => i.scope === "b2c").length,
  }), [managerIssuesAll]);

  const customerKpis = useMemo(() => ({
    total: customerIssuesAll.length,
    pending: customerIssuesAll.filter(i => !isResolved(i)).length,
    critical: customerIssuesAll.filter(i => i.severity === "critical" && !isResolved(i)).length,
    resolved: customerIssuesAll.filter(isResolved).length,
  }), [customerIssuesAll]);

  const allKpis = useMemo(() => ({
    total: allIssues.length,
    pending: allIssues.filter(i => !isResolved(i)).length,
    critical: allIssues.filter(i => (i.severity === "critical" || i.severity === "high") && !isResolved(i)).length,
    resolved: allIssues.filter(isResolved).length,
  }), [allIssues]);

  const activeKpis = activeSection === "manager" ? managerKpis : activeSection === "customer" ? customerKpis : allKpis;

  const openEditModal = (issue) => {
    setForm({
      id: issue.id,
      date: issue.date || "",
      issueType: issue.issueType || "Missing Clothes",
      description: issue.service || issue.description || issue.title || "",
      linkedHostel: issue.linkedEntity || issue.linkedHostel || "",
      assignedTo: typeof issue.reportedBy === "string" ? issue.reportedBy : (issue.reportedBy?.name || "Manager"),
      severity: issue.severity || "pending",
      resolveStatus: issue.resolveStatus || "Unresolved",
      solution: issue.solution || "",
      originalService: issue.service || "",
      source: issue.source || (activeSection === "manager" ? "manager_issues" : "admin"),
      scope: issue.scope || "b2b",
    });
    setShowModal(true);
  };

  const handleQuickToggleResolve = (issue) => {
    if (!onEditIssue || isViewer) return;
    const currentlyResolved = isResolved(issue);
    const nextResolveStatus = currentlyResolved ? "Unresolved" : "Resolved";
    onEditIssue({
      ...issue,
      resolveStatus: nextResolveStatus,
      status: nextResolveStatus === "Resolved" ? "Resolved" : "Pending",
    });
  };

  const handleSubmit = () => {
    const descriptionValue = (form.description || form.originalService || "").trim();
    if (!descriptionValue && !form.id) return;
    const issueData = {
      property: form.linkedHostel || "Issues",
      category: "ISSUES",
      type: "issue",
      date: form.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0],
      amount: 0,
      service: descriptionValue,
      description: descriptionValue,
      title: `${form.issueType} - ${form.linkedHostel || 'Issue'}`,
      issueType: form.issueType,
      severity: form.severity,
      resolveStatus: form.resolveStatus,
      status: form.resolveStatus === "Resolved" ? "Resolved" : "Pending",
      reportedBy: form.assignedTo || "Manager",
      solution: form.solution,
      linkedEntity: form.linkedHostel,
      linkedHostel: form.linkedHostel,
      scope: form.scope,
      source: form.source || (activeSection === "manager" ? "manager_issues" : "admin"),
    };

    if (form.id) {
      issueData.id = form.id;
      onEditIssue(issueData);
    } else {
      issueData.id = `issue-manager-${Date.now()}`;
      onAddIssue(issueData);
    }

    setShowModal(false);
    setForm({ id: null, date: "", issueType: "Missing Clothes", description: "", linkedHostel: "", assignedTo: "", severity: "pending", resolveStatus: "Unresolved", solution: "", originalService: "", source: "manager_issues", scope: "b2b" });
  };

  return (
    <div className="space-y-6" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* ── Top Section Selector: Manager Issues vs Customer Complaints vs All ── */}
      <div className="flex items-center justify-between border-b border-gray-200 overflow-x-auto pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setActiveSection("manager"); setStatusFilter("All"); }}
            className={`flex items-center gap-2 px-5 py-3 text-[14px] font-bold border-b-2 transition-all whitespace-nowrap -mb-px ${
              activeSection === "manager"
                ? "border-indigo-600 text-indigo-600 bg-indigo-50/50"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-black">
              ⚡
            </span>
            <span>Manager Logged Issues</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-indigo-100 text-indigo-700">
              {managerIssuesAll.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveSection("customer"); setStatusFilter("All"); }}
            className={`flex items-center gap-2 px-5 py-3 text-[14px] font-bold border-b-2 transition-all whitespace-nowrap -mb-px ${
              activeSection === "customer"
                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-black">
              👥
            </span>
            <span>Customer & Hostel Complaints</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-700">
              {customerIssuesAll.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveSection("all"); setStatusFilter("All"); }}
            className={`flex items-center gap-2 px-5 py-3 text-[14px] font-bold border-b-2 transition-all whitespace-nowrap -mb-px ${
              activeSection === "all"
                ? "border-slate-800 text-slate-900 bg-slate-100/50"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <span>All Issues</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-600">
              {allIssues.length}
            </span>
          </button>
        </div>

        {onAddIssue && !isViewer && (
          <div className="pb-2">
            <button
              onClick={() => {
                setForm({
                  id: null, date: "", issueType: "Missing Clothes", description: "",
                  linkedHostel: "", assignedTo: "", severity: "pending", resolveStatus: "Unresolved",
                  solution: "", originalService: "", source: activeSection === "manager" ? "manager_issues" : "admin",
                  scope: "b2b",
                });
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-[12px] font-black rounded-xl transition-all shadow-sm uppercase tracking-wider"
            >
              <FiPlus size={16} /> Log Issue
            </button>
          </div>
        )}
      </div>

      {/* ── Informational Header for Manager Section ── */}
      {activeSection === "manager" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-indigo-50/90 via-blue-50/50 to-white border border-indigo-100 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
              ⚡
            </div>
            <div>
              <h3 className="text-[14px] font-black text-slate-900 tracking-tight">Manager Dashboard Operational Issues</h3>
              <p className="text-[12px] font-medium text-slate-500">Live operational issues reported in real-time by facility and operations managers across B2B clients and B2C retail.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync (manager_issues)
            </span>
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className={`grid grid-cols-2 ${activeSection === "manager" ? "lg:grid-cols-4" : "sm:grid-cols-3"} gap-4`}>
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Pending" ? "All" : "Pending")}
          className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 text-left transition-all hover:shadow-md ${statusFilter === "Pending" ? "ring-2 ring-amber-500" : ""}`}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
              <FiClock size={16} />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending</span>
          </div>
          <p className="text-[28px] font-black text-amber-600 tracking-tight leading-none">{activeKpis.pending}</p>
          <p className="text-[11px] font-bold text-slate-400">Not yet resolved</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Critical" ? "All" : "Critical")}
          className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 text-left transition-all hover:shadow-md ${statusFilter === "Critical" ? "ring-2 ring-red-500" : ""}`}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500">
              <FiAlertTriangle size={16} />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Critical / High</span>
          </div>
          <p className="text-[28px] font-black text-red-600 tracking-tight leading-none">{activeKpis.critical}</p>
          <p className="text-[11px] font-bold text-slate-400">High priority open</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "Resolved" ? "All" : "Resolved")}
          className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 text-left transition-all hover:shadow-md ${statusFilter === "Resolved" ? "ring-2 ring-emerald-500" : ""}`}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
              <FiCheckCircle size={16} />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resolved</span>
          </div>
          <p className="text-[28px] font-black text-emerald-600 tracking-tight leading-none">{activeKpis.resolved}</p>
          <p className="text-[11px] font-bold text-slate-400">Closed / Completed</p>
        </button>

        {activeSection === "manager" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scope Split</span>
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-[11px] font-bold text-blue-600 uppercase">B2B Clients</p>
                <p className="text-xl font-black text-slate-900">{managerKpis.b2b}</p>
              </div>
              <div className="h-8 w-px bg-slate-100" />
              <div>
                <p className="text-[11px] font-bold text-purple-600 uppercase">B2C Retail</p>
                <p className="text-xl font-black text-slate-900">{managerKpis.b2c}</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold">Total {managerKpis.total} manager reports</p>
          </div>
        )}
      </div>

      {/* ── Filters Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm transition-all flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="All">All Statuses ({sectionBaseIssues.length})</option>
            <option value="Pending">Pending Only</option>
            <option value="Critical">Critical & High Only</option>
            <option value="Resolved">Resolved Only</option>
          </select>
        </div>

        {activeSection === "manager" && (
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scope:</label>
            <select
              value={managerScopeFilter}
              onChange={(e) => setManagerScopeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">All Scopes ({managerIssuesAll.length})</option>
              <option value="b2b">B2B Clients Only ({managerKpis.b2b})</option>
              <option value="b2c">B2C Retail Only ({managerKpis.b2c})</option>
            </select>
          </div>
        )}

        {(statusFilter !== "All" || managerScopeFilter !== "All") && (
          <button
            onClick={() => { setStatusFilter("All"); setManagerScopeFilter("All"); }}
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors ml-auto"
          >
            <FiX size={14} /> Clear Filters
          </button>
        )}
      </div>

      {/* ── Issues List ── */}
      <div className="space-y-4">
        {issues.map(issue => {
          const resolved = isResolved(issue);
          const isManager = issue.source === "manager_issues";

          return (
            <div
              key={issue.id}
              className={`bg-white rounded-2xl border shadow-sm p-5 sm:p-6 transition-all hover:shadow-md ${
                issue.severity === "critical"
                  ? "border-red-300 border-l-4 border-l-red-600 bg-red-50/10"
                  : issue.severity === "high"
                  ? "border-amber-200 border-l-4 border-l-amber-500"
                  : "border-gray-100"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Badges Column */}
                <div className="flex flex-row sm:flex-col gap-2 shrink-0 sm:min-w-[130px]">
                  <span
                    className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider text-center"
                    style={{
                      backgroundColor: (TYPE_COLORS[issue.issueType] || "#6B7280") + "18",
                      color: TYPE_COLORS[issue.issueType] || "#6B7280",
                    }}
                  >
                    {issue.issueType || "Operations Issue"}
                  </span>

                  {issue.severity === "critical" && (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white uppercase tracking-widest text-center shadow-xs">
                      Critical
                    </span>
                  )}
                  {issue.severity === "high" && (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white uppercase tracking-widest text-center shadow-xs">
                      High Priority
                    </span>
                  )}

                  {isManager && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-widest text-center">
                      Manager Issue
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {issue.scope === "b2b" && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                        B2B Client
                      </span>
                    )}
                    {issue.scope === "b2c" && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                        B2C Retail
                      </span>
                    )}
                    {issue.linkedEntity && (
                      <span className="text-[11px] font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                        {issue.linkedEntity}
                      </span>
                    )}
                    {issue.room && (
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-md">
                        Room {issue.room}
                      </span>
                    )}
                  </div>

                  <p className="text-[14px] font-bold text-slate-900 leading-relaxed mt-1">
                    {issue.service || issue.description || issue.title || "No description provided."}
                  </p>

                  {/* Photo Proofs */}
                  {issue.photoUrls?.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <FiImage size={12} /> Proof Photos:
                      </span>
                      {issue.photoUrls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group/img relative inline-block overflow-hidden rounded-lg border border-slate-200 hover:border-indigo-500 transition-all shadow-xs"
                          title="Click to view full photo in new tab"
                        >
                          <img
                            src={url}
                            alt={`proof-${i + 1}`}
                            className="w-12 h-12 object-cover group-hover/img:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white transition-opacity">
                            <FiExternalLink size={12} />
                          </div>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Solution / Resolution Note */}
                  {issue.solution && (
                    <div className="mt-3 p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-[12px] text-emerald-900 font-medium">
                      <strong className="font-black uppercase tracking-wider text-emerald-800 block text-[10px] mb-0.5">Resolution Notes:</strong>
                      {issue.solution}
                    </div>
                  )}

                  {/* Metadata Row */}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>📅 {issue.date}</span>
                    {issue.reportedBy && (
                      <span className="text-slate-600">
                        👤 Reported by: <strong className="text-slate-800">{issue.reportedBy}</strong>
                      </span>
                    )}
                    {issue.customerName && issue.customerName !== issue.reportedBy && (
                      <span className="text-fuchsia-600">
                        Student: {issue.customerName}
                      </span>
                    )}
                    {issue.pickupDate && (
                      <span className="text-teal-600">
                        Pickup: {formatTimeSlot(issue.pickupDate)}
                      </span>
                    )}
                    {issue.deliveryDate && (
                      <span className="text-orange-600">
                        Delivery: {formatTimeSlot(issue.deliveryDate)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status & Actions Column */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <span
                    className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase border tracking-wider ${
                      resolved
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : issue.resolveStatus === "Checking"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}
                  >
                    {issue.resolveStatus || (resolved ? "Resolved" : "Unresolved")}
                  </span>

                  {!isViewer && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleQuickToggleResolve(issue)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shadow-xs ${
                          resolved
                            ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                        title={resolved ? "Re-open issue" : "Mark as resolved"}
                      >
                        {resolved ? "Re-open" : "Mark Resolved"}
                      </button>

                      {onEditIssue && (
                        <button
                          onClick={() => openEditModal(issue)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit issue"
                        >
                          <FiEdit2 size={15} />
                        </button>
                      )}

                      {onDeleteIssue && (
                        <button
                          onClick={() => onDeleteIssue(issue)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete issue"
                        >
                          <FiTrash2 size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {issues.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden py-14">
            <EmptyState
              icon={FiCheckCircle}
              title={
                activeSection === "manager"
                  ? "No manager operational issues logged"
                  : activeSection === "customer"
                  ? "No customer complaints recorded"
                  : "All clear — zero outstanding issues"
              }
              message={
                activeSection === "manager"
                  ? "When operations managers report issues from the Andes Manager Dashboard, they will automatically sync and appear here in real-time."
                  : activeSection === "customer"
                  ? "No complaints received from students or customer apps for this filter."
                  : "There are no issues matching the current status filter."
              }
            />
          </div>
        )}
      </div>

      {/* ── Modal for Adding / Modifying Issues ── */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-w-lg flex flex-col overflow-hidden animate-slide-up sm:animate-fade-in max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
            <div className="flex items-center justify-between p-6 sm:p-8 border-b border-gray-100 bg-slate-50/50 shrink-0">
              <div>
                <h2 className="text-lg font-black text-[#0F172A] tracking-tight">
                  {form.id ? 'Modify Issue Record' : 'Log Operational Issue'}
                </h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Andes Operations & Quality Control
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                <FiX size={22} />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-5 overflow-y-auto flex-1">
              {/* Scope & Source */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Scope</label>
                  <select
                    value={form.scope}
                    onChange={e => setForm({ ...form, scope: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
                  >
                    <option value="b2b">B2B Client / Hostel</option>
                    <option value="b2c">B2C Retail Customer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Category</label>
                  <select
                    value={form.issueType}
                    onChange={e => setForm({ ...form, issueType: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
                  >
                    {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Severity</label>
                  <select
                    value={form.severity}
                    onChange={e => setForm({ ...form, severity: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black text-slate-700 focus:bg-white focus:outline-none uppercase"
                  >
                    <option value="pending">Standard</option>
                    <option value="high">High Priority</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  {form.scope === "b2b" ? "Linked Client / Hostel" : "Customer Name or Order ID"}
                </label>
                <input
                  type="text"
                  value={form.linkedHostel}
                  onChange={e => setForm({ ...form, linkedHostel: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
                  placeholder={form.scope === "b2b" ? "e.g., Hostel 99, Tribe..." : "e.g., John Doe / #ORD-1234"}
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Reported By</label>
                <input
                  type="text"
                  value={form.assignedTo}
                  onChange={e => setForm({ ...form, assignedTo: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
                  placeholder="Manager or Admin Name"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Issue Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none resize-none transition-all"
                  placeholder="Explain the issue clearly (e.g. 2 chef coats missing from batch #2, or white shirt had grease stains)..."
                />
              </div>

              {form.id && (
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Resolution Status</label>
                    <select
                      value={form.resolveStatus}
                      onChange={e => setForm({ ...form, resolveStatus: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 focus:bg-white focus:outline-none"
                    >
                      <option value="Unresolved">Unresolved</option>
                      <option value="Checking">Under Investigation</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Resolution Notes</label>
                    <textarea
                      value={form.solution}
                      onChange={e => setForm({ ...form, solution: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-emerald-800 focus:bg-white focus:border-emerald-500 focus:outline-none resize-none transition-all"
                      placeholder="What was done to resolve this issue?"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-slate-50/50 flex gap-3 shrink-0">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-black text-[12px] rounded-xl hover:bg-slate-100 transition-all uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.description && !form.id}
                className="flex-[2] py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-[12px] rounded-xl transition-all shadow-md active:scale-95 uppercase tracking-wider"
              >
                {form.id ? 'Save Changes' : 'Submit Issue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
