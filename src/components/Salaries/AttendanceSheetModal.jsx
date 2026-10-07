import { useState, useMemo } from "react";
import { FiX, FiCalendar, FiChevronLeft, FiChevronRight, FiCheckCircle, FiXCircle, FiClock, FiAlertCircle } from "react-icons/fi";
import { isThursday, getDayOfWeekName, resolveAttendanceStatus, calculateDailyCost, formatCurrency } from "../../utils/salaryEngine";

export default function AttendanceSheetModal({
  isOpen,
  onClose,
  workers = [],
  attendanceMap = new Map(),
  onSaveAttendance,
}) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState("");

  const isThu = useMemo(() => isThursday(selectedDate), [selectedDate]);
  const dayName = useMemo(() => getDayOfWeekName(selectedDate), [selectedDate]);

  if (!isOpen) return null;

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleStatusChange = async (workerId, newStatus) => {
    try {
      await onSaveAttendance(workerId, selectedDate, newStatus);
      setSuccessToast(`Saved status for ${selectedDate}`);
      setTimeout(() => setSuccessToast(""), 2000);
    } catch (err) {
      console.error("Failed to update attendance:", err);
    }
  };

  const handleMarkAllDefault = async () => {
    setSubmitting(true);
    try {
      const records = workers.map((w) => ({
        workerId: w.id,
        date: selectedDate,
        status: isThu ? "thursday_off" : "present",
      }));
      // Call save for each
      for (const r of records) {
        await onSaveAttendance(r.workerId, r.date, r.status);
      }
      setSuccessToast(`Reset all workers to default for ${selectedDate}`);
      setTimeout(() => setSuccessToast(""), 2500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <FiCalendar size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Daily Attendance Sheet</h3>
              <p className="text-xs text-slate-500">
                Mark exceptions for absent workers or Thursday worked shifts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Date Selector & Banner */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevDay}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-sm"
              title="Previous Day"
            >
              <FiChevronLeft size={16} />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              onClick={handleNextDay}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-sm"
              title="Next Day"
            >
              <FiChevronRight size={16} />
            </button>
            <span className="text-xs font-bold text-slate-500 ml-1">
              ({dayName})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isThu ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
                <FiClock size={13} /> Thursday: Weekly Off
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
                <FiCheckCircle size={13} /> Normal Working Day
              </span>
            )}

            <button
              type="button"
              onClick={handleMarkAllDefault}
              disabled={submitting}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {isThu ? "Reset All Weekly Off" : "Reset All Present"}
            </button>
          </div>
        </div>

        {successToast && (
          <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-100 text-emerald-700 text-xs font-semibold flex items-center justify-between animate-fade-in">
            <span>✓ {successToast}</span>
          </div>
        )}

        {/* Worker Attendance List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
          {workers.filter((w) => w.status !== "inactive").map((worker) => {
            const attRecord = attendanceMap.get(`${worker.id}_${selectedDate}`);
            const status = resolveAttendanceStatus(worker, selectedDate, attRecord);
            const dailyCostInfo = calculateDailyCost(worker, selectedDate, attRecord);

            return (
              <div
                key={worker.id}
                className="p-3.5 hover:bg-slate-50/70 rounded-xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
                    {worker.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{worker.name}</span>
                      <span className="text-[11px] font-semibold text-slate-500 px-2 py-0.5 rounded-md bg-slate-100">
                        {worker.role}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>Daily Wage: <strong className="text-slate-700">{formatCurrency(dailyCostInfo.dailyWage)}</strong></span>
                      <span>•</span>
                      <span>Today Cost: <strong className={dailyCostInfo.cost > 0 ? "text-emerald-600" : "text-slate-500"}>{formatCurrency(dailyCostInfo.cost)}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Status Toggles */}
                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  {isThu ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(worker.id, "thursday_off")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          status === "thursday_off"
                            ? "bg-amber-500 text-white shadow-sm ring-2 ring-amber-300"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Weekly Off (₹0)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(worker.id, "thursday_worked")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          status === "thursday_worked"
                            ? "bg-purple-600 text-white shadow-sm ring-2 ring-purple-300"
                            : "bg-slate-100 text-slate-600 hover:bg-purple-50 hover:text-purple-700"
                        }`}
                      >
                        Worked (+Wage)
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(worker.id, "present")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          status === "present"
                            ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300"
                            : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                        }`}
                      >
                        Present (Default)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(worker.id, "half_day")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          status === "half_day"
                            ? "bg-amber-500 text-white shadow-sm ring-2 ring-amber-300"
                            : "bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700"
                        }`}
                      >
                        Half Day (½)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(worker.id, "absent")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          status === "absent"
                            ? "bg-rose-600 text-white shadow-sm ring-2 ring-rose-300"
                            : "bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700"
                        }`}
                      >
                        Absent (₹0)
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between flex-shrink-0">
          <p className="text-[11px] text-slate-500">
            Workers are <strong>Present by default</strong> on normal days and <strong>Weekly Off</strong> on Thursdays.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
