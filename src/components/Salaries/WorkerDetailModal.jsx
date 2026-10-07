import { useState, useMemo } from "react";
import {
  FiX,
  FiCalendar,
  FiClock,
  FiDollarSign,
  FiTrendingUp,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiPlus,
  FiCreditCard,
  FiEdit2,
  FiArrowUpRight,
} from "react-icons/fi";
import { FaIndianRupeeSign } from "react-icons/fa6";
import {
  calculateMonthSummary,
  formatCurrency,
  isThursday,
} from "../../utils/salaryEngine";

export default function WorkerDetailModal({
  isOpen,
  onClose,
  worker,
  selectedMonth = "2026-09",
  attendanceMap = new Map(),
  adjustments = [],
  payments = [],
  onOpenChangeSalary,
  onOpenAddAdjustment,
  onOpenRecordPayment,
  onToggleAttendance,
}) {
  const [activeTab, setActiveTab] = useState("daily"); // "daily" | "rates" | "history"
  const [viewMonth, setViewMonth] = useState(selectedMonth);

  // Filter adjustments & payments for this worker
  const workerAdjs = useMemo(
    () => adjustments.filter((a) => a.workerId === worker?.id && (!a.month || a.month === viewMonth)),
    [adjustments, worker, viewMonth]
  );

  const workerPayments = useMemo(
    () => payments.filter((p) => p.workerId === worker?.id && (!p.month || p.month === viewMonth)),
    [payments, worker, viewMonth]
  );

  const monthSummary = useMemo(() => {
    if (!worker) return null;
    return calculateMonthSummary(
      worker,
      viewMonth,
      attendanceMap,
      workerAdjs,
      workerPayments
    );
  }, [worker, viewMonth, attendanceMap, workerAdjs, workerPayments]);

  if (!isOpen || !worker || !monthSummary) return null;

  // Month options for history comparison (current + 5 previous months)
  const monthOptions = [];
  const currentD = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(currentD.getFullYear(), currentD.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    monthOptions.push({ val, label });
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Header Profile Bar */}
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-lg">
                {worker.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-extrabold text-white tracking-tight">{worker.name}</h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold uppercase tracking-wider">
                    {worker.role}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-bold">
                    Weekly Off: Thursday
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Joined: <strong>{worker.joiningDate || "N/A"}</strong> • Current Monthly:{" "}
                  <strong className="text-white">{formatCurrency(monthSummary.currentMonthlySalary)}</strong> (
                  {formatCurrency(monthSummary.currentDailyWage)}/day)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                onClick={() => onOpenChangeSalary(worker)}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/10 flex items-center gap-1.5"
              >
                <FiEdit2 size={13} /> Change Salary
              </button>
              <button
                onClick={() => onOpenAddAdjustment(worker.id)}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <FiPlus size={14} /> Overtime / Extra
              </button>
              <button
                onClick={() => onOpenRecordPayment(worker.id)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <FiCreditCard size={14} /> Pay
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
                aria-label="Close"
              >
                <FiX size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Sub-header: Month Selector & Navigation Tabs */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab("daily")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "daily"
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Daily Breakdown
            </button>
            <button
              onClick={() => setActiveTab("rates")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "rates"
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Salary Rate History ({worker.salaryHistory?.length || 1})
            </button>
            <button
              onClick={() => setActiveTab("payments")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "payments"
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Payments & Extras ({workerPayments.length + workerAdjs.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500">Period:</label>
            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {monthOptions.map((opt) => (
                <option key={opt.val} value={opt.val}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Month Summary KPI Strip */}
        <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 border-b border-slate-100 bg-white flex-shrink-0">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">Days Worked</span>
            <span className="text-lg font-black text-slate-900">{monthSummary.daysWorked}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              ({monthSummary.thursdaysWorked} Thu worked)
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">Weekly Offs</span>
            <span className="text-lg font-black text-amber-600">{monthSummary.weeklyOffs}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Thursdays</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">Absences</span>
            <span className={`text-lg font-black ${monthSummary.absences > 0 ? "text-rose-600" : "text-slate-400"}`}>
              {monthSummary.absences}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Unpaid</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">Regular Salary</span>
            <span className="text-lg font-black text-slate-900">{formatCurrency(monthSummary.regularSalary)}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Attendance</span>
          </div>

          <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100">
            <span className="text-[10px] uppercase tracking-wider font-bold text-purple-700 block">Overtime / Extra</span>
            <span className="text-lg font-black text-purple-700">
              {formatCurrency(monthSummary.overtime + monthSummary.additionalPayments - monthSummary.deductions)}
            </span>
            <span className="text-[10px] text-purple-600 block mt-0.5">Net adjustments</span>
          </div>

          <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100">
            <span className="text-[10px] uppercase tracking-wider font-bold text-blue-700 block">Total Accrued</span>
            <span className="text-lg font-black text-blue-800">{formatCurrency(monthSummary.totalAccrued)}</span>
            <span className="text-[10px] text-blue-600 block mt-0.5">Total month earning</span>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
            <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 block">Paid / Pending</span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-black text-emerald-700">{formatCurrency(monthSummary.totalPaid)}</span>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-sm font-black text-rose-600">{formatCurrency(monthSummary.remainingAmount)}</span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {monthSummary.remainingAmount === 0 ? "Fully Settled" : "Balance Due"}
            </span>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: Daily Breakdown Table */}
          {activeTab === "daily" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-slate-900 text-sm tracking-tight">
                  Daily Attendance & Accrual Ledger
                </h4>
                <span className="text-xs text-slate-500">
                  Click status badge to toggle Present ↔ Absent or Thursday Off ↔ Worked
                </span>
              </div>

              <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-3">Day</th>
                      <th className="py-3 px-4">Attendance Status</th>
                      <th className="py-3 px-3 text-right">Applicable Monthly</th>
                      <th className="py-3 px-3 text-right">Daily Wage</th>
                      <th className="py-3 px-3 text-right">Cost Added</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {monthSummary.dailyBreakdown.map((day) => {
                      const isThu = day.isThursday;
                      const isWorked = day.isWorked;

                      return (
                        <tr
                          key={day.date}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isThu ? "bg-amber-50/20" : ""
                          }`}
                        >
                          <td className="py-3 px-4 font-bold text-slate-900">{day.date}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                isThu ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {day.dayOfWeek}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {day.status === "present" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                                <FiCheckCircle size={11} /> Present
                              </span>
                            )}
                            {day.status === "thursday_worked" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200 text-[11px] font-bold">
                                <FiTrendingUp size={11} /> Weekly Off Worked
                              </span>
                            )}
                            {day.status === "thursday_off" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold">
                                <FiClock size={11} /> Thursday Weekly Off
                              </span>
                            )}
                            {day.status === "absent" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                                <FiXCircle size={11} /> Absent
                              </span>
                            )}
                            {day.status === "half_day" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                                Half Day
                              </span>
                            )}
                            {day.status === "not_joined" && (
                              <span className="text-slate-400 text-[11px]">Before Joining</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-700">
                            {day.status !== "not_joined" ? formatCurrency(day.monthlySalary) : "—"}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-700">
                            {day.status !== "not_joined" ? formatCurrency(day.dailyWage) : "—"}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span
                              className={`font-black ${
                                day.cost > 0 ? "text-emerald-600 font-extrabold" : "text-slate-400"
                              }`}
                            >
                              {formatCurrency(day.cost)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {day.status !== "not_joined" && (
                              <div className="inline-flex items-center gap-1">
                                {isThu ? (
                                  <button
                                    onClick={() =>
                                      onToggleAttendance(
                                        worker.id,
                                        day.date,
                                        day.status === "thursday_worked" ? "thursday_off" : "thursday_worked"
                                      )
                                    }
                                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                  >
                                    {day.status === "thursday_worked" ? "Set Off" : "Set Worked"}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      onToggleAttendance(
                                        worker.id,
                                        day.date,
                                        day.status === "present" ? "absent" : "present"
                                      )
                                    }
                                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                  >
                                    {day.status === "present" ? "Mark Absent" : "Mark Present"}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Salary Rates History */}
          {activeTab === "rates" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm tracking-tight">
                    Configured Salary History & Effective Dates
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Historical calculations permanently respect the rate active during that timeframe
                  </p>
                </div>
                <button
                  onClick={() => onOpenChangeSalary(worker)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <FiPlus size={14} /> Add Salary Change
                </button>
              </div>

              <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Effective Date</th>
                      <th className="py-3 px-4 text-right">Monthly Salary</th>
                      <th className="py-3 px-4 text-right">Daily Wage (÷ 26)</th>
                      <th className="py-3 px-4">Reason / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {(worker.salaryHistory || []).map((h, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <FiCalendar size={13} className="text-blue-500" />
                          {h.effectiveDate || worker.joiningDate || "Initial"}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                          {formatCurrency(h.rate)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600">
                          {formatCurrency(Number(h.rate) / 26)}/day
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {h.note || (idx === 0 ? "Baseline joining salary" : "Salary revision")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Payments & Adjustments */}
          {activeTab === "payments" && (
            <div className="space-y-6">
              {/* Adjustments */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-extrabold text-slate-900 text-sm tracking-tight">
                    Overtime, Extra Work & Deductions
                  </h4>
                  <button
                    onClick={() => onOpenAddAdjustment(worker.id)}
                    className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1 transition-all"
                  >
                    <FiPlus size={13} /> Add Entry
                  </button>
                </div>

                {workerAdjs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                    No overtime or extra payments recorded for {viewMonth}.
                  </div>
                ) : (
                  <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4">Date</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-4">Reason</th>
                          <th className="py-2.5 px-4 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {workerAdjs.map((adj) => (
                          <tr key={adj.id}>
                            <td className="py-2.5 px-4 font-bold text-slate-800">{adj.date}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                  adj.type === "overtime"
                                    ? "bg-purple-100 text-purple-700"
                                    : adj.type === "deduction"
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {adj.type}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">{adj.reason}</td>
                            <td
                              className={`py-2.5 px-4 text-right font-black ${
                                adj.type === "deduction" ? "text-rose-600" : "text-purple-700"
                              }`}
                            >
                              {adj.type === "deduction" ? "-" : "+"}
                              {formatCurrency(adj.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Payments */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-extrabold text-slate-900 text-sm tracking-tight">
                    Salary Payouts Made
                  </h4>
                  <button
                    onClick={() => onOpenRecordPayment(worker.id)}
                    className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition-all"
                  >
                    <FiPlus size={13} /> Record Payment
                  </button>
                </div>

                {workerPayments.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                    No salary payouts recorded for {viewMonth}.
                  </div>
                ) : (
                  <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4">Date</th>
                          <th className="py-2.5 px-3">Mode</th>
                          <th className="py-2.5 px-4">Reference / Notes</th>
                          <th className="py-2.5 px-4 text-right">Amount Paid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {workerPayments.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2.5 px-4 font-bold text-slate-800">{p.date}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-emerald-100 text-emerald-800">
                                {p.paymentMode}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">
                              {p.reference || p.notes || "Disbursement"}
                            </td>
                            <td className="py-2.5 px-4 text-right font-black text-emerald-700">
                              {formatCurrency(p.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-slate-500">
            Total Accrued: <strong className="text-slate-900">{formatCurrency(monthSummary.totalAccrued)}</strong> • Balance Remaining:{" "}
            <strong className="text-rose-600">{formatCurrency(monthSummary.remainingAmount)}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
