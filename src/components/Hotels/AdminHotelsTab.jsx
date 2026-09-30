import { useState } from "react";
import { FiChevronRight, FiEdit2, FiTrash2 } from "react-icons/fi";
import { BiRupee } from "react-icons/bi";
import AdminOrderModal from "../Shared/AdminOrderModal";
import EmptyState from "../Shared/EmptyState";
import TabSectionCard from "../Shared/TabSectionCard";
import { useHotelMetrics } from "../../hooks/useHotelMetrics";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useHostelAuth } from "../../context/HostelAuthContext";

function HotelSummaryCard({ name, color, orders, revenue }) {
  const totals = {};
  orders.forEach((order) => {
    if (!order.details) return;
    Object.entries(order.details).forEach(([key, value]) => {
      totals[key] = (totals[key] || 0) + (value || 0);
    });
  });

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <h3 className="text-sm font-bold text-gray-800">{name}</h3>
        <div className="ml-auto text-right">
          <span className="text-[10px] text-gray-400 font-medium block mb-0.5">
            {orders.length} pckp • {Object.values(totals).reduce((sum, value) => sum + value, 0)} items
          </span>
          <span className="text-xs font-bold text-green-600 flex items-center justify-end gap-0.5">
            <BiRupee size={12} />
            {revenue.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {Object.entries(totals).filter(([, value]) => value > 0).map(([key, value]) => (
          <div key={key}>
            <span className="text-gray-400">{key}</span>
            <p className="font-bold text-gray-700">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminHotelsTab({ orders }) {
  const { isViewer } = useHostelAuth();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { hotelSummaries, sortedHotelOrders } = useHotelMetrics(orders);
  const handleDeleteOrder = async (orderId) => {
    if (window.confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "b2b_orders", orderId));
      } catch (error) {
        console.error("Error deleting order:", error);
        alert("Failed to delete order. Please check permissions.");
      }
    }
  };

  return (
    <div className="space-y-6" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <TabSectionCard title="Hotels & Airbnbs" subtitle="Live property summaries and transaction history">
        <div className="space-y-6 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hotelSummaries.map((summary) => (
              <HotelSummaryCard key={summary.name} {...summary} />
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto mt-4">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-[#f8fcff]">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 rounded-tl-xl">Date</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Property</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Bedsheet</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Pillow Cover</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Duvet Cover</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Towels</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Amount</th>
                  {!isViewer && <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3 rounded-tr-xl">Action</th>}
                </tr>
              </thead>
              <tbody>
                {sortedHotelOrders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12">
                      <EmptyState
                        title="No hotel orders yet"
                        message="New Airbnb or hotel orders will show up here automatically."
                      />
                    </td>
                  </tr>
                ) : sortedHotelOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => { setSelectedOrder(order); setIsModalOpen(true); }}
                    className="border-b border-gray-50 hover:bg-orange-50/30 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 text-sm text-gray-600">{order.date}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{order.property}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{order.details?.["Bedsheet"] || order.details?.["Single Bedsheet"] || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{order.details?.["Pillow Cover"] || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{order.details?.["Duvet Cover"] || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{(order.details?.["Bath Towel"] || 0) + (order.details?.["Hand Towel"] || 0)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-0.5">
                          <BiRupee size={12} className="mb-0.5" />
                          <span>{order.amount?.toLocaleString()}</span>
                        </div>
                        <FiChevronRight size={16} className="text-slate-400 group-hover:text-orange-500 transition-colors" />
                      </div>
                    </td>
                    {!isViewer && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <FiEdit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteOrder(order.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-gray-50 mt-4 border border-gray-100 rounded-xl overflow-hidden">
            {sortedHotelOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => { setSelectedOrder(order); setIsModalOpen(true); }}
                className="p-4 active:bg-orange-50 transition-colors cursor-pointer"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">{order.date}</span>
                    <h4 className="text-sm font-bold text-gray-900">{order.property}</h4>
                  </div>
                  <div className="flex items-center gap-0.5 text-sm font-black text-blue-600">
                    <BiRupee size={12} className="text-slate-400" />
                    <span>{order.amount?.toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 pt-3 border-t border-gray-100/50">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-gray-400">Bedsheets</span>
                    <span className="font-bold text-slate-700">{order.details?.["Bedsheet"] || order.details?.["Single Bedsheet"] || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-gray-400">Pillow Co.</span>
                    <span className="font-bold text-slate-700">{order.details?.["Pillow Cover"] || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-gray-400">Duvet Co.</span>
                    <span className="font-bold text-slate-700">{order.details?.["Duvet Cover"] || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-gray-400">Towels</span>
                    <span className="font-bold text-slate-700">{(order.details?.["Bath Towel"] || 0) + (order.details?.["Hand Towel"] || 0)}</span>
                  </div>
                </div>
              </div>
            ))}
            {sortedHotelOrders.length === 0 && (
              <div className="p-4">
                <EmptyState
                  title="No hotel orders yet"
                  message="New Airbnb or hotel orders will show up here automatically."
                />
              </div>
            )}
          </div>
        </div>
      </TabSectionCard>

      <AdminOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        order={selectedOrder}
      />
    </div>
  );
}