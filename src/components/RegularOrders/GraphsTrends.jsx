import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Format "2026-06-29" → "Jun 29"
function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

// Custom tooltip for the revenue chart
function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-xl border border-slate-100 px-4 py-3">
      <p className="text-[11px] font-black text-slate-400 mb-1">{fmtDate(label)}</p>
      <p className="text-[15px] font-black text-emerald-600">₹{payload[0].value.toLocaleString()}</p>
    </div>
  );
}

export default function GraphsTrends({ analytics }) {
  const { dailyTrends, channelData } = analytics;

  // Fix #13 — only show channels that actually have orders
  const activeChannels = useMemo(
    () => channelData.filter(c => c.orders > 0).sort((a, b) => b.revenue - a.revenue),
    [channelData]
  );

  return (
    <div className="grid lg:grid-cols-2 gap-6 mb-6">
      {/* Daily Revenue Trend */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="mb-6">
          <h3 className="text-[14px] font-black text-[#0F172A] tracking-tight">Daily Revenue Trend</h3>
          <p className="text-[12px] font-medium text-slate-400">Revenue generated over selected period</p>
        </div>
        <div className="h-[250px]">
          {dailyTrends.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-[13px] font-bold">
              No revenue data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={dailyTrends}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                {/* Fix #7 — human-readable date labels */}
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  dy={10}
                  tickFormatter={fmtDate}
                  interval="preserveStartEnd"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  width={48}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <Tooltip content={<RevenueTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10B981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Channel-Wise Revenue — fix #13: skip zero-order channels */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="mb-6">
          <h3 className="text-[14px] font-black text-[#0F172A] tracking-tight">Channel-Wise Revenue</h3>
          <p className="text-[12px] font-medium text-slate-400">Revenue comparison across acquisition channels</p>
        </div>
        <div className="h-[250px]">
          {activeChannels.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-[13px] font-bold">
              No channel data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={activeChannels} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <YAxis
                  dataKey="channel"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }}
                  width={80}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={v => [`₹${v.toLocaleString()}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
