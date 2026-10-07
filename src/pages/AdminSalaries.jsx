import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiUsers,
  FiDollarSign,
  FiCalendar,
  FiPlus,
  FiSearch,
  FiFilter,
  FiCheckCircle,
  FiClock,
  FiTrendingUp,
  FiCreditCard,
  FiEye,
  FiEdit2,
  FiRefreshCw,
  FiMenu,
  FiAlertCircle,
} from "react-icons/fi";
import { FaIndianRupeeSign } from "react-icons/fa6";
import AdminSidebar from "../components/Layout/AdminSidebar";
import LoadingSpinner from "../components/Shared/LoadingSpinner";
import { useHostelAuth } from "../context/HostelAuthContext";
import { useSalaryData } from "../hooks/useSalaryData";
import {
  calculateDashboardMetrics,
  formatCurrency,
  isThursday,
} from "../utils/salaryEngine";
import {
  AddEditWorkerModal,
  ChangeSalaryModal,
  AddAdjustmentModal,
  RecordPaymentModal,
} from "../components/Salaries/SalaryModals";
import AttendanceSheetModal from "../components/Salaries/AttendanceSheetModal";
import WorkerDetailModal from "../components/Salaries/WorkerDetailModal";

export default function AdminSalaries() {
  const navigate = useNavigate();
  const { client, logout } = useHostelAuth();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Responsive sidebar
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

  const handleSidebarTabChange = useCallback((tab) => {
    setIsMobileMenuOpen(false);
    if (tab === "salaries") return;
    if (tab === "regular") { navigate("/admin/regular-orders"); return; }
    if (tab === "investors") { navigate("/admin/investors"); return; }
    if (tab === "expenses") { navigate("/admin/expenses"); return; }
    if (tab === "calculator") { navigate("/admin/calculator"); return; }
    if (tab === "metaleads") { navigate("/admin/meta-leads"); return; }
    if (tab === "dailyReport") { navigate("/admin/daily-report"); return; }
    if (tab === "services") { navigate("/admin/services"); return; }
    navigate("/admin", { state: { initialTab: tab } });
  }, [navigate]);

  // Salary data hook
  const {
    workers,
    attendance,
    attendanceMap,
    adjustments,
    payments,
    loading: salaryLoading,
    saveWorker,
    changeSalaryRate,
    markAttendance,
    addAdjustment,
    recordPayment,
    seedInitialData,
  } = useSalaryData();

  // Period / Month Selector: Defaults to current month ("YYYY-MM")
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return new Date().toISOString().slice(0, 7);
  });

  // Ensure background sync/seed runs once without blocking the UI
  useEffect(() => {
    seedInitialData();
  }, [seedInitialData]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");

  // Modals state
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [showChangeSalaryModal, setShowChangeSalaryModal] = useState(false);
  const [selectedWorkerForSalary, setSelectedWorkerForSalary] = useState(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [defaultWorkerForAdj, setDefaultWorkerForAdj] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [defaultWorkerForPay, setDefaultWorkerForPay] = useState("");
  const [detailWorker, setDetailWorker] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Month options for dropdown
  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 8; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      opts.push({ val, label });
    }
    return opts;
  }, []);

  // Compute metrics across all active workers
  const metrics = useMemo(() => {
    return calculateDashboardMetrics(
      workers,
      selectedMonth,
      attendanceMap,
      adjustments,
      payments
    );
  }, [workers, selectedMonth, attendanceMap, adjustments, payments]);

  // Unique roles for filter dropdown
  const uniqueRoles = useMemo(() => {
    const roles = new Set(workers.map((w) => w.role).filter(Boolean));
    return ["All", ...Array.from(roles)];
  }, [workers]);

  // Filtered workers list for main table
  const filteredSummaries = useMemo(() => {
    return metrics.workerSummaries.filter((w) => {
      // Search by name
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = w.workerName.toLowerCase().includes(q);
        const matchesRole = (w.role || "").toLowerCase().includes(q);
        if (!matchesName && !matchesRole) return false;
      }

      // Filter by Role
      if (roleFilter !== "All" && w.role !== roleFilter) {
        return false;
      }

      // Filter by Payment Status
      if (paymentFilter === "Paid") {
        if (w.remainingAmount > 0 || w.totalAccrued === 0) return false;
      } else if (paymentFilter === "Pending") {
        if (w.remainingAmount === 0) return false;
      } else if (paymentFilter === "Partially Paid") {
        if (w.totalPaid === 0 || w.remainingAmount === 0) return false;
      }

      return true;
    });
  }, [metrics.workerSummaries, searchQuery, roleFilter, paymentFilter]);

  const handleOpenDetail = (workerSummary) => {
    const fullWorker = workers.find((w) => w.id === workerSummary.workerId);
    if (fullWorker) {
      setDetailWorker(fullWorker);
      setShowDetailModal(true);
    }
  };

  const handleOpenChangeSalary = (worker) => {
    setSelectedWorkerForSalary(worker);
    setShowChangeSalaryModal(true);
  };

  const handleOpenAdjustment = (workerId = "") => {
    setDefaultWorkerForAdj(workerId);
    setShowAdjustmentModal(true);
  };

  const handleOpenPayment = (workerId = "") => {
    setDefaultWorkerForPay(workerId);
    setShowPaymentModal(true);
  };

  const isTodayThursday = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return isThursday(todayStr);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F1F5F9]" style={{ fontFamily: "DM Sans, sans-serif" }}>
      {/* Sidebar */}
      <AdminSidebar
        activeTab="salaries"
        setActiveTab={handleSidebarTabChange}
        user={client}
        onLogout={logout}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />

      {/* Main Content Area */}
      <main
        className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ${
          isSidebarCollapsed ? "lg:ml-[80px]" : "lg:ml-[220px]"
        } ml-0`}
      >
        {/* Sticky Header */}
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
                <div className="flex items-center gap-2">
                  <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
                    Salary Management
                  </h1>
                  {isTodayThursday ? (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
                      <FiClock size={12} /> Today: Thursday Weekly Off
                    </span>
                  ) : (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
                      <FiCheckCircle size={12} /> Normal Working Day
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                  Automated daily wage expenses, attendance tracking, and monthly salary disbursements
                </p>
              </div>
            </div>

            {/* Top Bar Actions */}
            <div className="flex items-center gap-2.5">
              {/* Period Dropdown */}
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs lg:text-sm font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {monthOptions.map((opt) => (
                    <option key={opt.val} value={opt.val}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sync Team Button */}
              <button
                type="button"
                onClick={() => seedInitialData()}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs lg:text-sm font-bold shadow-sm transition-colors flex items-center gap-1.5"
                title="Sync all 8 operational workers"
              >
                <FiRefreshCw size={14} className="text-blue-600" />
                <span className="hidden xl:inline">Sync Team</span>
              </button>

              {/* Attendance Button */}
              <button
                type="button"
                onClick={() => setShowAttendanceModal(true)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs lg:text-sm font-bold shadow-sm transition-colors flex items-center gap-1.5"
                title="Mark daily attendance overrides"
              >
                <FiCalendar size={15} className="text-blue-600" />
                <span className="hidden md:inline">Attendance</span>
              </button>

              {/* Overtime Button */}
              <button
                type="button"
                onClick={() => handleOpenAdjustment()}
                className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs lg:text-sm font-bold transition-colors flex items-center gap-1.5"
                title="Add overtime or extra work payment"
              >
                <FiPlus size={15} />
                <span className="hidden md:inline">Overtime</span>
              </button>

              {/* Record Payment Button */}
              <button
                type="button"
                onClick={() => handleOpenPayment()}
                className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs lg:text-sm font-bold transition-colors flex items-center gap-1.5"
                title="Record salary payment"
              >
                <FiCreditCard size={15} />
                <span className="hidden md:inline">Pay</span>
              </button>

              {/* Add Worker Button */}
              <button
                type="button"
                onClick={() => {
                  setEditingWorker(null);
                  setShowAddWorkerModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs lg:text-sm font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <FiPlus size={16} />
                <span>Add Worker</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page Body Container */}
        <div className="flex-1 p-4 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* 7 KPI Dashboard Summary Cards (Section 14) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5">
            {/* 1. Total Workers */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Workers</span>
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FiUsers size={14} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 tracking-tight">{metrics.totalWorkers}</p>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Active team</p>
              </div>
            </div>

            {/* 2. Today's Salary Expense */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Today's Cost</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FaIndianRupeeSign size={13} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-600 tracking-tight">
                  {formatCurrency(metrics.todaySalaryExpense)}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Today's payroll</p>
              </div>
            </div>

            {/* 3. Current Month Accrued */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Accrued</span>
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FiTrendingUp size={14} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-blue-700 tracking-tight">
                  {formatCurrency(metrics.currentMonthAccrued)}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Earned to-date</p>
              </div>
            </div>

            {/* 4. Overtime */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Overtime</span>
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <FiClock size={14} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-purple-700 tracking-tight">
                  {formatCurrency(metrics.totalOvertime)}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Extra shifts</p>
              </div>
            </div>

            {/* 5. Additional Payments */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Extras</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FiPlus size={14} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-indigo-700 tracking-tight">
                  {formatCurrency(metrics.totalAdditionalPayments)}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Allowances</p>
              </div>
            </div>

            {/* 6. Total Paid */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Paid</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FiCheckCircle size={14} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-700 tracking-tight">
                  {formatCurrency(metrics.totalPaid)}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Disbursed</p>
              </div>
            </div>

            {/* 7. Pending / Remaining */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Pending</span>
                <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <FiAlertCircle size={14} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-rose-600 tracking-tight">
                  {formatCurrency(metrics.totalRemaining)}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Balance due</p>
              </div>
            </div>
          </div>

          {/* Search, Filter Bar & Table Controls */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
              <div className="relative flex-1 sm:max-w-xs">
                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search worker by name or role..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs lg:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Role Filter */}
              <div className="flex items-center gap-1.5">
                <FiFilter size={14} className="text-slate-400 hidden sm:block" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {uniqueRoles.map((r) => (
                    <option key={r} value={r}>
                      {r === "All" ? "All Roles" : r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Filter */}
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="All">All Payment Status</option>
                <option value="Pending">Pending Payment</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Fully Settled</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 self-end sm:self-center font-medium">
              Showing <strong className="text-slate-900">{filteredSummaries.length}</strong> of{" "}
              <strong className="text-slate-900">{metrics.totalWorkers}</strong> workers
            </div>
          </div>

          {/* Main Workers Table (Section 15) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs lg:text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Worker</th>
                    <th className="py-3.5 px-3">Role</th>
                    <th className="py-3.5 px-3 text-right">Monthly</th>
                    <th className="py-3.5 px-3 text-right">Daily (÷26)</th>
                    <th className="py-3.5 px-3 text-center">Worked</th>
                    <th className="py-3.5 px-3 text-right">Today's Cost</th>
                    <th className="py-3.5 px-3 text-right">Accrued</th>
                    <th className="py-3.5 px-3 text-right">Overtime</th>
                    <th className="py-3.5 px-3 text-right">Paid</th>
                    <th className="py-3.5 px-3 text-right">Pending</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredSummaries.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="py-12 text-center text-slate-400">
                        No workers found matching your search and filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredSummaries.map((summary) => {
                      const fullWorker = workers.find((w) => w.id === summary.workerId);

                      return (
                        <tr
                          key={summary.workerId}
                          onClick={() => handleOpenDetail(summary)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        >
                          {/* Worker Name & Avatar */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                                {summary.workerName.charAt(0)}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block group-hover:text-blue-600 transition-colors">
                                  {summary.workerName}
                                </span>
                                <span className="text-[11px] text-slate-400 font-normal">
                                  Joined {summary.joiningDate || "N/A"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3.5 px-3">
                            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                              {summary.role}
                            </span>
                          </td>

                          {/* Monthly Salary */}
                          <td className="py-3.5 px-3 text-right font-black text-slate-800">
                            {formatCurrency(summary.currentMonthlySalary)}
                          </td>

                          {/* Daily Wage */}
                          <td className="py-3.5 px-3 text-right font-semibold text-slate-600">
                            {formatCurrency(summary.currentDailyWage)}
                          </td>

                          {/* Days Worked */}
                          <td className="py-3.5 px-3 text-center">
                            <span className="font-extrabold text-slate-900">{summary.daysWorked}</span>
                            {summary.thursdaysWorked > 0 && (
                              <span
                                className="block text-[10px] text-purple-600 font-bold"
                                title="Thursdays worked"
                              >
                                +{summary.thursdaysWorked} Thu
                              </span>
                            )}
                          </td>

                          {/* Today's Cost & Status */}
                          <td className="py-3.5 px-3 text-right">
                            <span
                              className={`font-black ${
                                summary.todayCost > 0 ? "text-emerald-600 font-extrabold" : "text-slate-400"
                              }`}
                            >
                              {formatCurrency(summary.todayCost)}
                            </span>
                            <span className="block text-[10px] text-slate-500">
                              {summary.todayStatus === "present" && "Present"}
                              {summary.todayStatus === "thursday_worked" && "Thu Worked"}
                              {summary.todayStatus === "thursday_off" && "Weekly Off"}
                              {summary.todayStatus === "absent" && "Absent"}
                              {summary.todayStatus === "half_day" && "Half Day"}
                            </span>
                          </td>

                          {/* Total Accrued */}
                          <td className="py-3.5 px-3 text-right font-black text-blue-700">
                            {formatCurrency(summary.totalAccrued)}
                          </td>

                          {/* Overtime / Extras */}
                          <td className="py-3.5 px-3 text-right font-semibold text-purple-700">
                            {summary.overtime + summary.additionalPayments > 0
                              ? formatCurrency(summary.overtime + summary.additionalPayments)
                              : "—"}
                          </td>

                          {/* Paid Amount */}
                          <td className="py-3.5 px-3 text-right font-bold text-emerald-700">
                            {summary.totalPaid > 0 ? formatCurrency(summary.totalPaid) : "—"}
                          </td>

                          {/* Pending Amount */}
                          <td className="py-3.5 px-3 text-right font-black text-rose-600">
                            {summary.remainingAmount > 0 ? formatCurrency(summary.remainingAmount) : "₹0"}
                          </td>

                          {/* Action Buttons */}
                          <td
                            className="py-3.5 px-4 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenDetail(summary)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="View detailed salary ledger"
                              >
                                <FiEye size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenPayment(summary.workerId)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                title="Record salary payment"
                              >
                                <FiCreditCard size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (fullWorker) {
                                    setEditingWorker(fullWorker);
                                    setShowAddWorkerModal(true);
                                  }
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                title="Edit worker configuration"
                              >
                                <FiEdit2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* MODALS */}
      {/* 1. Add / Edit Worker Modal */}
      <AddEditWorkerModal
        isOpen={showAddWorkerModal}
        onClose={() => {
          setShowAddWorkerModal(false);
          setEditingWorker(null);
        }}
        onSave={saveWorker}
        worker={editingWorker}
      />

      {/* 2. Change Salary Rate Modal */}
      <ChangeSalaryModal
        isOpen={showChangeSalaryModal}
        onClose={() => {
          setShowChangeSalaryModal(false);
          setSelectedWorkerForSalary(null);
        }}
        onSave={changeSalaryRate}
        worker={selectedWorkerForSalary}
      />

      {/* 3. Daily Attendance Sheet Modal */}
      <AttendanceSheetModal
        isOpen={showAttendanceModal}
        onClose={() => setShowAttendanceModal(false)}
        workers={workers}
        attendanceMap={attendanceMap}
        onSaveAttendance={markAttendance}
      />

      {/* 4. Overtime & Extra Modal */}
      <AddAdjustmentModal
        isOpen={showAdjustmentModal}
        onClose={() => {
          setShowAdjustmentModal(false);
          setDefaultWorkerForAdj("");
        }}
        onSave={addAdjustment}
        workers={workers}
        defaultWorkerId={defaultWorkerForAdj}
      />

      {/* 5. Record Payment Modal */}
      <RecordPaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setDefaultWorkerForPay("");
        }}
        onSave={recordPayment}
        workers={workers}
        defaultWorkerId={defaultWorkerForPay}
        selectedMonth={selectedMonth}
      />

      {/* 6. Worker Detail & Daily Breakdown Modal */}
      <WorkerDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setDetailWorker(null);
        }}
        worker={detailWorker}
        selectedMonth={selectedMonth}
        attendanceMap={attendanceMap}
        adjustments={adjustments}
        payments={payments}
        onOpenChangeSalary={handleOpenChangeSalary}
        onOpenAddAdjustment={handleOpenAdjustment}
        onOpenRecordPayment={handleOpenPayment}
        onToggleAttendance={markAttendance}
      />
    </div>
  );
}
