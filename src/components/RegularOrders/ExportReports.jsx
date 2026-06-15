import { FiDownload } from "react-icons/fi";

// Utility to convert array of objects to CSV
function downloadCSV(data, filename) {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  csvRows.push(headers.join(','));

  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header] === null || row[header] === undefined ? "" : row[header];
      const escaped = String(val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ExportReports({ analytics }) {
  const handleExport = (type) => {
    switch(type) {
      case 'user_database':
        downloadCSV(analytics.activeUsersList, 'user_database');
        break;
      case 'revenue':
        downloadCSV([{
            Total_Revenue: analytics.currentRevenue,
            Total_Orders: analytics.totalOrdersCount,
            Total_KG: analytics.currentKg,
            AOV: analytics.aov,
            ARPU: analytics.arpu,
            Revenue_Per_KG: analytics.revenuePerKg
        }], 'revenue_report');
        break;
      case 'retention':
        downloadCSV([{
            Retention_Rate: analytics.retentionRate,
            Repeat_Purchase_Rate: analytics.repeatPurchaseRate,
            Churn_Rate: analytics.churnRate,
            CLV: analytics.clv
        }], 'retention_report');
        break;
      case 'channels':
        downloadCSV(analytics.channelData, 'channel_performance');
        break;
      case 'orders':
        downloadCSV([{
            Total_Orders: analytics.totalOrdersCount,
            Completed: analytics.completedOrdersCount,
            Cancelled: analytics.cancelledOrdersCount,
            Failed: analytics.failedOrdersCount,
            Avg_TAT_Hours: analytics.avgTatHours
        }], 'order_analytics');
        break;
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative group">
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
          <FiDownload size={14} /> Export Options
        </button>
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <div className="p-2 flex flex-col gap-1">
            <button onClick={() => handleExport('user_database')} className="text-left px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 rounded-lg">User Database</button>
            <button onClick={() => handleExport('revenue')} className="text-left px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 rounded-lg">Revenue Report</button>
            <button onClick={() => handleExport('retention')} className="text-left px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 rounded-lg">Retention Metrics</button>
            <button onClick={() => handleExport('channels')} className="text-left px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 rounded-lg">Channel Performance</button>
            <button onClick={() => handleExport('orders')} className="text-left px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 rounded-lg">Order Analytics</button>
          </div>
        </div>
      </div>
    </div>
  );
}
