import { useMemo } from "react";
import { FiTrendingUp, FiTrendingDown, FiMinus } from "react-icons/fi";
import { BiRupee } from "react-icons/bi";

export default function GrowthComparison({ analytics }) {
  const previousOrders = analytics.previousOrders ?? [];
  const currentOrders = analytics.totalOrdersCount;
  const previousOrdersCount = previousOrders.length;
  const currentRevenue = analytics.currentRevenue;
  const previousRevenue = analytics.previousRevenue;
  const currentActiveUsers = analytics.activeUsersCount;

  // Memoized — building a Set from a map is O(n), no need to redo every render
  const previousActiveUsers = useMemo(
    () => new Set(previousOrders.map(o => o.customerNumber || o.customerName)).size,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previousOrders]
  );

  const renderMetric = (label, current, previous, isCurrency = false) => {
    const isZeroPrevious = previous === 0 && current > 0;
    let percentage = 0;
    if (previous > 0) percentage = ((current - previous) / previous) * 100;

    const isPositive = percentage > 0 || isZeroPrevious;
    const isNegative = percentage < 0;

    return (
      <div className="flex flex-col bg-slate-50 p-4 rounded-xl border border-slate-100">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</span>
        <div className="flex items-center gap-1 mb-2">
          {isCurrency && <BiRupee size={16} className="text-slate-400" />}
          <span className="text-[20px] font-black text-[#0F172A] tracking-tight">
            {isCurrency
              ? Number(current).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
              : typeof current === "number" ? current.toLocaleString() : current}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded ${
            isPositive ? "bg-emerald-100 text-emerald-700" : isNegative ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-600"
          }`}>
            {isZeroPrevious ? (
              <>
                <FiTrendingUp size={10} />
                <span>NEW</span>
              </>
            ) : (
              <>
                {isPositive ? <FiTrendingUp size={10} /> : isNegative ? <FiTrendingDown size={10} /> : <FiMinus size={10} />}
                {Math.abs(percentage).toFixed(1)}%
              </>
            )}
          </span>
          <span className="text-[10px] font-bold text-slate-400">
            vs Prev. Period ({isCurrency ? `₹${Number(previous).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : typeof previous === "number" ? previous.toLocaleString() : previous})
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-6">
      <div className="mb-6">
        <h3 className="text-[14px] font-black text-[#0F172A] tracking-tight">Growth Comparison</h3>
        <p className="text-[12px] font-medium text-slate-400">Current period performance against the previous period</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {renderMetric("Orders", currentOrders, previousOrdersCount)}
        {renderMetric("Revenue", currentRevenue, previousRevenue, true)}
        {renderMetric("Active Users", currentActiveUsers, previousActiveUsers)}
        {renderMetric("Average Order Value", analytics.aov, previousOrdersCount > 0 ? previousRevenue / previousOrdersCount : 0, true)}
      </div>
    </div>
  );
}
