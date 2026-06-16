// src/pages/ClientOrderDetail.jsx
import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useHostelAuth } from "../context/HostelAuthContext";
import { CATEGORIES, getCategoryLabel } from "../data/hostelOrders";
import {
  FiArrowLeft, FiCalendar, FiHash, FiMapPin, FiTag, FiPackage,
  FiAlertCircle, FiCheckCircle, FiUser, FiPhone, FiDownload,
} from "react-icons/fi";
import { BiRupee } from "react-icons/bi";

// CSV helper for single order
function exportSingleCSV(order) {
  const headers = ["Field", "Value"];
  const rows = [
    ["Order ID", order.id],
    ["Date", order.date],
    ["Property", order.property],
    ["Category", order.category],
    ["Clothes", order.items ?? ""],
    ["Weight", order.weight ?? ""],
    ["Students", order.studentCount ?? ""],
    ["Status", order.status],
  ];
  if (order.customerName) rows.push(["Customer", order.customerName]);
  if (order.customerNumber) rows.push(["Phone", order.customerNumber]);
  if (order.issueType) rows.push(["Issue Type", order.issueType]);
  if (order.reportedBy) rows.push(["Reported By", order.reportedBy]);
  if (order.solution) rows.push(["Solution", `"${order.solution.replace(/"/g, '""')}"`]);
  if (order.details) {
    Object.entries(order.details).forEach(([item, qty]) => rows.push([item, qty]));
  }
  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `order_${order.id}.csv`; a.click(); URL.revokeObjectURL(url);
}

export default function ClientOrderDetail() {
  const { orderId } = useParams();
  const { orders, verifyOrder } = useHostelAuth();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(false);

  const order = useMemo(() => orders.find((o) => o.id === orderId), [orders, orderId]);

  const handleVerify = async () => {
    if (!order || order.verifiedByClient || verifying) return;
    setVerifying(true);
    try {
      await verifyOrder(order.id, order.source);
    } catch (err) {
      alert("Failed to verify order. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  if (!order) {
    return (
      <div className="min-h-screen bg-[#F0F7FF] flex items-center justify-center" style={{ fontFamily: "Poppins, sans-serif" }}>
        <div className="text-center">
          <FiPackage size={48} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Order Not Found</h2>
          <p className="text-gray-500 mb-6">The order "{orderId}" was not found in your data.</p>
          <button
            onClick={() => navigate("/client/dashboard")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white font-semibold rounded-xl hover:bg-brand-dark transition-colors"
          >
            <FiArrowLeft size={16} /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const cat = CATEGORIES[order.category] || { label: order.category, icon: "📁", color: "#6B7280" };
  const categoryLabel = getCategoryLabel(order.category, order.property);

  // Build field list dynamically
  const fields = [
    { icon: <FiHash />, label: "Order ID", value: order.id },
    { icon: <FiCalendar />, label: "Date", value: order.date },
    { icon: <FiMapPin />, label: "Property", value: order.property },
    { icon: <FiTag />, label: "Category", value: categoryLabel, badge: true, color: cat.color },
    { 
      icon: <FiPackage />, 
      label: "Service", 
      value: (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {(order.service || "").split(/,\s*|—\s*/).map(s => s.trim()).filter(Boolean).map((item, i) => (
            <span key={i} className="inline-flex items-center bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm">
              {item}
            </span>
          ))}
        </div>
      ) 
    },
    { label: "Items", value: order.items ?? "—" },
    { icon: <FiCheckCircle />, label: "Status", value: order.status, statusBadge: true },
    { label: "Verified by Client", value: order.verifiedByClient ? "Yes, Verified" : "No" }
  ];

  if (order.weight) fields.push({ label: "Weight", value: `${order.weight} KG` });
  if (order.studentCount) fields.push({ label: "Students", value: order.studentCount });
  if (order.customerName) fields.push({ icon: <FiUser />, label: "Customer Name", value: order.customerName });
  if (order.customerNumber) fields.push({ icon: <FiPhone />, label: "Customer Phone", value: order.customerNumber });
  if (order.issueType) fields.push({ icon: <FiAlertCircle />, label: "Issue Type", value: order.issueType });
  if (order.reportedBy) fields.push({ label: "Reported By", value: order.reportedBy });
  if (order.solution) fields.push({ label: "Solution / Resolution", value: order.solution });

  return (
    <div className="min-h-screen bg-[#F0F7FF]" style={{ fontFamily: "Poppins, sans-serif" }}>
      {/* Header */}
      <nav className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600">
              <FiArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Order Details</h1>
              <p className="text-xs text-gray-500 font-mono">{order.id}</p>
            </div>
          </div>
          <button
            onClick={() => exportSingleCSV(order)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-dark border border-brand-200 bg-blue-50 px-4 py-2 rounded-xl transition-all hover:bg-blue-100"
          >
            <FiDownload size={15} /> Export
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Hero card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div
            className="px-6 py-5 flex items-center gap-4"
            style={{ background: `linear-gradient(135deg, ${cat.color}10, ${cat.color}05)` }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: cat.color }}>
              <FiPackage size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{order.property}</h2>
              <p className="text-sm text-gray-500">{categoryLabel} · {order.date}</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {order.verifiedByClient ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-green-50 text-green-700 border border-green-200 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Verified
                </span>
              ) : (
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
                >
                  {verifying ? "Verifying..." : "Verify Order"}
                </button>
              )}
              <span
                className={`inline-block text-sm font-bold px-4 py-1.5 rounded-full ${
                  order.status === "Delivered"
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                    : order.status === "Pending"
                    ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                    : "bg-gray-100 text-gray-600 ring-1 ring-gray-200"
                }`}
              >
                {order.status}
              </span>
            </div>
          </div>

          {/* Detail fields */}
          <div className="px-6 py-6 grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8">
            {fields.map((f, i) => (
              <div key={i}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  {f.icon && <span className="text-brand">{f.icon}</span>}
                  {f.label}
                </p>
                {f.badge ? (
                  <span
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full"
                    style={{ backgroundColor: f.color + "18", color: f.color }}
                  >
                    {f.value}
                  </span>
                ) : f.statusBadge ? (
                  <span
                    className={`inline-block text-sm font-bold px-3 py-1 rounded-full ${
                      f.value === "Delivered"
                        ? "bg-emerald-50 text-emerald-700"
                        : f.value === "Pending"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {f.value}
                  </span>
                ) : (
                  <div className="text-gray-800 font-medium text-sm mt-0.5">{f.value}</div>
                )}
              </div>
            ))}
          </div>

          {/* Linen breakdown (if present) */}
          {order.details && (
            <div className="px-6 pb-6">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Item Breakdown</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Object.entries(order.details).map(([item, qty]) => (
                  <div key={item} className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                    <p className="text-xs text-gray-500 font-medium">{item}</p>
                    <p className="text-xl font-bold text-brand mt-0.5">{qty}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Back button */}
        <div className="flex justify-center">
          <button
            onClick={() => navigate("/client/dashboard")}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:border-brand hover:text-brand transition-all shadow-sm"
          >
            <FiArrowLeft size={16} /> Back to Dashboard
          </button>
        </div>
      </main>
    </div>
  );
}
