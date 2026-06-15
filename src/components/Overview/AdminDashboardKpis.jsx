import { FiAlertCircle, FiTrendingUp, FiUsers } from "react-icons/fi";
import { BiRupee } from "react-icons/bi";
import { GiWeight } from "react-icons/gi";
import KpiCard from "../Shared/KpiCard";

function getKpiDefinitions({ activeTab, onTabChange, stats }) {
  if (activeTab === "overview") {
    return [
      {
        key: "revenue",
        label: "Revenue (Overall)",
        value: (
          <div>
            <span className="text-xl sm:text-2xl font-extrabold text-[#0F172A] leading-tight tracking-tight">
              {`₹${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
            <div className="flex divide-x divide-slate-100 mt-2 gap-4">
              <div className="pr-4">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">B2C</div>
                <div className="text-[11.5px] font-extrabold text-slate-800">
                  {`₹${stats.breakdown.retailRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                </div>
              </div>
              <div className="pl-4">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">B2B</div>
                <div className="text-[11.5px] font-extrabold text-slate-800">
                  {`₹${(stats.breakdown.hostelRevenue + stats.breakdown.hotelRevenue).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                </div>
              </div>
            </div>
          </div>
        ),
        icon: BiRupee,
        color: "blue",
        onClick: () => onTabChange("overview"),
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
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">B2B</div>
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
        value: (
          <div>
            <span className="text-xl sm:text-2xl font-extrabold text-[#0F172A] leading-tight tracking-tight">
              {`${stats.totalKg.toFixed(1)}`}
            </span>
            <div className="flex divide-x divide-slate-100 mt-2.5 gap-4">
              <div className="pr-4 flex-1">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">B2C</div>
                <div className="text-[12px] font-black text-slate-800">
                  {`${(stats.b2cKg || 0).toFixed(1)}`} <span className="text-[9px] text-slate-400 font-bold">KG</span>
                </div>
                {stats.b2cServicesKg && (
                  <>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex my-2 border border-slate-50">
                      {Object.entries(stats.b2cServicesKg)
                        .filter(([, data]) => data.weight > 0)
                        .sort((a, b) => b[1].weight - a[1].weight)
                        .map(([name, data], idx) => {
                          const colors = ["bg-blue-500", "bg-indigo-500", "bg-purple-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500"];
                          const colorClass = colors[idx % colors.length];
                          return (
                            <div 
                              key={name}
                              className={`h-full ${colorClass} transition-all duration-500 ease-out`} 
                              style={{ width: `${stats.b2cKg > 0 ? (data.weight / stats.b2cKg) * 100 : 0}%` }}
                              title={`${name}: ${data.weight.toFixed(1)} KG`}
                            />
                          );
                        })
                      }
                    </div>
                    <div className="flex flex-col gap-1 text-[8.5px] font-bold tracking-tight">
                      {Object.entries(stats.b2cServicesKg)
                        .filter(([, data]) => data.weight > 0 || data.quantity > 0)
                        .sort((a, b) => (b[1].weight || b[1].quantity) - (a[1].weight || a[1].quantity))
                        .slice(0, 3)
                        .map(([name, data], idx) => {
                          const colors = ["bg-blue-500", "bg-indigo-500", "bg-purple-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500"];
                          const colorDot = colors[idx % colors.length];
                          const isWeightBased = data.weight > 0;
                          return (
                            <div key={name} className="flex justify-between items-center gap-1.5">
                              <div className="flex items-center gap-1 min-w-0">
                                <span className={`w-1.5 h-1.5 rounded-full ${colorDot} flex-shrink-0`} />
                                <span className="truncate text-slate-400 max-w-[75px] uppercase" title={name}>{name}</span>
                              </div>
                              <span className="font-extrabold text-slate-700 whitespace-nowrap">
                                {isWeightBased ? (
                                  <>{data.weight.toFixed(1)} <span className="text-[7.5px] text-slate-400 font-bold">KG</span></>
                                ) : (
                                  <>{data.quantity} <span className="text-[7.5px] text-slate-400 font-bold">PCS</span></>
                                )}
                              </span>
                            </div>
                          );
                        })
                      }
                    </div>
                  </>
                )}
              </div>
              <div className="pl-4 flex-1">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">B2B</div>
                <div className="text-[12px] font-black text-slate-800">
                  {`${(stats.b2bKg || 0).toFixed(1)}`} <span className="text-[9px] text-slate-400 font-bold">KG</span>
                </div>
              </div>
            </div>
          </div>
        ),
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
