import { useState } from "react";
import { FiCheck } from "react-icons/fi";

// Analytics Components
import RegularDateFilter from "./RegularOrders/RegularDateFilter";
import OverviewDashboard from "./RegularOrders/OverviewDashboard";
import CustomersDashboard from "./RegularOrders/CustomersDashboard";
import AnalyticsDashboard from "./RegularOrders/AnalyticsDashboard";
import ExportReports from "./RegularOrders/ExportReports";
import TransactionsLogDashboard from "./RegularOrders/TransactionsLogDashboard";
import RegularOrderFormModal from "./RegularOrders/RegularOrderFormModal";

import { useRegularAnalytics } from "../hooks/useRegularAnalytics";

const SUB_TABS = ["Overview", "Customers", "Analytics", "Transactions Log"];

// Computed once at module load — avoids Date() allocation on every render
const _today = new Date();
const _fmt = (d) => d.toISOString().split("T")[0];
const DEFAULT_DATE_FROM = _fmt(_today);
const DEFAULT_DATE_TO = _fmt(_today);

export default function AdminRegularTab({ orders, onAddOrder, onEditOrder, onDeleteOrder }) {
  const [activeSubTab, setActiveSubTab] = useState("Overview");
  const [localDateFrom, setLocalDateFrom] = useState(DEFAULT_DATE_FROM);
  const [localDateTo, setLocalDateTo] = useState(DEFAULT_DATE_TO);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [toast, setToast] = useState("");

  // All historical orders are passed in — analytics hook handles current vs previous period internally
  const analytics = useRegularAnalytics(orders, localDateFrom, localDateTo);

  const handleOpenEditModal = (order) => {
    setEditingOrder(order);
    setIsModalOpen(true);
  };

  const handleOpenAddModal = () => {
    setEditingOrder(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = (finalOrder, isEdit) => {
    if (isEdit) {
      onEditOrder?.(finalOrder);
      setToast("Order updated successfully!");
    } else {
      onAddOrder?.(finalOrder);
      setToast("Order added successfully!");
    }
    setIsModalOpen(false);
    setTimeout(() => setToast(""), 3000);
  };

  return (
    <div className="space-y-6" style={{ fontFamily: "DM Sans, sans-serif" }}>
      {toast && (
        <div className="fixed top-6 right-6 z-[100] bg-[#0F172A] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-left border border-slate-700/50 backdrop-blur-md">
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
            <FiCheck size={14} />
          </div>
          <span className="text-[13px] font-bold tracking-tight">{toast}</span>
        </div>
      )}

      {/* Header Controls: Date Filter & Export */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <RegularDateFilter 
          dateFrom={localDateFrom} 
          dateTo={localDateTo} 
          setDateFrom={setLocalDateFrom} 
          setDateTo={setLocalDateTo} 
        />
        <ExportReports analytics={analytics} />
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 mb-6 overflow-x-auto pb-[-1px]">
        {SUB_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-5 py-3 text-[14px] font-bold transition-all border-b-2 whitespace-nowrap ${
              activeSubTab === tab
                ? "border-blue-600 text-blue-600 bg-blue-50/50"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeSubTab === "Overview" && <OverviewDashboard analytics={analytics} />}
      {activeSubTab === "Customers" && <CustomersDashboard analytics={analytics} lookbackLabel={analytics.lookbackLabel} />}
      {activeSubTab === "Analytics" && <AnalyticsDashboard analytics={analytics} />}
      
      {activeSubTab === "Transactions Log" && (
        <TransactionsLogDashboard 
          currentOrders={analytics.currentOrders}
          onAddOrder={onAddOrder ? handleOpenAddModal : undefined}
          onEditOrder={onEditOrder ? handleOpenEditModal : undefined}
          onDeleteOrder={onDeleteOrder}
        />
      )}

      {/* Form Modal for Creating/Editing Orders */}
      <RegularOrderFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialOrder={editingOrder}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
}
