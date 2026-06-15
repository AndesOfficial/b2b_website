import { FiAlertCircle, FiTrendingUp, FiUsers } from "react-icons/fi";
import { BiRupee } from "react-icons/bi";
import { GiWeight } from "react-icons/gi";
import KpiCard from "./KpiCard";

function getKpiDefinitions({ activeTab, onTabChange, stats }) {
  if (activeTab === "overview") {
    return [
      {
        key: "revenue",
        label: "Revenue (Overall)",
        value: `₹${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        icon: BiRupee,
        color: "blue",
        onClick: () => onTabChange("overview"),
        trend: { direction: "up", text: `Hostel: ₹${(stats.breakdown.hostelRevenue / 1000).toFixed(0)}k` },
        sparklineData: stats.sparklines.revenue,
      },
      {
        key: "operations",
        label: "Pickups & Deliveries",
        value: (
          <div className="flex divide-x divide-slate-100 mt-2 gap-4">
            <div className="pr-4">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">B2C</div>
              <div className="text-[11px] font-bold text-slate-600">Pickups: <span className="font-extrabold text-slate-900">{stats.b2cPickups}</span></div>
              <div className="text-[11px] font-bold text-slate-600">Deliveries: <span className="font-extrabold text-slate-900">{stats.b2cDeliveries}</span></div>
            </div>
            <div className="pl-4">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">B2B Properties</div>
              <div className="text-[11px] font-bold text-slate-600">Pickups: <span className="font-extrabold text-slate-900">{stats.b2bPickups}</span></div>
              <div className="text-[11px] font-bold text-slate-600">Deliveries: <span className="font-extrabold text-slate-900">{stats.b2bDeliveries}</span></div>
            </div>
          </div>
        ),
        icon: FiTrendingUp,
        color: "purple",
        onClick: () => onTabChange("overview"),
        sparklineData: stats.sparklines.orders,
      },
      {
        key: "kg",
        label: "KG Processed",
        value: `${stats.totalKg.toFixed(1)}`,
        icon: GiWeight,
        color: "green",
        onClick: () => onTabChange("hostels"),
        sparklineData: stats.sparklines.kg,
      },
      {
        key: "issues",
        label: "Open Issues",
        value: stats.openIssuesCount,
        icon: FiAlertCircle,
        color: "red",
        onClick: () => onTabChange("issues"),
        trend: stats.openIssuesCount > 5 ? { direction: "up", text: "High" } : null,
        sparklineData: stats.sparklines.issues,
      }
    ];
  }

  return [
    {
      key: "revenue",
      label: `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Revenue`,
      value: `₹${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: BiRupee,
      color: "blue",
      onClick: () => onTabChange(activeTab),
      sparklineData: stats.sparklines.revenue,
    },
    {
      key: "kg",
      label: "KG Processed",
      value: `${stats.totalKg.toFixed(1)}`,
      icon: GiWeight,
      color: "green",
      onClick: () => onTabChange(activeTab),
      sparklineData: stats.sparklines.kg,
    }
  ];
}

export default function AdminDashboardKpis({ activeTab, columnsClass, onTabChange, stats }) {
  const kpis = getKpiDefinitions({ activeTab, onTabChange, stats });

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${columnsClass} gap-6 mb-8`}>
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.key}
          label={kpi.label}
          value={kpi.value}
          icon={kpi.icon}
          color={kpi.color}
          onClick={kpi.onClick}
          trend={kpi.trend}
          sparklineData={kpi.sparklineData}
        />
      ))}
    </div>
  );
}
