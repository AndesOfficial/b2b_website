import { useMemo } from "react";
import { FiUsers, FiUserCheck, FiUserPlus, FiUserMinus, FiShoppingBag, FiActivity, FiTrendingUp } from "react-icons/fi";
import { BiRupee } from "react-icons/bi";

export default function DashboardCards({ analytics }) {
  const cards = useMemo(() => [
    { title: "Total Users", value: analytics.totalUsersCount, icon: FiUsers, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Active Users", value: analytics.activeUsersCount, icon: FiUserCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "New Users", value: analytics.newUsersCount, icon: FiUserPlus, color: "text-purple-600", bg: "bg-purple-50" },
    { title: "Retention Users", value: analytics.retentionUsersCount, icon: FiActivity, color: "text-indigo-600", bg: "bg-indigo-50" },
    { title: "Unique Users", value: analytics.uniqueUsersCount, icon: FiUserCheck, color: "text-sky-600", bg: "bg-sky-50" },
    { title: "Lost Users", value: analytics.lostUsersCount, icon: FiUserMinus, color: "text-rose-600", bg: "bg-rose-50" },
    { title: "Total Orders", value: analytics.totalOrdersCount, icon: FiShoppingBag, color: "text-amber-600", bg: "bg-amber-50" },
    { title: "Revenue", value: analytics.currentRevenue, icon: BiRupee, color: "text-emerald-600", bg: "bg-emerald-50", isCurrency: true },
    { title: "KG Processed", value: analytics.currentKg.toFixed(1), icon: FiActivity, color: "text-cyan-600", bg: "bg-cyan-50", suffix: " KG" },
    { title: "Retention Rate", value: analytics.retentionRate.toFixed(1), icon: FiTrendingUp, color: "text-teal-600", bg: "bg-teal-50", suffix: "%" },
    { title: "Avg Order Value", value: analytics.aov.toFixed(0), icon: BiRupee, color: "text-blue-600", bg: "bg-blue-50", isCurrency: true },
    { title: "Lifetime Value", value: analytics.clv.toFixed(0), icon: BiRupee, color: "text-violet-600", bg: "bg-violet-50", isCurrency: true },
  ], [
    analytics.totalUsersCount, analytics.activeUsersCount, analytics.newUsersCount,
    analytics.retentionUsersCount, analytics.uniqueUsersCount, analytics.lostUsersCount,
    analytics.totalOrdersCount, analytics.currentRevenue, analytics.currentKg,
    analytics.retentionRate, analytics.aov, analytics.clv,
  ]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
      {cards.map((card, i) => (
        <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-start hover:shadow-md transition-shadow">
          <div className={`p-2 rounded-lg ${card.bg} ${card.color} mb-3`}>
            <card.icon size={18} />
          </div>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.title}</p>
          <div className="flex items-center gap-1">
            {card.isCurrency && <BiRupee size={16} className="text-slate-400" />}
            <span className="text-xl font-black text-[#0F172A] tracking-tight">
              {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
            </span>
            {card.suffix && <span className="text-[11px] font-bold text-slate-400">{card.suffix}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
