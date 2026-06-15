import { BiRupee } from 'react-icons/bi';

export default function AnalyticsDashboard({ analytics }) {
  const { channelData } = analytics;

  return (
    <div className="space-y-6">
      
      {/* Revenue & Order Stats */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-[14px] font-black text-[#0F172A] tracking-tight mb-4">Revenue Analytics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 p-4 rounded-xl">
              <span className="text-[10px] font-black text-emerald-600/70 uppercase tracking-widest block mb-1">Total Revenue</span>
              <div className="flex items-center text-[18px] font-black text-emerald-700">
                <BiRupee size={16} />{analytics.currentRevenue.toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Average Order Value</span>
              <div className="flex items-center text-[18px] font-black text-slate-800">
                <BiRupee size={16} />{analytics.aov.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Avg Revenue Per User</span>
              <div className="flex items-center text-[18px] font-black text-slate-800">
                <BiRupee size={16} />{analytics.arpu.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Revenue Per KG</span>
              <div className="flex items-center text-[18px] font-black text-slate-800">
                <BiRupee size={16} />{analytics.revenuePerKg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-[14px] font-black text-[#0F172A] tracking-tight mb-4">Order Analytics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
              <span className="text-[9px] font-black text-blue-600/70 uppercase tracking-widest block mb-1">Total</span>
              <span className="text-[18px] font-black text-blue-700">{analytics.totalOrdersCount}</span>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
              <span className="text-[9px] font-black text-emerald-600/70 uppercase tracking-widest block mb-1">Completed</span>
              <span className="text-[18px] font-black text-emerald-700">{analytics.completedOrdersCount}</span>
            </div>
            <div className="bg-rose-50 p-3 rounded-xl border border-rose-100">
              <span className="text-[9px] font-black text-rose-600/70 uppercase tracking-widest block mb-1">Cancelled/Failed</span>
              <span className="text-[18px] font-black text-rose-700">{analytics.cancelledOrdersCount + analytics.failedOrdersCount}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Avg per Cust.</span>
              <span className="text-[16px] font-black text-slate-800">{analytics.avgOrdersPerUser.toFixed(1)}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Total KG</span>
              <span className="text-[16px] font-black text-slate-800">{analytics.currentKg.toFixed(1)}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Avg Process Time</span>
              <span className="text-[16px] font-black text-slate-800">{analytics.avgTatHours.toFixed(1)}h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Retention Dashboard */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="text-[14px] font-black text-[#0F172A] tracking-tight mb-4">Customer Retention Dashboard</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border border-slate-100 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-indigo-600 mb-1">{analytics.retentionRate.toFixed(1)}%</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Retention Rate</span>
            </div>
            <div className="border border-slate-100 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-sky-600 mb-1">{analytics.repeatPurchaseRate.toFixed(1)}%</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Repeat Purchase %</span>
            </div>
            <div className="border border-slate-100 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-rose-600 mb-1">{analytics.churnRate.toFixed(1)}%</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Churn Rate</span>
            </div>
            <div className="border border-slate-100 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                <div className="flex items-center text-3xl font-black text-emerald-600 mb-1">
                    <BiRupee size={24} />{analytics.clv.toFixed(0)}
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer LTV</span>
            </div>
        </div>
      </div>

      {/* Channel-Wise Analytics */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-[14px] font-black text-[#0F172A] tracking-tight">Channel-Wise Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-[#F8FAFC]">
              <tr>
                <th className="text-left text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Channel</th>
                <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Orders</th>
                <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Revenue</th>
                <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">Unique Users</th>
                <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">New / Returning</th>
                <th className="text-right text-[11px] font-black text-[#64748B] px-6 py-4 uppercase tracking-[0.1em]">AOV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {channelData.filter(c => c.orders > 0).length === 0 ? (
                <tr><td colSpan="6" className="text-center py-8 text-sm text-slate-400 italic">No channel data available</td></tr>
              ) : channelData.filter(c => c.orders > 0).sort((a,b) => b.revenue - a.revenue).map(c => (
                <tr key={c.channel} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-6 py-4 text-[13px] font-black text-slate-700">{c.channel}</td>
                  <td className="px-6 py-4 text-[13px] font-bold text-slate-600 text-right">{c.orders}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-0.5 text-[14px] font-black text-emerald-600 tracking-tight">
                        <BiRupee size={14} />{c.revenue.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[13px] font-bold text-slate-600 text-right">{c.uniqueUsers}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-[12px] font-bold text-purple-600">{c.newUsers}</span>
                    <span className="text-slate-300 mx-1">/</span>
                    <span className="text-[12px] font-bold text-blue-600">{c.returningUsers}</span>
                  </td>
                  <td className="px-6 py-4 text-[13px] font-bold text-slate-600 text-right flex items-center justify-end">
                    <BiRupee size={13} className="text-slate-400" />{c.aov.toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
