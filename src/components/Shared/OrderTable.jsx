import { FiAlertTriangle, FiPackage, FiTrash2 } from "react-icons/fi";
import { BiRupee } from "react-icons/bi";
import ExportCSV from "./ExportCSV";
import EmptyState from "./EmptyState";

function getStatusClass(status) {
  if (status === "Delivered") return "bg-green-50 text-green-700";
  if (status === "Pending") return "bg-amber-50 text-amber-700";
  if (status === "Confirmed") return "bg-blue-50 text-blue-700";
  return "bg-red-50 text-red-700";
}

export default function OrderTable({ orders = [], showTenant = true, onDelete, onRowClick }) {
  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <EmptyState
          icon={FiPackage}
          title="No orders found"
          message="Try adjusting your filters or search terms to find what you're looking for."
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-gray-50">
        <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {orders.length} order{orders.length !== 1 ? "s" : ""}
        </p>
        <div className="flex gap-2">
          <ExportCSV orders={orders} />
        </div>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="bg-gray-50/50 text-left">
              <th className="text-xs font-bold text-gray-500 px-6 py-4 uppercase tracking-wider">Date</th>
              {showTenant && <th className="text-xs font-bold text-gray-500 px-6 py-4 uppercase tracking-wider">Tenant</th>}
              <th className="text-xs font-bold text-gray-500 px-6 py-4 uppercase tracking-wider">Order Details</th>
              <th className="text-right text-xs font-bold text-gray-500 px-6 py-4 uppercase tracking-wider">Clothes</th>
              <th className="text-right text-xs font-bold text-gray-500 px-6 py-4 uppercase tracking-wider">Amount</th>
              <th className="text-center text-xs font-bold text-gray-500 px-6 py-4 uppercase tracking-wider">Status</th>
              {onDelete && <th className="text-right text-xs font-bold text-gray-500 px-6 py-4 uppercase tracking-wider">Action</th>}
            </tr>
          </thead>
          <tbody>
            {orders.map((order, index) => {
              const isIssue = order.hasIssue || order.category === "ISSUES" || order.tenant === "Issues & Complaints";

              return (
                <tr
                  key={order.id || index}
                  onClick={onRowClick ? () => onRowClick(order) : undefined}
                  className={`border-b border-gray-50 transition-colors ${onRowClick ? "cursor-pointer" : ""} ${isIssue ? "bg-red-50/40 hover:bg-red-50/60" : "hover:bg-gray-50/80"}`}
                >
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{order.date || `${order.day}/${order.month}`}</td>
                  {showTenant && (
                    <td className="px-6 py-4">
                      <span className={`text-sm font-semibold ${isIssue ? "text-red-600" : "text-gray-900"}`}>
                        {order.property || order.tenant}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                    <span className="block truncate font-medium" title={order.service}>{order.service}</span>
                    {order.issueType && (
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 uppercase tracking-wider">
                        <FiAlertTriangle size={10} /> {order.issueType}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-700 text-right">{order.items}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                    {order.amount > 0 ? (
                      <div className="flex items-center justify-end gap-0.5">
                        <BiRupee size={12} className="mb-0.5" />
                        <span>{order.amount.toLocaleString()}</span>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusClass(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  {onDelete && (
                    <td className="px-6 py-4 text-right">
                      <button onClick={(event) => { event.stopPropagation(); onDelete(order); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                        <FiTrash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-gray-50">
        {orders.map((order, index) => (
          <div
            key={order.id || index}
            onClick={onRowClick ? () => onRowClick(order) : undefined}
            className={`p-4 active:bg-gray-50 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{order.date || `${order.day}/${order.month}`}</p>
                <h4 className="text-sm font-bold text-gray-900">{order.property || order.tenant}</h4>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusClass(order.status)}`}>
                {order.status}
              </span>
            </div>
            <p className="text-xs text-gray-600 line-clamp-2 mb-3 bg-gray-50/50 p-2 rounded-lg border border-gray-100/50">{order.service}</p>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100/50">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Amount</span>
                <div className="flex items-center gap-0.5 text-sm font-black text-gray-900">
                  <BiRupee size={12} className="text-gray-400" />
                  <span>{order.amount?.toLocaleString() || "—"}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Items</span>
                <span className="text-xs font-bold text-slate-700">{order.items || 0} Clothes</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
