import { useState, useCallback } from "react";
import { FiDownload, FiX } from "react-icons/fi";

// Utility to convert array of objects to CSV and trigger download
function downloadCSV(data, filename) {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header] === null || row[header] === undefined ? "" : row[header];
      const escaped = String(val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const EXPORT_OPTIONS = [
  { key: 'orders_log',    label: 'Orders Log',          desc: 'All transactions this period' },
  { key: 'user_database', label: 'Active Customers',     desc: 'Customers who ordered this period' },
  { key: 'lost_users',    label: 'Lost Customers',       desc: 'Recently churned customers' },
  { key: 'channels',      label: 'Channel Performance',  desc: 'Revenue by acquisition channel' },
  { key: 'revenue',       label: 'Revenue Summary',      desc: 'Key revenue KPIs' },
  { key: 'retention',     label: 'Retention Metrics',    desc: 'Churn, retention, CLV stats' },
];

export default function ExportReports({ analytics }) {
  // Fix #10 — click-based dropdown (not CSS hover which closes on mouse move)
  const [open, setOpen] = useState(false);
  const [lastExported, setLastExported] = useState(null);

  const handleExport = useCallback((type) => {
    setOpen(false);
    setLastExported(type);
    setTimeout(() => setLastExported(null), 2000);

    switch (type) {
      case 'orders_log':
        downloadCSV(
          (analytics.currentOrders || []).map(o => ({
            ID: o.id,
            Date: o.date,
            Customer: o.customerName || '',
            Phone: o.customerNumber || '',
            Channel: o.channel || '',
            Service: o.service || '',
            Amount: o.amount || 0,
            Weight_KG: o.weight || '',
            Status: o.status || '',
          })),
          'orders_log'
        );
        break;

      case 'user_database':
        downloadCSV(analytics.activeUsersList || [], 'active_customers');
        break;

      // Fix #5 & #11 — Lost users now exportable
      case 'lost_users':
        downloadCSV(
          (analytics.lostUsers || []).map(u => ({
            Name: u.name,
            Phone: u.phone,
            Address: u.address || '',
            Total_Orders: u.totalOrders,
            Total_Revenue: u.totalRevenue,
            Last_Order_Date: u.lastOrderDate,
            Days_Since_Last_Order: u.daysSinceLastOrder,
          })),
          'lost_customers'
        );
        break;

      case 'channels':
        downloadCSV(
          (analytics.channelData || []).filter(c => c.orders > 0).map(c => ({
            Channel: c.channel,
            Orders: c.orders,
            Revenue: c.revenue,
            Unique_Users: c.uniqueUsers,
            New_Users: c.newUsers,
            Returning_Users: c.returningUsers,
            AOV: Math.round(c.aov),
          })),
          'channel_performance'
        );
        break;

      case 'revenue':
        downloadCSV([{
          Total_Revenue: analytics.currentRevenue,
          Previous_Revenue: analytics.previousRevenue,
          Revenue_Growth_Pct: analytics.revenueGrowth?.toFixed(1),
          Total_Orders: analytics.totalOrdersCount,
          Total_KG: analytics.currentKg?.toFixed(1),
          AOV: analytics.aov?.toFixed(0),
          ARPU: analytics.arpu?.toFixed(0),
          Revenue_Per_KG: analytics.revenuePerKg?.toFixed(0),
        }], 'revenue_report');
        break;

      case 'retention':
        downloadCSV([{
          Retention_Rate_Pct: analytics.retentionRate?.toFixed(1),
          Repeat_Purchase_Rate_Pct: analytics.repeatPurchaseRate?.toFixed(1),
          Churn_Rate_Pct: analytics.churnRate?.toFixed(1),
          Customer_LTV: analytics.clv?.toFixed(0),
          New_Users: analytics.newUsersCount,
          Lost_Users: analytics.lostUsersCount,
          Dormant_Users: analytics.dormantUsersCount,
        }], 'retention_report');
        break;

      default:
        break;
    }
  }, [analytics]);

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold border transition-all shadow-sm ${
          lastExported
            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        }`}
      >
        <FiDownload size={14} />
        {lastExported ? 'Exported!' : 'Export Options'}
      </button>

      {/* Fix #10 — click-controlled dropdown */}
      {open && (
        <>
          {/* Backdrop — click outside to close */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-[12px] font-black text-slate-500 uppercase tracking-widest">Export Data</span>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <FiX size={14} />
              </button>
            </div>
            <div className="p-2">
              {EXPORT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => handleExport(opt.key)}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                >
                  <p className="text-[13px] font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{opt.label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
