// src/components/ExpandableOrderRow.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CATEGORIES, getCategoryLabel } from "../../data/hostelOrders";
import { FiChevronUp, FiChevronDown, FiArrowRight, FiShoppingBag, FiUsers, FiAlertTriangle } from "react-icons/fi";
import { MdScale } from "react-icons/md";
import { useHostelAuth } from "../../context/HostelAuthContext";
import { FiX } from "react-icons/fi";

export default function ExpandableOrderRow({ order, showProperty = false, viewMode = "mixed" }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { verifyOrder, addIssue, client } = useHostelAuth();
  const [verifying, setVerifying] = useState(false);

  // Local Issue Modal State
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueForm, setIssueForm] = useState({
    issueType: "Missing Items",
    description: "",
  });

  const handleSubmitIssue = async () => {
    if (!issueForm.description.trim()) return;

    const newIssue = {
      id: `issue-client-${Date.now()}`,
      date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0],
      property: order.property || (client.properties ? client.properties[0] : ""),
      linkedHostel: order.property || (client.properties ? client.properties[0] : ""),
      linkedOrderId: order.id, // NEW: Link specifically to this order
      category: "ISSUES",
      type: "issue",
      issueType: issueForm.issueType,
      service: issueForm.description,
      severity: "pending",
      resolveStatus: "Unresolved",
      status: "Pending",
      reportedBy: client.name,
      customerName: order.customerName || client.name,
      pickupDate: order.date || "",
      deliveryDate: order.deliveryDate || "",
      items: 0,
      weight: 0,
      amount: 0
    };

    await addIssue(newIssue);
    setShowIssueModal(false);
    setIssueForm({ issueType: "Missing Items", description: "" });
  };

  const handleVerify = async (e) => {
    e.stopPropagation();
    if (order.verifiedByClient || verifying) return;
    setVerifying(true);
    try {
      await verifyOrder(order.id, order.source);
    } catch (err) {
      alert("Failed to verify order. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const cat = CATEGORIES[order.category] || {};
  const categoryLabel = getCategoryLabel(order.category, order.property);

  // 1. Helper function to render modern blue chips safely for all order types
  const renderItemBreakdown = (order) => {
    let itemsArray = [];

    // Scenario A: Order has the partnerItems map (from our new Airbnb form)
    if (order.partnerItems && typeof order.partnerItems === 'object') {
      itemsArray = Object.entries(order.partnerItems).map(([name, qty]) => ({ name, qty }));
    }
    // Scenario B: Old Hostel Orders where order.details is already an object
    else if (order.details && typeof order.details === 'object' && Object.keys(order.details).length > 0) {
      // Filter out meta fields like entryMode if it's a B2B order
      if (order.details.entryMode && order.details.studentServices) {
        itemsArray = order.details.studentServices.map(s => ({ name: s.type || 'Clothes', qty: s.quantity }));
      } else {
        itemsArray = Object.entries(order.details).map(([name, qty]) => ({ name, qty }));
      }
    }
    // Scenario C: order.details or order.clothes is a comma-separated string
    else if ((typeof order.details === 'string' && order.details) || (typeof order.clothes === 'string' && order.clothes)) {
      const detailsStr = typeof order.details === 'string' ? order.details : order.clothes;
      if (detailsStr.includes(':')) {
        itemsArray = detailsStr.split(',').map(itemStr => {
          const [name, qty] = itemStr.split(':');
          return { name: name ? name.trim() : '', qty: qty ? qty.trim() : '' };
        }).filter(item => item.name);
      }
    }

    if (itemsArray.length === 0) return null;

    return (
      <div className="mb-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          Item Breakdown
        </p>
        <div className="flex flex-wrap gap-2 py-1">
          {itemsArray.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 shadow-sm"
            >
              {item.name}
              <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded-md shadow-sm">
                {item.qty}
              </span>
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderItemsColumn = (order, alignRight = false) => {
    const justifyClass = alignRight ? "justify-end" : "justify-start";
    
    // If we have explicit claimed/verified data (typically from hostel orders)
    if (order.claimedItems > 0 || order.verifiedItems > 0) {
      const claimed = order.claimedItems || 0;
      const verified = order.verifiedItems || 0;
      const isDiscrepancy = claimed > 0 && verified > 0 && claimed !== verified;

      return (
        <div className={`flex flex-col gap-1.5 ${alignRight ? "items-end" : "items-start"}`}>
          {isDiscrepancy ? (
            <>
              <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm opacity-90" title="Claimed by Student">
                <FiShoppingBag size={11} /> <span className="line-through">{claimed}</span> <span className="text-[9px] font-semibold tracking-wide">(CLAIMED)</span>
              </span>
              <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 text-[11px] font-bold px-2 py-0.5 rounded-md shadow-sm" title="Verified by Rider">
                <FiShoppingBag size={12} /> {verified} <span className="text-[9px] text-green-600 font-semibold tracking-wide ml-0.5">(VERIFIED)</span>
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 text-gray-700 text-[11px] font-bold px-2 py-0.5 rounded-md shadow-sm" title={verified > 0 ? "Verified by Rider" : "Claimed by Student"}>
              <FiShoppingBag size={12} className={verified > 0 ? "text-green-600" : "text-blue-600 opacity-80"} /> 
              {verified > 0 ? verified : claimed}
              {verified > 0 && <span className="text-[9px] text-green-600 font-bold ml-1 border-l border-gray-300 pl-1 uppercase tracking-wide">Verified</span>}
            </span>
          )}
        </div>
      );
    }

    // Fallback to standard items if no explicit claimed/verified discrepancy exists
    if (order.items > 0) {
      return (
        <div className={`flex gap-2 items-center ${justifyClass}`}>
          <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 text-gray-700 text-[11px] font-bold px-2 py-0.5 rounded-md shadow-sm">
            <FiShoppingBag size={12} className="text-blue-600 opacity-80" /> {order.items}
          </span>
        </div>
      );
    }

    return <span className={`text-gray-400 text-sm w-full block ${alignRight ? "text-right" : "text-left"}`}>—</span>;
  };

  return (
    <>
      {/* Main row — no ID column */}
      <tr
        onClick={() => setOpen(!open)}
        className="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 group"
      >
        <td className="px-4 py-3 text-sm font-medium text-gray-800">{order.date}</td>
        {showProperty && (
          <td className="px-4 py-3 text-sm text-gray-700">{order.property}</td>
        )}
        {viewMode === "student" ? (
          <>
            <td className="px-4 py-3 text-sm font-bold text-gray-800">{order.customerName || "N/A"}</td>
            <td className="px-4 py-3 text-xs text-gray-500">
              <span className="block font-medium text-gray-800">{order.service}</span>
              <span className="block text-gray-400">{order.customerNumber}</span>
            </td>
            <td className="px-4 py-3 align-top">
              {renderItemsColumn(order, false)}
            </td>
          </>
        ) : (
          <>
            <td className="px-4 py-3">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: cat.color + "18", color: cat.color }}
              >
                {categoryLabel}
              </span>
            </td>
            <td className="px-4 py-3 align-top">
              {renderItemsColumn(order, true)}
            </td>
            <td className="px-4 py-3">
              <div className="flex gap-2 items-center justify-end">
                {order.weight ? (
                  <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 text-gray-700 text-[11px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                    <MdScale size={13} className="text-orange-600 opacity-80" /> {order.weight}
                  </span>
                ) : <span className="text-gray-400 text-sm w-full text-right">—</span>}
              </div>
            </td>
            <td className="px-4 py-3">
              <div className="flex gap-2 items-center justify-end">
                {order.studentCount ? (
                  <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 text-gray-700 text-[11px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                    <FiUsers size={12} className="text-indigo-600 opacity-80" /> {order.studentCount}
                  </span>
                ) : <span className="text-gray-400 text-sm w-full text-right">—</span>}
              </div>
            </td>
          </>
        )}
        <td className="px-4 py-3 text-center">
          <div className="flex flex-col items-center gap-1 justify-center">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${order.status === "Delivered"
                ? "bg-green-100 text-green-700"
                : order.status === "Resolved"
                  ? "bg-emerald-100 text-emerald-700"
                  : order.status === "Pending"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-600"
                }`}
            >
              {order.category === "ISSUES" && <FiAlertTriangle size={12} className={order.status === "Resolved" ? "text-emerald-600" : "text-red-500"} />}
              {order.status || "Pending"}
            </span>
            {order.verifiedByClient && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase tracking-wide">
                ✓ Verified
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-gray-400 group-hover:text-brand transition-colors">
          {open ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
        </td>
      </tr>

      {/* Expanded detail panel */}
      {open && (
        <tr className="bg-gradient-to-br from-brand-50/40 to-white">
          <td colSpan={showProperty ? (viewMode === "student" ? 7 : 8) : (viewMode === "student" ? 6 : 7)} className="px-6 py-5">
            {/* Key metrics row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
              <MetricCard label="Property" value={order.property} />
              <MetricCard label="Category" value={categoryLabel || order.category} />
              <MetricCard label="Status" value={order.status || "Pending"}
                badgeClass={
                  order.status === "Delivered" ? "text-emerald-700" :
                    order.status === "Resolved" ? "text-emerald-700" :
                      (order.status === "Pending" || !order.status) ? "text-amber-600" : "text-gray-600"
                }
              />
              {order.customerName ? <MetricCard label="Customer" value={order.customerName} /> : null}
              {order.customerNumber ? <MetricCard label="Phone" value={order.customerNumber} /> : null}
              {order.issueType ? <MetricCard label="Issue Type" value={order.issueType} /> : null}
              {order.reportedBy ? <MetricCard label="Reported By" value={order.reportedBy} /> : null}
              {order.solution ? <MetricCard label="Solution" value={order.solution} /> : null}
            </div>

            {/* Linen item breakdown (Uses the New Blue Chips) */}
            {(order.details || order.partnerItems || order.clothes) && renderItemBreakdown(order)}

            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/client/order/${order.id}`);
                }}
                className="text-sm font-semibold text-brand hover:text-brand-dark transition-colors inline-flex items-center gap-1"
              >
                View Full Details <FiArrowRight size={14} />
              </button>

              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowIssueModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-all shadow-sm hover:shadow active:scale-95"
                >
                  <FiAlertTriangle size={12} /> Report Issue
                </button>

                {order.verifiedByClient ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-green-50 text-green-700 border border-green-200 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Verified by Client
                  </span>
                ) : (
                  <button
                    onClick={handleVerify}
                    disabled={verifying}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg active:scale-95"
                  >
                    {verifying ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify Order
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}

      {/* Order-Specific Raise Issue Modal */}
      {showIssueModal && (
        <tr className="relative">
          <td colSpan={10} className="p-0">
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setShowIssueModal(false); }} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6 cursor-default">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Report Order Issue</h2>
                    <p className="text-xs text-gray-500">Order ID: {order.id}</p>
                  </div>
                  <button onClick={() => setShowIssueModal(false)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                    <FiX size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Issue Category</label>
                    <select
                      value={issueForm.issueType}
                      onChange={(e) => setIssueForm({ ...issueForm, issueType: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 text-sm px-4 py-2.5 focus:outline-none focus:border-red-500 bg-no-repeat bg-right"
                    >
                      <option value="Missing Items">Missing Items</option>
                      <option value="Damage">Damage</option>
                      <option value="Quality Issue">Quality Issue</option>
                      <option value="Return Pending">Return Pending</option>
                      <option value="Weight Dispute">Weight Dispute</option>
                      <option value="Bags Pending">Bags Pending</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Description of Issue</label>
                    <textarea
                      value={issueForm.description}
                      onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                      rows={4}
                      placeholder="Provide full details here..."
                      className="w-full rounded-xl border border-gray-200 text-sm px-4 py-2.5 focus:outline-none focus:border-red-500 resize-none"
                    />
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setShowIssueModal(false)}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitIssue}
                    disabled={!issueForm.description.trim()}
                    className="flex-[1.5] py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-md active:scale-95"
                  >
                    Submit Issue
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function MetricCard({ label, value, highlight = false, badgeClass = "" }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${highlight ? "text-brand" : badgeClass || "text-gray-800"}`}>
        {value}
      </p>
    </div>
  );
}
